import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CHUNK_COUNT = 9;
const CHUNK_ROOT = path.resolve(".jetway-source-staging");
const OUTPUT_PATH = path.resolve("public/models/airport-jetway/Airport_Jetway.glb");
const EXPECTED_BYTES = 31_459_796;
const EXPECTED_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const encodedParts = [];
for (let index = 0; index < CHUNK_COUNT; index += 1) {
  const chunkPath = path.join(CHUNK_ROOT, `chunk${String(index).padStart(3, "0")}.b64`);
  encodedParts.push((await readFile(chunkPath, "utf8")).trim());
}
const compressed = Buffer.from(encodedParts.join(""), "base64");
if (compressed.subarray(0, 6).toString("hex") !== "fd377a585a00") {
  throw new Error("Exact Airport_Jetway.glb staging payload is not the expected XZ stream");
}
const result = spawnSync("xz", ["-dc"], {
  input: compressed,
  encoding: null,
  maxBuffer: 64 * 1024 * 1024,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Exact Airport_Jetway.glb XZ reconstruction failed: ${String(result.stderr || "").trim()}`);
}
const model = Buffer.from(result.stdout);
const digest = sha256(model);
if (model.length !== EXPECTED_BYTES || digest !== EXPECTED_SHA256) {
  throw new Error(`Exact Airport_Jetway.glb reconstruction mismatch: ${model.length} bytes / ${digest}`);
}
if (model.toString("ascii", 0, 4) !== "glTF" || model.readUInt32LE(4) !== 2 || model.readUInt32LE(8) !== model.length) {
  throw new Error("Exact Airport_Jetway.glb reconstruction has an invalid GLB 2.0 header");
}

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
let currentMatches = false;
try {
  const current = await readFile(OUTPUT_PATH);
  currentMatches = current.length === model.length && sha256(current) === EXPECTED_SHA256;
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
if (!currentMatches) await writeFile(OUTPUT_PATH, model);
for (let index = 0; index < 5; index += 1) {
  await rm(path.resolve(`public/models/airport-jetway/geometry.part${index}`), { force: true });
}
const outputStat = await stat(OUTPUT_PATH);
if (outputStat.size !== EXPECTED_BYTES) throw new Error("Exact Airport_Jetway.glb output size changed after write");
console.log(`Materialized untouched user-supplied Airport_Jetway.glb: ${EXPECTED_BYTES} bytes, sha256 ${EXPECTED_SHA256}.`);
