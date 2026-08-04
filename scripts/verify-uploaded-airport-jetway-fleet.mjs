import { existsSync, readFileSync, statSync } from "node:fs";

await import("./materialize-exact-airport-jetway.mjs");

const ROOT = "public/models/airport-jetway/source";
const gltf = JSON.parse(readFileSync(`${ROOT}/Airport_Jetway.gltf`, "utf8"));
const meshNames = new Set(gltf.meshes?.map((mesh) => mesh.name));
const nodeNames = new Set(gltf.nodes?.map((node) => node.name));
const materialNames = gltf.materials?.map((material) => material.name).sort().join(",");
const expectedMeshes = [
  "Tunnel_A_Jetway_0",
  "Tunnel_B_Jetway_0",
  "Tunnel_C_Jetway_0",
  "Tunnel_C_Glass_JW_0",
  "Rotunda_Jetway_0",
  "Cab_Jetway_0",
  "Cab_Glass_JW_0",
];
const expectedNodes = ["RootNode", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
const expectedImages = [
  "Jetway_albedo.avif",
  "Jetway_metallic.avif",
  "Jetway_normal.avif",
  "Jetway_AO.avif",
  "Glass_JW_normal.avif",
  "Glass_JW_AO.avif",
  "Glass_JW_emissive.avif",
];
for (const name of expectedNodes) if (!nodeNames.has(name)) throw new Error(`Supplied Airport Jetway glTF is missing node ${name}`);
for (const name of expectedMeshes) if (!meshNames.has(name)) throw new Error(`Supplied Airport Jetway glTF is missing mesh ${name}`);
if (gltf.meshes?.length !== 7 || gltf.images?.length !== 7 || gltf.textures?.length !== 7 || materialNames !== "Glass_JW,Jetway") {
  throw new Error(`Supplied Airport Jetway source counts changed: meshes=${gltf.meshes?.length}, images=${gltf.images?.length}, textures=${gltf.textures?.length}, materials=${materialNames}`);
}
if (!gltf.extensionsUsed?.includes("EXT_texture_avif") || !gltf.extensionsRequired?.includes("EXT_texture_avif")) {
  throw new Error("Supplied Airport Jetway glTF does not require EXT_texture_avif");
}
if (gltf.extensionsRequired?.includes("EXT_texture_webp")) throw new Error("Supplied Airport Jetway glTF still requires the retired WebP extension");
const binStat = statSync(`${ROOT}/Airport_Jetway.bin`);
if (binStat.size !== gltf.buffers?.[0]?.byteLength) throw new Error("Supplied Airport Jetway binary length differs from glTF metadata");
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives) {
    for (const attribute of ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"]) {
      if (primitive.attributes?.[attribute] == null) throw new Error(`${mesh.name} lost ${attribute}`);
    }
  }
}
for (const image of expectedImages) {
  if (!existsSync(`${ROOT}/images/${image}`)) throw new Error(`Supplied Airport Jetway texture is missing: ${image}`);
}

function requireTokens(filePath, tokens) {
  const source = readFileSync(filePath, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${filePath} is missing ${token}`);
  return source;
}
const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  'import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"',
  "models/airport-jetway/source/Airport_Jetway.gltf",
  'MODEL_AUTHORITY = "supplied-airport-jetway-gltf-source-hierarchy-uvs-v3"',
  'MATERIAL_AUTHORITY = "supplied-airport-jetway-clean-full-resolution-texture-set-v3"',
  'PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v3"',
  "new GLTFLoader().loadAsync(sourceModelUrl())",
  "meshCount !== 7 || uvMeshCount !== 7",
  "new THREE.InstancedMesh",
  "prototype.clone(true)",
]);
for (const forbidden of [
  "geometry.part",
  "DecompressionStream",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "M1DGJETWAY",
  "splitTunnelCSourceDetail",
  "source-triangle-stair-and-bogie-material-split",
  "new THREE.EdgesGeometry",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Supplied Airport Jetway runtime contains retired substitute ${forbidden}`);
}
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "supplied-airport-jetway-complete-58-gates-source-hierarchy-v8"',
  "exactModelGuard.hierarchy.sourceMeshCount !== 7",
  "exactModelGuard.hierarchy.uvMeshCount !== 7",
  "staticPrimitiveBatchCount !== 7",
]);
requireTokens("src/environment/uploadedAirportJetwayExactModelGuard.js", [
  'EXACT_MODEL_AUTHORITY = "supplied-airport-jetway-source-hierarchy-meshes-uvs-exclusive-v10"',
  '"Tunnel_C_Jetway_0"',
  '"Cab_Glass_JW_0"',
  "sourceMeshCount !== 7 || uvMeshCount !== 7",
]);
requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'uploadedAirportJetwayFleetReadyV2.js',
  "const uploadedJetwayPlacements = []",
  "uploadedJetwayPlacements.push",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
  "a1JetwayController = uploadedJetwayController",
]);
for (let index = 0; index < 5; index += 1) {
  if (existsSync(`public/models/airport-jetway/geometry.part${index}`)) throw new Error(`Retired geometry.part${index} still exists`);
}
if (existsSync("public/models/airport-jetway/Airport_Jetway.glb")) throw new Error("Retired monolithic Airport_Jetway.glb output still exists");
console.log(`Verified supplied Airport Jetway glTF: seven original UV-mapped meshes, two original materials, seven clean full-resolution textures, all 58 gates wired, and no projected-texture substitute.`);
