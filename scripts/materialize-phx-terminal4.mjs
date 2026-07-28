import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const SOURCE_BGL_SHA256 = "57140405cac64a0ce7f73a875d490307cf44f74f47b996441666dd0abad37df9";
const SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${SOURCE_COMMIT}`;
const SOURCE_BGL_URL = `${SOURCE_ROOT}/scenery/term4.BGL`;
const EXTRACTOR_URL = `${SOURCE_ROOT}/scripts/extract-terminal4-mdlx.mjs`;
const OUTPUT_DIR = path.resolve("public/models/phx-terminal4");
const CACHE_DIR = path.resolve(".cache/phx-terminal4-source");
const EXPECTED = Object.freeze({
  modelName: "phx_term400",
  triangleCount: 11138,
  partCount: 19,
  embeddedModelCount: 1,
  boundsMin: [-361.947998046875, 0, -213.22799682617188],
  boundsMax: [488.2799987792969, 30.215999603271484, 266.8240051269531],
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const nearlyEqual = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "RampReady-Terminal4-Materializer" } });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

await rm(CACHE_DIR, { recursive: true, force: true });
await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(CACHE_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const [bgl, extractor] = await Promise.all([download(SOURCE_BGL_URL), download(EXTRACTOR_URL)]);
const sourceHash = sha256(bgl);
if (sourceHash !== SOURCE_BGL_SHA256) {
  throw new Error(`Terminal 4 source identity mismatch: ${sourceHash} != ${SOURCE_BGL_SHA256}`);
}

const bglPath = path.join(CACHE_DIR, "term4.BGL");
const extractorPath = path.join(CACHE_DIR, "extract-terminal4-mdlx.mjs");
await writeFile(bglPath, bgl);
await writeFile(extractorPath, extractor);

const result = spawnSync(process.execPath, [extractorPath, bglPath, OUTPUT_DIR], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 60_000,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Terminal 4 extractor failed (${result.status}):\n${result.stderr || result.stdout}`);
}

const manifestPath = path.join(OUTPUT_DIR, "extraction-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const gltf = JSON.parse(await readFile(path.join(OUTPUT_DIR, "terminal4.gltf"), "utf8"));
const bin = await readFile(path.join(OUTPUT_DIR, "terminal4.bin"));

if (manifest.sourceSha256 !== SOURCE_BGL_SHA256) throw new Error("Terminal 4 extraction manifest source SHA mismatch");
if (manifest.embeddedModelCount !== EXPECTED.embeddedModelCount) throw new Error(`Unexpected embedded model count ${manifest.embeddedModelCount}`);
if (manifest.selectedModel !== EXPECTED.modelName) throw new Error(`Unexpected Terminal 4 model ${manifest.selectedModel}`);
if (manifest.output?.triangleCount !== EXPECTED.triangleCount) throw new Error(`Unexpected Terminal 4 triangle count ${manifest.output?.triangleCount}`);
if (manifest.output?.partCount !== EXPECTED.partCount || manifest.output?.skipped !== 0) throw new Error("Terminal 4 did not preserve all authored parts");
if (gltf?.nodes?.[0]?.name !== "PHX_Terminal4_Authored") throw new Error("Terminal 4 glTF root identity is missing");
if (gltf?.meshes?.[0]?.primitives?.length !== EXPECTED.partCount) throw new Error(`Terminal 4 primitive count is ${gltf?.meshes?.[0]?.primitives?.length}`);
if (bin.length !== 1_069_248) throw new Error(`Unexpected Terminal 4 binary size ${bin.length}`);

for (let i = 0; i < 3; i += 1) {
  if (!nearlyEqual(manifest.output.bounds.min[i], EXPECTED.boundsMin[i])) throw new Error(`Terminal 4 min bound ${i} drifted`);
  if (!nearlyEqual(manifest.output.bounds.max[i], EXPECTED.boundsMax[i])) throw new Error(`Terminal 4 max bound ${i} drifted`);
  if (!nearlyEqual(manifest.output.declaredBounds.min[i], manifest.output.bounds.min[i])) throw new Error(`Terminal 4 reconstructed/declaration min bound mismatch ${i}`);
  if (!nearlyEqual(manifest.output.declaredBounds.max[i], manifest.output.bounds.max[i])) throw new Error(`Terminal 4 reconstructed/declaration max bound mismatch ${i}`);
}

const runtimeManifest = {
  schemaVersion: 1,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  sourcePath: "scenery/term4.BGL",
  sourceBytes: bgl.length,
  sourceSha256: sourceHash,
  modelName: EXPECTED.modelName,
  triangleCount: EXPECTED.triangleCount,
  partCount: EXPECTED.partCount,
  bounds: manifest.output.bounds,
  gltfBytes: Buffer.byteLength(JSON.stringify(gltf)),
  binBytes: bin.length,
  binSha256: sha256(bin),
  texturesReferenced: manifest.output.textureNames,
  textureStatus: "source-material-colors-active; original Terminal 4 texture recovery pending",
};
await writeFile(path.join(OUTPUT_DIR, "runtime-manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
console.log(`RampReady real PHX Terminal 4 materialized: ${EXPECTED.triangleCount} triangles, ${EXPECTED.partCount} parts, source ${sourceHash}.`);
