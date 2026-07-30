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
  runways: 3,
  primitiveCount: 6,
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

const [bgl, inspector] = await Promise.all([
  download(SOURCE_BGL_PATH),
  download("scripts/inspect-kphx-adex.mjs"),
]);
if (bgl.length !== SOURCE_BGL_BYTES) throw new Error(`Unexpected KPHX ADEX source size ${bgl.length}`);
const sourceBlobSha = gitBlobSha1(bgl);
if (sourceBlobSha !== SOURCE_BGL_GIT_BLOB_SHA1) {
  throw new Error(`KPHX ADEX Git blob identity mismatch: ${sourceBlobSha} != ${SOURCE_BGL_GIT_BLOB_SHA1}`);
}

const bglPath = path.join(CACHE_DIR, "KPHX_ADEX.BGL");
const inspectorPath = path.join(CACHE_DIR, "inspect-kphx-adex.mjs");
const inspectionPath = path.join(CACHE_DIR, "inspection.json");
await writeFile(bglPath, bgl);
await writeFile(inspectorPath, inspector);

function run(script, args, label) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed (${result.status}):\n${result.stderr || result.stdout}`);
  return result.stdout;
}

run(inspectorPath, [bglPath, inspectionPath], "KPHX ADEX inspection");
run(path.resolve("scripts/decode-kphx-runways.mjs"), [bglPath, inspectionPath], "KPHX runway decoding");
run(path.resolve("scripts/build-kphx-simulator-ground.mjs"), [inspectionPath, OUTPUT_DIR], "KPHX simulator ground build");

const inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
const gltfPath = path.join(OUTPUT_DIR, "kphx-ground.gltf");
const binPath = path.join(OUTPUT_DIR, "kphx-ground.bin");
const groundManifestPath = path.join(OUTPUT_DIR, "ground-manifest.json");
const gltfBytes = await readFile(gltfPath);
const gltf = JSON.parse(gltfBytes.toString("utf8"));
const bin = await readFile(binPath);
const groundManifest = JSON.parse(await readFile(groundManifestPath, "utf8"));

if (inspection.selectedAirport !== "KPHX") throw new Error(`Decoded airport is ${inspection.selectedAirport}`);
if (inspection.selected.runways?.length !== EXPECTED.runways) throw new Error(`Decoded runway count is ${inspection.selected.runways?.length}`);
if (gltf?.nodes?.[0]?.name !== "PHX_KPHX_AuthoredGround") throw new Error("KPHX ground glTF root identity is missing");
if (gltf?.meshes?.[0]?.primitives?.length !== EXPECTED.primitiveCount) {
  throw new Error(`Unexpected KPHX ground primitive count ${gltf?.meshes?.[0]?.primitives?.length}`);
}
const materialNames = new Set((gltf.materials ?? []).map((material) => material.name));
for (const name of ["airport-base", "concrete", "asphalt", "yellow-marking", "white-marking"]) {
  if (!materialNames.has(name)) throw new Error(`KPHX simulator ground is missing material layer ${name}`);
}
if (!(bin.length > 594_240 && bin.length < 20_000_000)) throw new Error(`Unexpected enriched KPHX ground binary size ${bin.length}`);
for (const [key, expected] of Object.entries({
  taxiwayPoints: EXPECTED.taxiwayPoints,
  taxiwayPaths: EXPECTED.taxiwayPaths,
  parkings: EXPECTED.parkings,
  apronRecords: EXPECTED.apronRecords,
  apronTriangles: EXPECTED.apronTriangles,
  runways: EXPECTED.runways,
})) {
  if (groundManifest.counts?.[key] !== expected) throw new Error(`Unexpected KPHX ${key}: ${groundManifest.counts?.[key]} != ${expected}`);
}
for (const [key, minimum] of Object.entries({
  pathSurfaces: 500,
  markingSegments: 1_000,
  edgeMarkingSegments: 1,
  taxiwayJoinCount: 100,
  holdShortCount: 1,
  runwayMarkingElementCount: 20,
})) {
  if (!(groundManifest.counts?.[key] >= minimum)) throw new Error(`KPHX ${key} ${groundManifest.counts?.[key]} is below ${minimum}`);
}
if (groundManifest.anchor?.gate !== EXPECTED.anchorGate || groundManifest.anchor?.parkingIndex !== EXPECTED.anchorParkingIndex) {
  throw new Error("KPHX A1 ground anchor identity is wrong");
}
if (!nearlyEqual(groundManifest.anchor.headingDegrees, EXPECTED.anchorHeadingDegrees)) throw new Error("KPHX A1 heading drifted");
for (let axis = 0; axis < 2; axis += 1) {
  if (!nearlyEqual(groundManifest.bounds.min[axis], EXPECTED.boundsMin[axis])) throw new Error(`KPHX ground minimum bound ${axis} drifted`);
  if (!nearlyEqual(groundManifest.bounds.max[axis], EXPECTED.boundsMax[axis])) throw new Error(`KPHX ground maximum bound ${axis} drifted`);
}
for (const runway of groundManifest.runways ?? []) {
  if (!(runway.lengthMeters > 2_000 && runway.widthMeters >= 30 && runway.labels?.length === 2)) {
    throw new Error(`KPHX runway ${runway.primary}/${runway.secondary} runtime detail is incomplete`);
  }
}

const runtimeManifest = {
  schemaVersion: 2,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  sourcePath: SOURCE_BGL_PATH,
  sourceBytes: bgl.length,
  sourceGitBlobSha1: sourceBlobSha,
  sourceSha256: sha256(bgl),
  coordinateFrame: groundManifest.coordinateFrame,
  detailLevel: groundManifest.detailLevel,
  anchor: groundManifest.anchor,
  counts: groundManifest.counts,
  bounds: groundManifest.bounds,
  runways: groundManifest.runways,
  taxiwayNames: groundManifest.taxiwayNames,
  gltfBytes: gltfBytes.length,
  gltfSha256: sha256(gltfBytes),
  binBytes: bin.length,
  binSha256: sha256(bin),
  surfaceState: "source-driven KPHX apron, joined taxiway, runway, edge, centerline and hold-short geometry",
  remainingSourceLayers: ["derived taxiway signage from source graph", "source boundary-fence visualization"],
};
await writeFile(path.join(OUTPUT_DIR, "runtime-manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
console.log(`RampReady airport-wide KPHX simulator ground materialized: ${EXPECTED.runways} exact runways, ${groundManifest.counts.pathSurfaces} source-drawn path surfaces, ${groundManifest.counts.holdShortCount} hold shorts and ${groundManifest.counts.runwayMarkingElementCount} runway marking elements.`);
