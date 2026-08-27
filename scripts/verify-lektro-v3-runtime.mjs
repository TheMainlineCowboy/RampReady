import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const authorityPath = path.join(root, "public/models/lektro-88-v3/authority.json");
const runtimePath = path.join(root, "public/models/lektro-88-v3.glb");

function fail(message) {
  throw new Error(`Lektro 88 Revised V3 verification failed: ${message}`);
}

if (!fs.existsSync(authorityPath)) fail("authority.json is missing");
const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8"));

if (authority?.id !== "lektro-88-v3") fail("wrong authority id");
if (authority?.source?.model !== "Aircraft_Tug_REVISED_V3.obj") fail("runtime authority is not Aircraft_Tug_REVISED_V3.obj");
if (authority?.source?.materialLibrary !== "Aircraft_Tug_REVISED_V3.mtl") fail("runtime authority is not the matching V3 MTL");
if (authority?.runtime?.allowKiriScan !== false) fail("KIRI scan fallback must be forbidden");
if (authority?.runtime?.allowProceduralVisibleSubstitute !== false) fail("procedural visible fallback must be forbidden");
if (authority?.runtime?.allowGlobalRedRetint !== false) fail("global red retint must be forbidden");
if (authority?.runtime?.allowV2 !== false) fail("V2 fallback must be forbidden");
if (authority?.runtime?.kinematics?.frontWheelsSteer !== false) fail("front wheels must remain fixed");
if (authority?.runtime?.kinematics?.rearWheelsSteer !== true) fail("both rear wheels must steer");
if (authority?.runtime?.kinematics?.rearWheelCount !== 2) fail("exactly two rear steering wheels are required");
if ((authority?.runtime?.kinematics?.targetRearSteerDegrees ?? 0) < 85) fail("rear steering target must remain near 90 degrees");

const requiredTextures = new Set(["tug_tow.png", "tug_tow_alpha.png", "tug01.png", "tug_NRM.png", "tug_SPEC.png"]);
for (const texture of requiredTextures) {
  if (!authority?.source?.requiredTextures?.includes(texture)) fail(`missing required source texture declaration: ${texture}`);
}

const requiredMarkers = new Set([
  "Automatic_Winch_Drum",
  "Automatic_Winch_Motor",
  "Automatic_Winch_Motor_Gearbox",
  "Automatic_Winch_Left_Bearing",
  "Automatic_Winch_Right_Bearing",
  "Lower_Horizontal_Roller",
  "Lower_Roller_Mount_Left",
  "Lower_Roller_Mount_Right",
]);
for (const marker of requiredMarkers) {
  if (!authority?.source?.requiredObjectMarkers?.includes(marker)) fail(`missing required V3 object marker: ${marker}`);
}

if (!fs.existsSync(runtimePath)) {
  console.log("V3 authority contract is valid. Runtime GLB is intentionally not accepted yet because public/models/lektro-88-v3.glb is absent.");
  process.exit(0);
}

const glb = fs.readFileSync(runtimePath);
if (glb.length < 1024) fail(`runtime GLB is implausibly small (${glb.length} bytes)`);
if (glb.subarray(0, 4).toString("ascii") !== "glTF") fail("runtime file is not a GLB");
if (glb.readUInt32LE(4) !== 2) fail("runtime GLB must be glTF 2.0");
if (glb.readUInt32LE(8) !== glb.length) fail("runtime GLB length header does not match file length");

const jsonLength = glb.readUInt32LE(12);
const jsonType = glb.subarray(16, 20).toString("ascii");
if (jsonType !== "JSON") fail("first GLB chunk is not JSON");
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").replace(/\u0000+$/g, "").trim());
const names = [
  ...(json.nodes ?? []).map((node) => node?.name).filter(Boolean),
  ...(json.meshes ?? []).map((mesh) => mesh?.name).filter(Boolean),
].join("\n");

for (const marker of requiredMarkers) {
  if (!names.includes(marker)) fail(`runtime GLB lost required V3 marker ${marker}`);
}

const serialized = JSON.stringify(json);
for (const forbidden of ["KIRI", "procedural-lektro", "procedural-threejs-detailed", "REVISED_V2"]) {
  if (serialized.includes(forbidden)) fail(`forbidden fallback marker present in runtime: ${forbidden}`);
}

if ((json.images?.length ?? 0) < 3) fail(`runtime GLB embeds too few source images (${json.images?.length ?? 0}); material maps appear stripped`);
if ((json.materials?.length ?? 0) < 4) fail(`runtime GLB has too few materials (${json.materials?.length ?? 0}); source material assignments appear collapsed`);

console.log(`Verified Lektro 88 Revised V3 runtime contract: ${glb.length} bytes, ${json.nodes?.length ?? 0} nodes, ${json.meshes?.length ?? 0} meshes, ${json.materials?.length ?? 0} materials, ${json.images?.length ?? 0} images.`);
