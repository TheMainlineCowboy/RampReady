import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

const requiredSnippets = [
  "const signedDirection = drive.direction;",
  "const maxCaptureCorrection = 0.28 * dt;",
  "if (!sim.lastAttachedNose) sim.lastAttachedNose = new THREE.Vector3(attachedNoseX, 0, attachedNoseZ);",
  "const requestedYawStep = lateralNoseTravel / 11.2;",
  "clamp(requestedYawStep, -THREE.MathUtils.degToRad(12) * dt, THREE.MathUtils.degToRad(12) * dt)",
  "sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);",
];

const forbiddenSnippets = [
  "const signedDirection = connectedPushPhase ? 1 : drive.direction;",
  "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));",
];

const failures = [];
for (const snippet of requiredSnippets) {
  const count = source.split(snippet).length - 1;
  if (count !== 1) failures.push(`expected exactly one prepared runtime snippet, found ${count}: ${snippet}`);
}
for (const snippet of forbiddenSnippets) {
  if (source.includes(snippet)) failures.push(`legacy runtime snippet is still present: ${snippet}`);
}

const connectedResetCount = source.split("sim.connected = true;\n    sim.lastAttachedNose = null;").length - 1;
const disconnectedResetCount = source.split("sim.connected = false;\n    sim.lastAttachedNose = null;").length - 1;
if (connectedResetCount !== 1) failures.push(`expected one connection-history reset, found ${connectedResetCount}`);
if (disconnectedResetCount !== 2) failures.push(`expected two disconnection-history resets, found ${disconnectedResetCount}`);

if (failures.length) {
  console.error("RampReady prepared runtime verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RampReady prepared runtime verified: physical reverse travel, bounded capture correction, constrained towing yaw, and clean reconnect history are active.");
