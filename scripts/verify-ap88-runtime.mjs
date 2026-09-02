import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const modelUrl = new URL("public/models/lektro-ap88-r4.glb", root);
const manifestUrl = new URL("assets/tug/ap88-r4.parts.json", root);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const glb = await readFile(modelUrl);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const failures = [];
if (glb.byteLength !== manifest.glbByteLength) failures.push(`byte length ${glb.byteLength}/${manifest.glbByteLength}`);
if (sha256(glb) !== manifest.glbSha256) failures.push(`sha256 ${sha256(glb)}/${manifest.glbSha256}`);
if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2) failures.push("invalid GLB header");

let offset = 12;
let json = null;
while (offset + 8 <= glb.length) {
  const length = glb.readUInt32LE(offset);
  const type = glb.readUInt32LE(offset + 4);
  offset += 8;
  const chunk = glb.subarray(offset, offset + length);
  offset += length;
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString("utf8").replace(/\u0000+$/g, "").trim());
}
if (!json) failures.push("missing GLB JSON chunk");
else {
  const names = new Set((json.nodes || []).map((node) => node.name).filter(Boolean));
  const requiredNodes = [
    "AP88_STEER_L_STEER", "AP88_STEER_R_STEER",
    "AP88_STEER_L_SPIN", "AP88_STEER_R_SPIN",
    "AP88_DRIVE_L_SPIN", "AP88_DRIVE_R_SPIN",
    "AP88_STEERING_WHEEL", "AP88_CRADLE_PLATFORM",
    "AP88_LIFT_ARM", "AP88_WINCH", "AP88_BEACON",
    "MASTER2_DRIVER_SEAT_VINYL", "MASTER2_PASSENGER_SEAT_VINYL",
  ];
  for (const name of requiredNodes) if (!names.has(name)) failures.push(`missing node ${name}`);
  const steeringWheelRoots = (json.nodes || []).filter((node) => node.name === "AP88_STEERING_WHEEL").length;
  if (steeringWheelRoots !== 1) failures.push(`expected one steering wheel root, found ${steeringWheelRoots}`);
  const animationNames = new Set((json.animations || []).map((animation) => animation.name));
  for (const name of ["AP88_STEERING_TEST", "AP88_WHEEL_ROLL_TEST", "AP88_CRADLE_LIFT_TEST", "AP88_BEACON_ROTATE"]) {
    if (!animationNames.has(name)) failures.push(`missing animation ${name}`);
  }
  if ((json.materials || []).length < 20) failures.push(`material count ${(json.materials || []).length} is below simulator contract`);
  if ((json.images || []).length < 10) failures.push(`embedded image count ${(json.images || []).length} is below simulator contract`);
}

if (failures.length) {
  console.error("AP88 R4 runtime verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("AP88 R4 runtime verification passed: exact GLB identity, one steering wheel, two seats, articulation nodes, animation clips, materials and embedded textures are present.");
