#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "assets", "kphx-source", "exact-kphx-manifest.json");
const stagingRoot = path.join(repoRoot, "assets", "kphx-source", "terminal4b-runtime");
const outputPath = path.join(repoRoot, "public", "models", "kphx", "Terminal4b.exact.glb");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function decodeParts() {
  const names = (await readdir(stagingRoot)).filter((name) => /^part-\d{3}\.b64$/.test(name)).sort();
  if (!names.length) throw new Error("No Terminal4b runtime transfer parts are present");
  const pieces = [];
  for (const name of names) {
    const encoded = (await readFile(path.join(stagingRoot, name), "utf8")).replace(/\s+/g, "");
    const decoded = Buffer.from(encoded, "base64");
    if (!decoded.length) throw new Error(`${name} decoded to an empty payload`);
    pieces.push(decoded);
  }
  return { names, compressed: Buffer.concat(pieces) };
}

function decompressXz(bytes) {
  if (bytes.subarray(0, 6).toString("hex") !== "fd377a585a00") throw new Error("Terminal4b transfer is missing the XZ header");
  const result = spawnSync("xz", ["--decompress", "--stdout"], { input: bytes, encoding: null, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr?.toString("utf8").trim() || `xz exited ${result.status}`);
  return Buffer.from(result.stdout);
}

function verifyGlb(bytes, expected) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Terminal4b output is not a GLB");
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB version ${bytes.readUInt32LE(4)}`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB header length mismatch");
  const actual = { bytes: bytes.length, sha256: sha256(bytes) };
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error(`Terminal4b exact runtime identity mismatch: ${actual.bytes}/${actual.sha256}; expected ${expected.bytes}/${expected.sha256}`);
  }
  return actual;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const { names, compressed } = await decodeParts();
  const output = decompressXz(compressed);
  const identity = verifyGlb(output, manifest.terminal4North.runtimeGlb);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
  console.log(`[exact-kphx] Materialized Terminal 4 North from ${names.length} source parts.`);
  console.log(`[exact-kphx] Verified ${identity.bytes} bytes ${identity.sha256}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
