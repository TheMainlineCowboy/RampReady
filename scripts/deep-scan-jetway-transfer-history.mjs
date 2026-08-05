#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = Object.freeze({ bytes: 31_459_796, sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0" });
const destination = path.join(root, "public", "models", "airport-jetway", "Airport_Jetway.glb");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    input: options.input,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 1024 * 1024 * 1024,
  });
  if (result.status !== 0 && !options.allowFailure) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr?.toString?.() || result.status}`);
  return result;
}

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function exact(bytes) { return bytes.length === expected.bytes && sha256(bytes) === expected.sha256; }
function gitShow(ref, filePath) {
  const result = run("git", ["show", `${ref}:${filePath}`], { encoding: null, allowFailure: true });
  return result.status === 0 ? Buffer.from(result.stdout) : null;
}
function decodeB64(bytes) {
  const text = bytes.toString("utf8").replace(/\s+/g, "");
  if (!text || !/^[A-Za-z0-9+/=]+$/.test(text)) return null;
  const decoded = Buffer.from(text, "base64");
  return decoded.length ? decoded : null;
}
function decompress(bytes) {
  const attempts = [];
  if (bytes.subarray(0, 6).toString("hex") === "fd377a585a00") attempts.push(["xz", ["--decompress", "--stdout"]]);
  if (bytes.subarray(0, 2).toString("hex") === "1f8b") attempts.push(["gzip", ["--decompress", "--stdout"]]);
  if (bytes.subarray(0, 4).toString("hex") === "504b0304") attempts.push(["unzip", ["-p", "/dev/stdin"]]);
  for (const [command, args] of attempts) {
    if (command === "unzip") continue;
    const result = run(command, args, { input: bytes, encoding: null, allowFailure: true });
    if (result.status === 0) return { codec: command, bytes: Buffer.from(result.stdout) };
  }
  return null;
}
async function save(bytes, source) {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`JETWAY_DEEP_EXACT_RECOVERED ${JSON.stringify({ source, bytes: bytes.length, sha256: sha256(bytes) })}`);
}
function parseTree(ref) {
  const output = run("git", ["ls-tree", "-r", "--long", ref], { allowFailure: true }).stdout.trim();
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const match = line.match(/^(\d+)\s+(\w+)\s+([0-9a-f]+)\s+(\d+)\t(.+)$/);
    return match ? { mode: match[1], type: match[2], sha: match[3], size: Number(match[4]), path: match[5] } : null;
  }).filter(Boolean);
}
function natural(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }); }
function transferStem(filePath) {
  const dir = path.posix.dirname(filePath);
  const base = path.posix.basename(filePath).toLowerCase()
    .replace(/(?:part|chunk|prefix|tail)[._-]?\d+(?=\.b64$)/g, "$seq")
    .replace(/(?:part|chunk)[._-]?\d+(?=\.(?:xz|gz)(?:\.b64)?$)/g, "$seq")
    .replace(/\d+(?=\.b64$)/g, "$seq");
  return `${dir}/${base}`;
}

const refs = run("git", ["for-each-ref", "--format=%(refname)", "refs/remotes/origin", "refs/heads"]).stdout.trim().split(/\r?\n/).filter(Boolean);
console.log(`JETWAY_DEEP_REF_COUNT ${refs.length}`);
const seenTrees = new Set();
for (const ref of refs) {
  const treeSha = run("git", ["rev-parse", `${ref}^{tree}`], { allowFailure: true }).stdout.trim();
  if (!treeSha || seenTrees.has(treeSha)) continue;
  seenTrees.add(treeSha);
  const entries = parseTree(ref);
  const relevant = entries.filter((entry) => /jetway|airport_jetway|source\.glb|\.jetway-|runtime-asset/i.test(entry.path));
  if (!relevant.length) continue;
  console.log(`JETWAY_DEEP_REF ${JSON.stringify({ ref, treeSha, relevantFiles: relevant.length })}`);

  for (const entry of relevant) {
    if (entry.size === expected.bytes || /Airport_Jetway\.glb$/i.test(entry.path)) {
      const bytes = gitShow(ref, entry.path);
      if (!bytes) continue;
      console.log(`JETWAY_DEEP_DIRECT ${JSON.stringify({ ref, path: entry.path, bytes: bytes.length, sha256: sha256(bytes) })}`);
      if (exact(bytes)) { await save(bytes, `${ref}:${entry.path}`); process.exit(0); }
    }
  }

  const b64Entries = relevant.filter((entry) => /\.b64$/i.test(entry.path));
  const groups = new Map();
  for (const entry of b64Entries) {
    for (const key of [transferStem(entry.path), `${path.posix.dirname(entry.path)}/$all`]) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
  }
  for (const [key, rawGroup] of groups) {
    const group = [...new Map(rawGroup.map((entry) => [entry.path, entry])).values()].sort((a, b) => natural(a.path, b.path));
    const source = group.map((entry) => gitShow(ref, entry.path));
    if (source.some((bytes) => !bytes)) continue;
    const decoded = source.map(decodeB64);
    const candidates = [];
    if (decoded.every(Boolean)) candidates.push({ mode: "per-file", bytes: Buffer.concat(decoded) });
    const joinedText = Buffer.concat(source).toString("utf8").replace(/\s+/g, "");
    if (joinedText && /^[A-Za-z0-9+/=]+$/.test(joinedText)) candidates.push({ mode: "joined-text", bytes: Buffer.from(joinedText, "base64") });

    // Test every suffix beginning at an XZ/GZIP header, which catches mixed directories and resumed transfers.
    if (decoded.every(Boolean)) {
      for (let start = 0; start < decoded.length; start += 1) {
        const magic = decoded[start].subarray(0, 6).toString("hex");
        if (magic === "fd377a585a00" || magic.startsWith("1f8b")) {
          candidates.push({ mode: `suffix-${start}`, bytes: Buffer.concat(decoded.slice(start)) });
        }
      }
    }

    for (const candidate of candidates) {
      const digest = sha256(candidate.bytes);
      if (candidate.bytes.length > 1_000_000 || candidate.bytes.subarray(0, 6).toString("hex") === "fd377a585a00") {
        console.log(`JETWAY_DEEP_TRANSFER ${JSON.stringify({ ref, key, mode: candidate.mode, files: group.length, bytes: candidate.bytes.length, sha256: digest, magic: candidate.bytes.subarray(0, 12).toString("hex") })}`);
      }
      if (exact(candidate.bytes)) { await save(candidate.bytes, `${ref}:${key}:${candidate.mode}:raw`); process.exit(0); }
      const unpacked = decompress(candidate.bytes);
      if (!unpacked) continue;
      console.log(`JETWAY_DEEP_UNPACKED ${JSON.stringify({ ref, key, mode: candidate.mode, codec: unpacked.codec, inputBytes: candidate.bytes.length, outputBytes: unpacked.bytes.length, outputSha256: sha256(unpacked.bytes), magic: unpacked.bytes.subarray(0, 12).toString("hex") })}`);
      if (exact(unpacked.bytes)) { await save(unpacked.bytes, `${ref}:${key}:${candidate.mode}:${unpacked.codec}`); process.exit(0); }
    }
  }
}

const allCommits = run("git", ["rev-list", "--all"]).stdout.trim().split(/\r?\n/).filter(Boolean);
console.log(`JETWAY_DEEP_COMMIT_COUNT ${allCommits.length}`);
const needles = ["airport-jetway-runtime-asset", "jetway-source-binary-text", "Airport_Jetway.glb", "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"];
for (const needle of needles) {
  const result = run("git", ["log", "--all", "-S", needle, "--format=%H%x09%s", "--", ".github", "scripts", "src", "README*"], { allowFailure: true }).stdout.trim();
  console.log(`JETWAY_DEEP_PICKAXE ${JSON.stringify({ needle, matches: result ? result.split(/\r?\n/) : [] })}`);
}
console.log(`JETWAY_DEEP_EXACT_NOT_FOUND ${expected.bytes} ${expected.sha256}`);
