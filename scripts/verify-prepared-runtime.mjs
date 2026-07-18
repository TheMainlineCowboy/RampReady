import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

const requiredSnippets = [
  "const signedDirection = drive.direction;",
  "if (Math.abs(sim.velocity) < 0.01 && usefulThrottle === 0) sim.velocity = 0;",
  "sim.towOffsetLocal = captureState.delta.clone().applyAxisAngle(Y_AXIS, -sim.tug.rotation.y);",
  "const captureOffset = sim.towOffsetLocal.length();",
  "const maxCaptureCorrection = 0.28 * dt;",
  "if (captureOffset <= maxCaptureCorrection || captureOffset < 0.002) sim.towOffsetLocal.set(0, 0, 0);",
  "else sim.towOffsetLocal.multiplyScalar((captureOffset - maxCaptureCorrection) / captureOffset);",
  "const attachedNoseX = cradle.x + towOffset.x;",
  "const attachedNoseZ = cradle.z + towOffset.z;",
  "if (!sim.lastAttachedNose) sim.lastAttachedNose = new THREE.Vector3(attachedNoseX, 0, attachedNoseZ);",
  "if (!sim.mainGearCenter) {",
  "const desiredAircraftYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);",
  "const yawDelta = Math.atan2(",
  "const yawRateStep = clamp(yawDelta, -THREE.MathUtils.degToRad(8) * dt, THREE.MathUtils.degToRad(8) * dt);",
  "nextAircraftYaw = sim.tug.rotation.y + boundedArticulation;",
  "sim.mainGearCenter.set(",
  "attachedNoseX + Math.sin(nextAircraftYaw) * 11.2,",
  "attachedNoseZ + Math.cos(nextAircraftYaw) * 11.2,",
  "sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);",
];

const forbiddenSnippets = [
  "const signedDirection = connectedPushPhase ? 1 : drive.direction;",
  "if (Math.abs(sim.velocity) < 0.01) sim.velocity = 0;",
  "sim.aircraft.rotation.y = lerp(sim.aircraft.rotation.y, sim.tug.rotation.y, 1 - Math.exp(-0.7 * dt));",
  "const requestedYawStep = lateralNoseTravel / 11.2;",
  "const boundedArticulation = clamp(currentArticulation + yawRateStep",
  "sim.towOffsetLocal.set(0, 0, 0);\n    sim.connected = true;",
  "sim.aircraft.position.copy(cradle);",
  "sim.aircraft.position.set(cradle.x, 0, cradle.z);",
];

const failures = [];
for (const snippet of requiredSnippets) {
  const count = source.split(snippet).length - 1;
  if (count !== 1) failures.push(`expected exactly one prepared runtime snippet, found ${count}: ${snippet}`);
}
for (const snippet of forbiddenSnippets) {
  if (source.includes(snippet)) failures.push(`unsafe or legacy runtime snippet is still present: ${snippet}`);
}

const connectedResetCount = source.split("sim.connected = true;\n    sim.lastAttachedNose = null;\n    sim.mainGearCenter = null;").length - 1;
const disconnectedResetCount = source.split("sim.connected = false;\n    sim.lastAttachedNose = null;\n    sim.mainGearCenter = null;").length - 1;
if (connectedResetCount !== 1) failures.push(`expected one connection main-gear-history reset, found ${connectedResetCount}`);
if (disconnectedResetCount !== 2) failures.push(`expected two disconnection main-gear-history resets, found ${disconnectedResetCount}`);

const correctionRateMatch = source.match(/const maxCaptureCorrection = ([0-9.]+) \* dt;/);
if (!correctionRateMatch) {
  failures.push("capture-correction rate could not be parsed");
} else {
  const correctionRate = Number(correctionRateMatch[1]);
  if (!Number.isFinite(correctionRate) || correctionRate <= 0 || correctionRate > 0.35) {
    failures.push(`capture-correction rate ${correctionRateMatch[1]} m/s is outside the safe 0-0.35 m/s envelope`);
  }
}

if (failures.length) {
  console.error("RampReady prepared runtime verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RampReady prepared runtime verified: captured nose follows the tug while the aircraft pivots around a fixed wheelbase main-gear axle with delayed opposite-sign yaw, bounded articulation, and clean reconnect history.");
