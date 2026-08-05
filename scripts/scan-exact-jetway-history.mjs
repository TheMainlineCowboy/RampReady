#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = Object.freeze({
  bytes: 31_459_796,
  sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0",
});
const destination = path.join(root, "public", "models", "airport-jetway", "Airport_Jetway.glb");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    input: options.input,
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

async function saveExact(bytes, source) {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`JETWAY_HISTORY_EXACT_FOUND ${JSON.stringify({ source, bytes: bytes.length, sha256: sha256(bytes), destination: path.relative(root, destination) })}`);
}

function readBlob(blobSha) {
  const result = run("git", ["cat-file", "blob", blobSha], { encoding: null });
  return Buffer.from(result.stdout);
}

function listReachableObjects() {
  const objectLines = run("git", ["rev-list", "--objects", "--all"]).stdout.trim().split(/\r?\n/).filter(Boolean);
  const query = objectLines.map((line) => line.split(" ", 1)[0]).join("\n") + "\n";
  const checked = run("git", ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], { input: query }).stdout
    .trim().split(/\r?\n/).filter(Boolean);
  const pathBySha = new Map();
  for (const line of objectLines) {
    const firstSpace = line.indexOf(" ");
    pathBySha.set(firstSpace < 0 ? line : line.slice(0, firstSpace), firstSpace < 0 ? "" : line.slice(firstSpace + 1));
  }
  return checked.map((line) => {
    const [sha, type, sizeText] = line.split(" ");
    return { sha, type, size: Number(sizeText), path: pathBySha.get(sha) || "" };
  });
}

function relevantCommits() {
  const result = run("git", [
    "log", "--all", "--format=%H", "--",
    ".jetway-source-staging", ".jetway-source-v4", ".jetway-geometry-staging-v2",
    ".jetway-geometry-staging-v5", ".jetway-runtime-staging", "public/models/airport-jetway",
  ]).stdout.trim();
  return [...new Set(result.split(/\r?\n/).filter(Boolean))];
}

function treeEntries(commit) {
  const output = run("git", ["ls-tree", "-r", commit]).stdout.trim();
  return output.split(/\r?\n/).filter(Boolean).map((line) => {
    const tab = line.indexOf("\t");
    const metadata = line.slice(0, tab).split(" ");
    return { mode: metadata[0], type: metadata[1], sha: metadata[2], path: line.slice(tab + 1) };
  });
}

function decodeBase64Text(bytes) {
  const text = bytes.toString("utf8").replace(/\s+/g, "");
  if (!text || !/^[A-Za-z0-9+/=]+$/.test(text)) return null;
  const decoded = Buffer.from(text, "base64");
  return decoded.length ? decoded : null;
}

function decompressXz(bytes) {
  if (bytes.length < 6 || bytes.subarray(0, 6).toString("hex") !== "fd377a585a00") return null;
  const result = run("xz", ["--decompress", "--stdout"], { input: bytes, encoding: null, allowFailure: true });
  if (result.status !== 0) return null;
  return Buffer.from(result.stdout);
}

async function scanDirectBlobs(objects) {
  for (const object of objects) {
    if (object.type !== "blob" || object.size !== expected.bytes) continue;
    const bytes = readBlob(object.sha);
    const digest = sha256(bytes);
    console.log(`JETWAY_HISTORY_SIZE_MATCH ${JSON.stringify({ blob: object.sha, path: object.path, bytes: bytes.length, sha256: digest })}`);
    if (digest === expected.sha256) {
      await saveExact(bytes, `git-blob:${object.sha}:${object.path || "unnamed"}`);
      return true;
    }
  }
  return false;
}

async function scanHistoricalTransfers() {
  const commits = relevantCommits();
  const seenTrees = new Set();
  console.log(`JETWAY_HISTORY_COMMITS ${commits.length}`);
  for (const commit of commits) {
    const entries = treeEntries(commit).filter((entry) =>
      entry.type === "blob" && (/^\.jetway-/.test(entry.path) || /^public\/models\/airport-jetway\//.test(entry.path)),
    );

    for (const entry of entries) {
      if (!/\.(?:glb|bin|zip)$/i.test(entry.path)) continue;
      const bytes = readBlob(entry.sha);
      if (exact(bytes)) {
        await saveExact(bytes, `commit:${commit}:${entry.path}`);
        return true;
      }
    }

    const groups = new Map();
    for (const entry of entries.filter((candidate) => /\.b64$/i.test(candidate.path))) {
      const directory = path.posix.dirname(entry.path);
      if (!groups.has(directory)) groups.set(directory, []);
      groups.get(directory).push(entry);
    }

    for (const [directory, groupEntries] of groups) {
      groupEntries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
      const signature = groupEntries.map((entry) => `${entry.path}:${entry.sha}`).join("|");
      if (seenTrees.has(signature)) continue;
      seenTrees.add(signature);

      const encodedBuffers = groupEntries.map((entry) => readBlob(entry.sha));
      const individuallyDecoded = encodedBuffers.map(decodeBase64Text);
      const candidates = [];
      if (individuallyDecoded.every(Boolean)) {
        candidates.push({ mode: "per-file-base64", bytes: Buffer.concat(individuallyDecoded) });
      }
      const joinedText = Buffer.concat(encodedBuffers).toString("utf8").replace(/\s+/g, "");
      if (joinedText && /^[A-Za-z0-9+/=]+$/.test(joinedText)) {
        candidates.push({ mode: "joined-base64", bytes: Buffer.from(joinedText, "base64") });
      }

      for (const candidate of candidates) {
        const decompressed = decompressXz(candidate.bytes);
        if (!decompressed) continue;
        const digest = sha256(decompressed);
        console.log(`JETWAY_HISTORY_DECOMPRESSED ${JSON.stringify({ commit, directory, files: groupEntries.length, mode: candidate.mode, compressedBytes: candidate.bytes.length, outputBytes: decompressed.length, outputSha256: digest })}`);
        if (decompressed.length === expected.bytes && digest === expected.sha256) {
          await saveExact(decompressed, `historical-transfer:${commit}:${directory}:${candidate.mode}`);
          return true;
        }
      }
    }
  }
  return false;
}

async function main() {
  try {
    const existing = await readFile(destination);
    if (exact(existing)) {
      console.log(`JETWAY_HISTORY_EXACT_ALREADY_PRESENT ${expected.bytes} ${expected.sha256}`);
      return;
    }
  } catch {}

  const objects = listReachableObjects();
  console.log(`JETWAY_HISTORY_OBJECTS ${objects.length}`);
  const namedCandidates = objects
    .filter((object) => object.type === "blob" && /jetway|airport_jetway|\.glb$|\.zip$/i.test(object.path))
    .sort((a, b) => b.size - a.size)
    .slice(0, 100);
  for (const candidate of namedCandidates) {
    console.log(`JETWAY_HISTORY_NAMED_BLOB ${candidate.size} ${candidate.sha} ${candidate.path}`);
  }

  if (await scanDirectBlobs(objects)) return;
  if (await scanHistoricalTransfers()) return;

  console.log(`JETWAY_HISTORY_EXACT_NOT_FOUND ${expected.bytes} ${expected.sha256}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
