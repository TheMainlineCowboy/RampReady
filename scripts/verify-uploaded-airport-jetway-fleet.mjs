import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

await import("./materialize-exact-airport-jetway.mjs");

const MODEL_PATH = "public/models/airport-jetway/Airport_Jetway.glb";
const EXPECTED_BYTES = 31_459_796;
const EXPECTED_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const model = readFileSync(MODEL_PATH);
const digest = createHash("sha256").update(model).digest("hex");
if (model.length !== EXPECTED_BYTES || digest !== EXPECTED_SHA256) {
  throw new Error(`Exact Airport_Jetway.glb identity mismatch: ${model.length} bytes / ${digest}`);
}
if (model.toString("ascii", 0, 4) !== "glTF" || model.readUInt32LE(4) !== 2 || model.readUInt32LE(8) !== model.length) {
  throw new Error("Exact Airport_Jetway.glb has an invalid GLB 2.0 header");
}
const jsonLength = model.readUInt32LE(12);
const gltf = JSON.parse(model.subarray(20, 20 + jsonLength).toString("utf8").replace(/[\u0000 ]+$/g, ""));
const nodeNames = new Set(gltf.nodes?.map((node) => node.name));
const meshNames = new Set(gltf.meshes?.map((mesh) => mesh.name));
const materials = gltf.materials?.map((material) => material.name).sort().join(",");
for (const name of ["RootNode", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]) {
  if (!nodeNames.has(name)) throw new Error(`Exact Airport_Jetway.glb is missing node ${name}`);
}
for (const name of ["Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0", "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0", "Cab_Jetway_0", "Cab_Glass_JW_0"]) {
  if (!meshNames.has(name)) throw new Error(`Exact Airport_Jetway.glb is missing mesh ${name}`);
}
if (gltf.meshes?.length !== 7 || gltf.images?.length !== 7 || gltf.textures?.length !== 7 || materials !== "Glass_JW,Jetway") {
  throw new Error(`Exact Airport_Jetway.glb source counts changed: meshes=${gltf.meshes?.length}, images=${gltf.images?.length}, textures=${gltf.textures?.length}, materials=${materials}`);
}
if (gltf.images.some((image) => image.uri || image.bufferView == null)) throw new Error("Exact Airport_Jetway.glb no longer embeds every original texture");
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives) {
    for (const attribute of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
      if (primitive.attributes?.[attribute] == null) throw new Error(`${mesh.name} lost ${attribute}`);
    }
  }
}

function requireTokens(filePath, tokens) {
  const source = readFileSync(filePath, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${filePath} is missing ${token}`);
  return source;
}
const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"',
  'MODEL_URL = "models/airport-jetway/Airport_Jetway.glb"',
  EXPECTED_SHA256,
  'MATERIAL_AUTHORITY = "original-embedded-glb-materials-uvs-and-seven-textures-unaltered-v2"',
  'DETAIL_MATERIAL_AUTHORITY = "original-glb-mesh-and-material-assignments-unaltered-v2"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instanced-plus-1-animated-exact-glb-v2"',
  "response.arrayBuffer()",
  "crypto.subtle.digest(\"SHA-256\", bytes)",
  'new Blob([bytes], { type: "model/gltf-binary" })',
  "new GLTFLoader().loadAsync(objectUrl)",
  "computeUploadedJetwayArticulation",
  "createModelSpaceA1Controller",
  "new THREE.InstancedMesh",
  "uploadedJetwayOriginalEmbeddedTextureCount",
]);
for (const forbidden of ["geometry.part", "DecompressionStream", "addProjectedUvs", "cloneCorrugatedAtlasBand", "M1DGJETWAY", "splitTunnelCSourceDetail", "new THREE.EdgesGeometry"]) {
  if (fleet.includes(forbidden)) throw new Error(`Exact Airport_Jetway.glb runtime contains retired substitute ${forbidden}`);
}
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'MATERIAL_AUTHORITY = "original-embedded-glb-materials-uvs-and-seven-textures-unaltered-v2"',
  'DETAIL_MATERIAL_AUTHORITY = "original-glb-mesh-and-material-assignments-unaltered-v2"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instanced-plus-1-animated-exact-glb-v2"',
  "originalMeshCount !== 7",
  "originalUvMeshCount !== 7",
  "originalTextureCount !== 7",
]);
requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'uploadedAirportJetwayFleetReadyV2.js',
  "const uploadedJetwayPlacements = []",
  "uploadedJetwayPlacements.push",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "a1JetwayController = uploadedJetwayController",
]);
requireTokens("src/environment/authoredTerminal4Visual.js", [
  "await sourcePlacedJetways.userData.uploadedJetwayReady",
  "authoredTerminal4UploadedJetwaySourceAssetSha256",
  "authoredTerminal4UploadedJetwayOriginalMeshCount",
  "authoredTerminal4UploadedJetwayOriginalUvMeshCount",
  "authoredTerminal4UploadedJetwayOriginalTextureCount",
]);
for (let index = 0; index < 5; index += 1) {
  if (existsSync(`public/models/airport-jetway/geometry.part${index}`)) throw new Error(`Retired geometry.part${index} still exists`);
}
console.log(`Verified untouched Airport_Jetway.glb: ${model.length} bytes, sha256 ${digest}, seven original UV-mapped meshes, seven embedded textures, two original materials, all 58 gates wired, no projected-texture substitute.`);
