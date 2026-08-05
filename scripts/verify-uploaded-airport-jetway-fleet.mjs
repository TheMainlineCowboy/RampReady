import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

await import("./materialize-exact-airport-jetway.mjs");

const GLB_PATH = "public/models/airport-jetway/Airport_Jetway.glb";
const EXPECTED_GLB = Object.freeze({ bytes: 31_459_796, sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0" });
const EXPECTED_IMAGES = Object.freeze([
  { file: "Jetway_albedo.jpg", bytes: 4_374_151, sha256: "ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0" },
  { file: "Jetway_metallic.png", bytes: 9_300_055, sha256: "7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c" },
  { file: "Jetway_normal.png", bytes: 10_763_430, sha256: "9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1" },
  { file: "Jetway_AO.jpg", bytes: 3_529_816, sha256: "85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c" },
  { file: "Glass_JW_normal.png", bytes: 1_107_961, sha256: "823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794" },
  { file: "Glass_JW_AO.jpg", bytes: 88_646, sha256: "391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13" },
  { file: "Glass_JW_emissive.jpg", bytes: 185_984, sha256: "b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9" },
]);
const EXPECTED_MESHES = Object.freeze([
  "Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0",
  "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0", "Cab_Jetway_0", "Cab_Glass_JW_0",
]);
const EXPECTED_NODES = Object.freeze(["RootNode", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function requireIdentity(label, bytes, expected) {
  const digest = sha256(bytes);
  if (bytes.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(`${label} identity mismatch: ${bytes.length}/${digest}; expected ${expected.bytes}/${expected.sha256}`);
  }
}

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
    throw new Error("Exact Airport_Jetway.glb has an invalid GLB 2.0 header");
  }
  let cursor = 12;
  let json;
  let binary;
  while (cursor + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const payload = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(payload.toString("utf8").replace(/\u0000+$/g, "").trimEnd());
    if (type === 0x004e4942) binary = payload;
    cursor += 8 + length;
  }
  if (!json || !binary) throw new Error("Exact Airport_Jetway.glb is missing its JSON or BIN chunk");
  return { json, binary };
}

const glb = readFileSync(GLB_PATH);
requireIdentity("Airport_Jetway.glb", glb, EXPECTED_GLB);
const { json, binary } = parseGlb(glb);
if (json.meshes?.length !== 7 || json.materials?.length !== 2 || json.images?.length !== 7) {
  throw new Error(`Exact GLB structure changed: meshes=${json.meshes?.length}, materials=${json.materials?.length}, images=${json.images?.length}`);
}
const meshNames = new Set(json.meshes.map((mesh) => mesh.name));
const nodeNames = new Set(json.nodes.map((node) => node.name));
for (const name of EXPECTED_MESHES) if (!meshNames.has(name)) throw new Error(`Exact GLB is missing mesh ${name}`);
for (const name of EXPECTED_NODES) if (!nodeNames.has(name)) throw new Error(`Exact GLB is missing node ${name}`);
const materialNames = json.materials.map((material) => material.name).sort().join(",");
if (materialNames !== "Glass_JW,Jetway") throw new Error(`Exact GLB material names changed: ${materialNames}`);

const embeddedImages = json.images.map((image, index) => {
  const view = json.bufferViews?.[image.bufferView];
  if (!view) throw new Error(`Exact GLB image ${index} has no bufferView`);
  const bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  return { index, bytes, sha256: sha256(bytes) };
});
for (const expected of EXPECTED_IMAGES) {
  const embedded = embeddedImages.find((candidate) => candidate.bytes.length === expected.bytes && candidate.sha256 === expected.sha256);
  if (!embedded) throw new Error(`Exact embedded texture is missing: ${expected.file}`);
  requireIdentity(expected.file, readFileSync(`public/models/airport-jetway/${expected.file}`), expected);
}

function requireTokens(filePath, tokens) {
  const source = readFileSync(filePath, "utf8");
  for (const token of tokens) if (!source.includes(token)) throw new Error(`${filePath} is missing ${token}`);
  return source;
}

const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'new GLTFLoader().loadAsync(modelUrl())',
  "new THREE.InstancedMesh",
  "prototype.clone(true)",
  "placements.length !== 58",
  "staticPlacements.length !== 57",
]);
for (const forbidden of ["geometry.part", "DecompressionStream", "addProjectedUvs", "M1DGJETWAY", "decodeDeltaVarint", "decodeOctNormal", "geometry.bin", "new THREE.EdgesGeometry"]) {
  if (fleet.includes(forbidden)) throw new Error(`Exact Airport Jetway runtime contains retired substitute ${forbidden}`);
}
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "exact-uploaded-airport-jetway-complete-58-gates-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  "staticInstancedGateCount !== 57",
  "animatedIndividualGateCount !== 1",
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
console.log("Verified the exact 31,459,796-byte Airport_Jetway.glb, seven embedded source textures, seven authored meshes, two authored materials, 57 static instances, and one individually animated A1 model.");
