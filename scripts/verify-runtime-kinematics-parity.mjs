import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AIRCRAFT_WHEELBASE,
  CAPTURE_CORRECTION_RATE,
  MAX_AIRCRAFT_YAW_RATE,
  MAX_ARTICULATION,
} from "../src/simulation/towKinematics.js";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");
const deg = (radians) => (radians * 180) / Math.PI;

const requiredMarkers = [
  `const maxCaptureCorrection = ${CAPTURE_CORRECTION_RATE} * dt;`,
  `const requestedYawStep = lateralNoseTravel / ${AIRCRAFT_WHEELBASE};`,
  `const yawRateStep = clamp(requestedYawStep, -THREE.MathUtils.degToRad(${deg(MAX_AIRCRAFT_YAW_RATE)}) * dt, THREE.MathUtils.degToRad(${deg(MAX_AIRCRAFT_YAW_RATE)}) * dt);`,
  `const boundedArticulation = clamp(currentArticulation + yawRateStep, -THREE.MathUtils.degToRad(${deg(MAX_ARTICULATION)}), THREE.MathUtils.degToRad(${deg(MAX_ARTICULATION)}));`,
];

for (const marker of requiredMarkers) {
  const count = source.split(marker).length - 1;
  assert.equal(count, 1, `prepared runtime kinematics drifted from shared module: expected one marker, found ${count}: ${marker}`);
}

assert.ok(source.includes("sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);"), "prepared runtime no longer records the last attached nose pose");
assert.ok(source.includes("if (captureOffset <= maxCaptureCorrection || captureOffset < 0.002) sim.towOffsetLocal.set(0, 0, 0);"), "prepared runtime no longer settles capture offsets cleanly");

console.log("Prepared runtime kinematics parity verified against shared capture, wheelbase, yaw-rate, and articulation constants.");
