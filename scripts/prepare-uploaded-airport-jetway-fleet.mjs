import { readFile } from "node:fs/promises";

await import("./materialize-exact-airport-jetway.mjs");

const fleet = await readFile("src/environment/uploadedAirportJetwayFleet.js", "utf8");
for (const token of [
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'new GLTFLoader().loadAsync(modelUrl())',
  'new THREE.InstancedMesh',
  'prototype.clone(true)',
  'placements.length !== 58',
  'staticPlacements.length !== 57',
  'uploadedJetwayAnimatedIndividualGateCount = 1',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
]) {
  if (!fleet.includes(token)) throw new Error(`Exact Airport Jetway runtime is missing ${token}`);
}
for (const forbidden of [
  "geometry.part",
  "DecompressionStream",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "M1DGJETWAY",
  "splitTunnelCSourceDetail",
  "source-triangle-stair-and-bogie-material-split",
  "new THREE.EdgesGeometry",
  "decodeDeltaVarint",
  "decodeOctNormal",
  "geometry.bin",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Exact Airport Jetway runtime still contains ${forbidden}`);
}
console.log("Prepared the untouched exact Airport_Jetway.glb runtime for 57 static gates and the individually animated A1 gate.");
