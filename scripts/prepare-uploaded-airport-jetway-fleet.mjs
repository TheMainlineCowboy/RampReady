import { readFile } from "node:fs/promises";

await import("./materialize-exact-airport-jetway.mjs");

const fleet = await readFile("src/environment/uploadedAirportJetwayFleet.js", "utf8");
for (const token of [
  'MODEL_AUTHORITY = "supplied-airport-jetway-source-triangles-hierarchy-submillimeter-v4"',
  'MATERIAL_AUTHORITY = "supplied-airport-jetway-source-atlas-full-resolution-avif-v4"',
  'PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v4"',
  "decodeDeltaVarint",
  "decodeOctNormal",
  "metadata.validation?.triangleCount !== 31978",
  'fetch(`${rootUrl}geometry.bin`',
  "new THREE.InstancedMesh",
  "prototype.clone(true)",
]) {
  if (!fleet.includes(token)) throw new Error(`Supplied Airport Jetway runtime is missing ${token}`);
}
for (const forbidden of [
  "geometry.part", "DecompressionStream", "addProjectedUvs", "cloneCorrugatedAtlasBand",
  "M1DGJETWAY", "splitTunnelCSourceDetail", "source-triangle-stair-and-bogie-material-split",
  "GLTFLoader", "new THREE.EdgesGeometry",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Supplied Airport Jetway runtime still contains ${forbidden}`);
}
console.log("Prepared the supplied Airport Jetway source runtime with 31,978 retained triangles, source hierarchy, UVs and full-resolution material maps.");
