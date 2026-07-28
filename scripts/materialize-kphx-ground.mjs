import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SOURCE_COMMIT = "7ee8f9b4712f842706f00aa5a307e8861b601620";
const SOURCE_BGL_PATH = "scenery/KPHX_ADEX.BGL";
const SOURCE_BGL_BYTES = 183_319;
const SOURCE_BGL_GIT_BLOB_SHA1 = "fa185427e154eb92058e755b9fbdb1ad799317ed";
const SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${SOURCE_COMMIT}`;
const OUTPUT_DIR = path.resolve("public/models/kphx-ground");
const CACHE_DIR = path.resolve(".cache/kphx-ground-source");
const EXPECTED = Object.freeze({
  taxiwayPoints: 870,
  taxiwayPaths: 1302,
  parkings: 240,
  apronRecords: 170,
  apronTriangles: 1860,
  pathSurfaces: 958,
  markingSegments: 1208,
  primitiveCount: 6,
  binBytes: 594_240,
  anchorGate: "A1",
  anchorParkingIndex: 32,
  anchorHeadingDegrees: 269.975341796875,
  boundsMin: [-1650.5247567653073, -3247.8339468591594],
  boundsMax: [822.929705400318, 960.5877534881246],
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const gitBlobSha1 = (bytes) => createHash("sha1")
  .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
  .update(bytes)
  .digest("hex");
const nearlyEqual = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

async function download(relativePath) {
  const url = `${SOURCE_ROOT}/${relativePath}`;
  const response = await fetch(url, { headers: { "User-Agent": "RampReady-KPHX-Ground-Materializer" } });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

await rm(CACHE_DIR, { recursive: true, force: true });
await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(CACHE_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const [bgl, inspector, builder] = await Promise.all([
  download(SOURCE_BGL_PATH),
  download("scripts/inspect-kphx-adex.mjs"),
  download("scripts/build-kphx-ground-gltf.mjs"),
]);
if (bgl.length !== SOURCE_BGL_BYTES) throw new Error(`Unexpected KPHX ADEX source size ${bgl.length}`);
const sourceBlobSha = gitBlobSha1(bgl);
if (sourceBlobSha !== SOURCE_BGL_GIT_BLOB_SHA1) {
  throw new Error(`KPHX ADEX Git blob identity mismatch: ${sourceBlobSha} != ${SOURCE_BGL_GIT_BLOB_SHA1}`);
}

const bglPath = path.join(CACHE_DIR, "KPHX_ADEX.BGL");
const inspectorPath = path.join(CACHE_DIR, "inspect-kphx-adex.mjs");
const builderPath = path.join(CACHE_DIR, "build-kphx-ground-gltf.mjs");
const inspectionPath = path.join(CACHE_DIR, "inspection.json");
await writeFile(bglPath, bgl);
await writeFile(inspectorPath, inspector);
await writeFile(builderPath, builder);

function run(script, args, label) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

run(inspectorPath, [bglPath, inspectionPath], "KPHX ADEX inspection");
run(builderPath, [inspectionPath, OUTPUT_DIR], "KPHX ground build");

const inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
const gltfPath = path.join(OUTPUT_DIR, "kphx-ground.gltf");
const binPath = path.join(OUTPUT_DIR, "kphx-ground.bin");
const groundManifestPath = path.join(OUTPUT_DIR, "ground-manifest.json");
const gltfBytes = await readFile(gltfPath);
const gltf = JSON.parse(gltfBytes.toString("utf8"));
const bin = await readFile(binPath);
const groundManifest = JSON.parse(await readFile(groundManifestPath, "utf8"));

if (inspection.selectedAirport !== "KPHX") throw new Error(`Decoded airport is ${inspection.selectedAirport}`);
if (gltf?.nodes?.[0]?.name !== "PHX_KPHX_AuthoredGround") throw new Error("KPHX ground glTF root identity is missing");
if (gltf?.meshes?.[0]?.primitives?.length !== EXPECTED.primitiveCount) {
  throw new Error(`Unexpected KPHX ground primitive count ${gltf?.meshes?.[0]?.primitives?.length}`);
}
if (bin.length !== EXPECTED.binBytes) throw new Error(`Unexpected KPHX ground binary size ${bin.length}`);
for (const [key, expected] of Object.entries({
  taxiwayPoints: EXPECTED.taxiwayPoints,
  taxiwayPaths: EXPECTED.taxiwayPaths,
  parkings: EXPECTED.parkings,
  apronRecords: EXPECTED.apronRecords,
  apronTriangles: EXPECTED.apronTriangles,
  pathSurfaces: EXPECTED.pathSurfaces,
  markingSegments: EXPECTED.markingSegments,
})) {
  if (groundManifest.counts?.[key] !== expected) throw new Error(`Unexpected KPHX ${key}: ${groundManifest.counts?.[key]} != ${expected}`);
}
if (groundManifest.anchor?.gate !== EXPECTED.anchorGate || groundManifest.anchor?.parkingIndex !== EXPECTED.anchorParkingIndex) {
  throw new Error("KPHX A1 ground anchor identity is wrong");
}
if (!nearlyEqual(groundManifest.anchor.headingDegrees, EXPECTED.anchorHeadingDegrees)) throw new Error("KPHX A1 heading drifted");
for (let axis = 0; axis < 2; axis += 1) {
  if (!nearlyEqual(groundManifest.bounds.min[axis], EXPECTED.boundsMin[axis])) throw new Error(`KPHX ground minimum bound ${axis} drifted`);
  if (!nearlyEqual(groundManifest.bounds.max[axis], EXPECTED.boundsMax[axis])) throw new Error(`KPHX ground maximum bound ${axis} drifted`);
}

const runtimeManifest = {
  schemaVersion: 1,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  sourcePath: SOURCE_BGL_PATH,
  sourceBytes: bgl.length,
  sourceGitBlobSha1: sourceBlobSha,
  sourceSha256: sha256(bgl),
  coordinateFrame: groundManifest.coordinateFrame,
  anchor: groundManifest.anchor,
  counts: groundManifest.counts,
  bounds: groundManifest.bounds,
  gltfBytes: gltfBytes.length,
  gltfSha256: sha256(gltfBytes),
  binBytes: bin.length,
  binSha256: sha256(bin),
  surfaceState: "authoritative ADEX apron/taxiway/runway/service-road geometry with source markings",
  missingSourceLayers: ["PHXPhoto.bgl payload", "PHX_TERM400 DDS texture maps"],
};
await writeFile(path.join(OUTPUT_DIR, "runtime-manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
console.log(`RampReady airport-wide KPHX ground materialized: ${EXPECTED.apronTriangles} apron triangles, ${EXPECTED.pathSurfaces} path surfaces, ${EXPECTED.markingSegments} marking segments.`);