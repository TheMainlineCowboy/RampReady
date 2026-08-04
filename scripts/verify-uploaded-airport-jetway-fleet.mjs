import { existsSync, readFileSync, statSync } from "node:fs";

await import("./materialize-exact-airport-jetway.mjs");
const ROOT = "public/models/airport-jetway/source";
const geometry = readFileSync(`${ROOT}/geometry.bin`);
const metadataLength = geometry.readUInt32LE(0);
const metadata = JSON.parse(geometry.subarray(4, 4 + metadataLength).toString("utf8"));
const descriptor = JSON.parse(readFileSync(`${ROOT}/materials.json`, "utf8"));
const expectedMeshes = [
  "Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0",
  "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0", "Cab_Jetway_0", "Cab_Glass_JW_0",
];
const expectedNodes = ["RootNode", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
const expectedImages = [
  "Jetway_albedo.avif", "Jetway_metallic.avif", "Jetway_normal.avif", "Jetway_AO.avif",
  "Glass_JW_normal.avif", "Glass_JW_AO.avif", "Glass_JW_emissive.avif",
];
const meshNames = new Set(metadata.meshes?.map((mesh) => mesh.name));
const nodeNames = new Set(metadata.nodes?.map((node) => node.name));
for (const name of expectedNodes) if (!nodeNames.has(name)) throw new Error(`Supplied Airport Jetway source is missing node ${name}`);
for (const name of expectedMeshes) if (!meshNames.has(name)) throw new Error(`Supplied Airport Jetway source is missing mesh ${name}`);
if (metadata.version !== 2 || metadata.meshes?.length !== 7 || metadata.validation?.triangleCount !== 31_978) {
  throw new Error(`Supplied Airport Jetway topology changed: ${metadata.version}/${metadata.meshes?.length}/${metadata.validation?.triangleCount}`);
}
if (metadata.validation.maxPositionAbsErrorMeters > 0.0001 || metadata.validation.maxUvAbsError > 0.000008) {
  throw new Error(`Supplied Airport Jetway source error tolerance changed: ${JSON.stringify(metadata.validation)}`);
}
if (descriptor.materials?.map((material) => material.name).sort().join(",") !== "Glass_JW,Jetway") {
  throw new Error("Supplied Airport Jetway original material names changed");
}
if (descriptor.images?.length !== 7 || descriptor.textures?.length !== 7) throw new Error("Supplied Airport Jetway texture count changed");
for (const image of expectedImages) {
  const file = `${ROOT}/images/${image}`;
  if (!existsSync(file) || statSync(file).size < 500) throw new Error(`Supplied Airport Jetway texture is missing or truncated: ${image}`);
}

function requireTokens(filePath, tokens) {
  const source = readFileSync(filePath, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${filePath} is missing ${token}`);
  return source;
}
const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  'MODEL_AUTHORITY = "supplied-airport-jetway-source-triangles-hierarchy-submillimeter-v4"',
  'MATERIAL_AUTHORITY = "supplied-airport-jetway-source-atlas-full-resolution-avif-v4"',
  'PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v4"',
  "decodeDeltaVarint",
  "decodeOctNormal",
  "metadata.validation?.triangleCount !== 31978",
  "new THREE.InstancedMesh",
  "prototype.clone(true)",
]);
for (const forbidden of [
  "geometry.part", "DecompressionStream", "addProjectedUvs", "cloneCorrugatedAtlasBand",
  "M1DGJETWAY", "splitTunnelCSourceDetail", "source-triangle-stair-and-bogie-material-split",
  "GLTFLoader", "new THREE.EdgesGeometry",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Supplied Airport Jetway runtime contains retired substitute ${forbidden}`);
}
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "supplied-airport-jetway-complete-58-gates-source-hierarchy-v9"',
  "sourceTriangleCount !== 31_978",
  "maximumPositionErrorMeters > 0.0001",
  "maximumUvError > 0.000008",
  "staticPrimitiveBatchCount !== 7",
]);
requireTokens("src/environment/uploadedAirportJetwayExactModelGuard.js", [
  'EXACT_MODEL_AUTHORITY = "supplied-airport-jetway-source-hierarchy-meshes-uvs-exclusive-v10"',
  '"Tunnel_C_Jetway_0"', '"Cab_Glass_JW_0"', "sourceMeshCount !== 7 || uvMeshCount !== 7",
]);
requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'uploadedAirportJetwayFleetReadyV2.js', "const uploadedJetwayPlacements = []",
  "uploadedJetwayPlacements.push", "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
  "a1JetwayController = uploadedJetwayController",
]);
for (let index = 0; index < 5; index += 1) if (existsSync(`public/models/airport-jetway/geometry.part${index}`)) throw new Error(`Retired geometry.part${index} still exists`);
if (existsSync("public/models/airport-jetway/Airport_Jetway.glb")) throw new Error("Retired monolithic Airport_Jetway.glb still exists");
if (existsSync(`${ROOT}/Airport_Jetway.gltf`) || existsSync(`${ROOT}/Airport_Jetway.bin`)) throw new Error("Retired intermediate glTF source still exists");
console.log(`Verified supplied Airport Jetway source: 31,978 retained triangles, seven source UV meshes, two original materials, seven full-resolution textures, all 58 gates wired, and no projected substitute.`);
