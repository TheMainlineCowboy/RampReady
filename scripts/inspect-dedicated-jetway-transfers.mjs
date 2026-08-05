#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const branches = [
  "origin/agent/jetway-source-binary-staging",
  "origin/transfer/jetway-blob-validation",
];
const expected = Object.freeze({
  bytes: 31_459_796,
  sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0",
});

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    input: options.input,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 512 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr?.toString?.() || result.status}`);
  }
  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exact(bytes) {
  return bytes.length === expected.bytes && sha256(bytes) === expected.sha256;
}

function show(ref, filePath) {
  const result = run("git", ["show", `${ref}:${filePath}`], { encoding: null, allowFailure: true });
  return result.status === 0 ? Buffer.from(result.stdout) : null;
}

function decodeBase64(bytes) {
  const text = bytes.toString("utf8").replace(/\s+/g, "");
  if (!text || !/^[A-Za-z0-9+/=]+$/.test(text)) return null;
  const decoded = Buffer.from(text, "base64");
  return decoded.length ? decoded : null;
}

function tryXz(bytes) {
  if (bytes.length < 6 || bytes.subarray(0, 6).toString("hex") !== "fd377a585a00") return null;
  const result = run("xz", ["--decompress", "--stdout"], { input: bytes, encoding: null, allowFailure: true });
  return result.status === 0 ? Buffer.from(result.stdout) : null;
}

function tryGzip(bytes) {
  if (bytes.length < 2 || bytes.subarray(0, 2).toString("hex") !== "1f8b") return null;
  const result = run("gzip", ["--decompress", "--stdout"], { input: bytes, encoding: null, allowFailure: true });
  return result.status === 0 ? Buffer.from(result.stdout) : null;
}

function reportCandidate(context, bytes) {
  const digest = sha256(bytes);
  console.log(`JETWAY_DEDICATED_CANDIDATE ${JSON.stringify({ ...context, bytes: bytes.length, sha256: digest, magic: bytes.subarray(0, 16).toString("hex") })}`);
  if (bytes.length === expected.bytes && digest === expected.sha256) {
    console.log(`JETWAY_DEDICATED_EXACT_FOUND ${JSON.stringify({ ...context, bytes: bytes.length, sha256: digest })}`);
    return true;
  }
  for (const [codec, output] of [["xz", tryXz(bytes)], ["gzip", tryGzip(bytes)]]) {
    if (!output) continue;
    const outputDigest = sha256(output);
    console.log(`JETWAY_DEDICATED_DECOMPRESSED ${JSON.stringify({ ...context, codec, inputBytes: bytes.length, outputBytes: output.length, outputSha256: outputDigest, magic: output.subarray(0, 16).toString("hex") })}`);
    if (output.length === expected.bytes && outputDigest === expected.sha256) {
      console.log(`JETWAY_DEDICATED_EXACT_FOUND ${JSON.stringify({ ...context, codec, bytes: output.length, sha256: outputDigest })}`);
      return true;
    }
  }
  return false;
}

function familyKey(filePath) {
  const directory = path.posix.dirname(filePath);
  const base = path.posix.basename(filePath);
  const normalized = base
    .replace(/(?:part|chunk|prefix|tail)[._-]?\d+(?=\.b64$)/i, "$SEQ")
    .replace(/\d+(?=\.b64$)/, "$SEQ");
  return `${directory}/${normalized}`;
}

for (const branch of branches) {
  const head = run("git", ["rev-parse", branch], { allowFailure: true }).stdout.trim();
  if (!head) {
    console.log(`JETWAY_DEDICATED_BRANCH_MISSING ${branch}`);
    continue;
  }
  console.log(`JETWAY_DEDICATED_BRANCH ${branch} ${head}`);
  const treeOutput = run("git", ["ls-tree", "-r", "--long", branch]).stdout.trim();
  const entries = treeOutput.split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\s+(\d+)\t(.+)$/);
    return match ? { mode: match[1], type: match[2], sha: match[3], size: Number(match[4]), path: match[5] } : null;
  }).filter(Boolean);
  const relevant = entries.filter((entry) => /jetway|airport_jetway|\.glb|\.zip|\.b64|source/i.test(entry.path));
  console.log(`JETWAY_DEDICATED_TREE_COUNT ${branch} ${entries.length} ${relevant.length}`);
  for (const entry of relevant) {
    console.log(`JETWAY_DEDICATED_TREE ${JSON.stringify({ branch, ...entry })}`);
    if (entry.size === expected.bytes || /\.glb$/i.test(entry.path)) {
      const bytes = show(branch, entry.path);
      if (bytes) reportCandidate({ branch, mode: "direct", path: entry.path }, bytes);
    }
  }

  const b64Entries = relevant.filter((entry) => /\.b64$/i.test(entry.path));
  const groups = new Map();
  for (const entry of b64Entries) {
    const key = familyKey(entry.path);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  // Also test every directory as one sequence because some transfers switch prefix names mid-stream.
  for (const entry of b64Entries) {
    const key = `${path.posix.dirname(entry.path)}/$ALL_B64`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const [family, group] of groups) {
    group.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    const sourceBuffers = group.map((entry) => show(branch, entry.path)).filter(Boolean);
    if (sourceBuffers.length !== group.length) continue;
    const decoded = sourceBuffers.map(decodeBase64);
    if (decoded.every(Boolean)) {
      reportCandidate({ branch, family, mode: "per-file-base64", files: group.map((entry) => entry.path) }, Buffer.concat(decoded));
    }
    const joined = Buffer.concat(sourceBuffers).toString("utf8").replace(/\s+/g, "");
    if (joined && /^[A-Za-z0-9+/=]+$/.test(joined)) {
      reportCandidate({ branch, family, mode: "joined-base64", files: group.map((entry) => entry.path) }, Buffer.from(joined, "base64"));
    }
  }

  const commits = run("git", ["rev-list", branch]).stdout.trim().split(/\r?\n/).filter(Boolean);
  console.log(`JETWAY_DEDICATED_COMMIT_COUNT ${branch} ${commits.length}`);
  for (const commit of commits.slice(0, 100)) {
    const changed = run("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", commit], { allowFailure: true }).stdout
      .trim().split(/\r?\n/).filter((filePath) => /jetway|airport_jetway|\.glb|\.zip|\.b64|source/i.test(filePath));
    if (changed.length) console.log(`JETWAY_DEDICATED_COMMIT ${JSON.stringify({ branch, commit, changed })}`);
  }
}
