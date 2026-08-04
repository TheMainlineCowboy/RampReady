import { readFile } from "node:fs/promises";

await import("./materialize-exact-airport-jetway.mjs");

const fleet = await readFile("src/environment/uploadedAirportJetwayFleet.js", "utf8");
for (const token of [
  'from "three/examples/jsm/loaders/GLTFLoader.js"',
  "models/airport-jetway/source/Airport_Jetway.gltf",
  'MODEL_AUTHORITY = "supplied-airport-jetway-gltf-source-hierarchy-uvs-v3"',
  'MATERIAL_AUTHORITY = "supplied-airport-jetway-clean-full-resolution-texture-set-v3"',
  'const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]',
  "meshCount !== 7 || uvMeshCount !== 7",
  "new THREE.InstancedMesh",
  "prototype.clone(true)",
]) {
  if (!fleet.includes(token)) throw new Error(`Supplied Airport Jetway runtime is missing ${token}`);
}
for (const forbidden of [
  "geometry.part",
  "DecompressionStream",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "M1DGJETWAY",
  "splitTunnelCSourceDetail",
  "source-triangle-stair-and-bogie-material-split",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Supplied Airport Jetway runtime still contains ${forbidden}`);
}
console.log("Prepared the supplied Airport Jetway glTF runtime with source hierarchy, UVs, materials and clean full-resolution textures.");
