import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SOURCE_COMMIT = "58115954e8d8294448e6e06d1be24d81a8e22764";
const SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${SOURCE_COMMIT}`;
const CACHE_DIR = path.resolve(".cache/kphx-source-objects");
const OUTPUT_DIR = path.resolve("public/models/kphx-source-objects");
const MODELS = Object.freeze({
  backhoe: Object.freeze({ bgl: "backhoe.BGL", guid: "{c51538ee-c3f4-4b36-bee4-7f72d39d2212}", expectedPlacements: 3 }),
  constrailer: Object.freeze({ bgl: "constrailer.BGL", guid: "{af61fc84-a60b-4de5-8383-b3e139d7f363}", expectedPlacements: 13 }),
  phxprkgrg: Object.freeze({ bgl: "phxprkgrg.BGL", guid: "{2d995757-e676-4593-be3c-7b67179e2abb}", expectedPlacements: 1 }),
  phxtermlink: Object.freeze({ bgl: "phxtermlink.BGL", guid: "{f958cc4a-cfb3-4c09-b1eb-6349eb64dc28}", expectedPlacements: 1 }),
  wncater: Object.freeze({ bgl: "wncater.BGL", guid: "{0b773edc-719e-4605-aa67-4bbdac6ff996}", expectedPlacements: 1 }),
});

async function download(relativePath) {
  const url = `${SOURCE_ROOT}/${relativePath}`;
  const response = await fetch(url, { headers: { "User-Agent": "RampReady-KPHX-Source-Objects" } });
  if (!response.ok) throw new Error(`Failed to download ${relativePath}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(script)} failed (${result.status}):\n${result.stderr || result.stdout}`);
}

await rm(CACHE_DIR, { recursive: true, force: true });
await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(CACHE_DIR, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const [extractor, inspector, placementBgl] = await Promise.all([
  download("scripts/extract-terminal4-mdlx.mjs"),
  download("scripts/inspect-fsx-placement-bgl.mjs"),
  download("scenery/PHX_Scenery.BGL"),
]);
const extractorPath = path.join(CACHE_DIR, "extract-mdlx.mjs");
const inspectorPath = path.join(CACHE_DIR, "inspect-placement.mjs");
const placementPath = path.join(CACHE_DIR, "PHX_Scenery.BGL");
const inspectionPath = path.join(CACHE_DIR, "phx-scenery.json");
await Promise.all([
  writeFile(extractorPath, extractor),
  writeFile(inspectorPath, inspector),
  writeFile(placementPath, placementBgl),
]);
runNode(inspectorPath, [placementPath, inspectionPath]);
const inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
if (inspection.libraryObjectPlacementCount !== 579) {
  throw new Error(`Expected 579 source scenery placements, received ${inspection.libraryObjectPlacementCount}`);
}

const placements = [];
const modelManifest = {};
for (const [modelId, profile] of Object.entries(MODELS)) {
  const modelDir = path.join(OUTPUT_DIR, modelId);
  const sourcePath = path.join(CACHE_DIR, profile.bgl);
  await mkdir(modelDir, { recursive: true });
  await writeFile(sourcePath, await download(`scenery/${profile.bgl}`));
  runNode(extractorPath, [sourcePath, modelDir]);
  const extraction = JSON.parse(await readFile(path.join(modelDir, "extraction-manifest.json"), "utf8"));
  const sourcePlacements = inspection.placementsByGuid?.[profile.guid] ?? [];
  if (sourcePlacements.length !== profile.expectedPlacements) {
    throw new Error(`${modelId} placement count ${sourcePlacements.length} != ${profile.expectedPlacements}`);
  }
  sourcePlacements.forEach((placement) => placements.push({
    model: modelId,
    source: "scenery/PHX_Scenery.BGL",
    longitude: placement.longitude,
    latitude: placement.latitude,
    headingDegrees: placement.headingDegrees,
    scale: placement.scale,
    altitudeMeters: placement.altitudeMetersCandidate,
  }));
  modelManifest[modelId] = {
    sourceBgl: `scenery/${profile.bgl}`,
    modelGuid: profile.guid,
    selectedModel: extraction.selectedModel,
    triangleCount: extraction.output?.triangleCount,
    partCount: extraction.output?.partCount,
    gltf: `${modelId}/terminal4.gltf`,
    bin: `${modelId}/terminal4.bin`,
  };
}

if (placements.length !== 19) throw new Error(`Expected 19 source object placements, received ${placements.length}`);
const manifest = {
  schemaVersion: 1,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  placementSource: "scenery/PHX_Scenery.BGL",
  placementCount: placements.length,
  modelCount: Object.keys(modelManifest).length,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  models: modelManifest,
  placements,
};
await writeFile(path.join(OUTPUT_DIR, "source-object-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`RampReady KPHX source objects materialized: ${manifest.modelCount} authored models and ${manifest.placementCount} exact placements.`);
