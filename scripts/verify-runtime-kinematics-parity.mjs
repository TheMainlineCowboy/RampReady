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
  `sim.aircraft.position.x + Math.sin(sim.aircraft.rotation.y) * ${AIRCRAFT_WHEELBASE}`,
  `sim.aircraft.position.z + Math.cos(sim.aircraft.rotation.y) * ${AIRCRAFT_WHEELBASE}`,
  `const desiredAircraftYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);`,
  `const yawRateStep = clamp(yawDelta, -THREE.MathUtils.degToRad(${deg(MAX_AIRCRAFT_YAW_RATE)}) * dt, THREE.MathUtils.degToRad(${deg(MAX_AIRCRAFT_YAW_RATE)}) * dt);`,
  `attachedNoseX + Math.sin(nextAircraftYaw) * ${AIRCRAFT_WHEELBASE}`,
  `attachedNoseZ + Math.cos(nextAircraftYaw) * ${AIRCRAFT_WHEELBASE}`,
];

for (const marker of requiredMarkers) {
  const count = source.split(marker).length - 1;
  assert.equal(count, 1, `prepared runtime kinematics drifted from shared module: expected one marker, found ${count}: ${marker}`);
}

const articulationBlock = `const boundedArticulation = clamp(\n          Math.atan2(Math.sin(articulationDelta), Math.cos(articulationDelta)),\n          -THREE.MathUtils.degToRad(${deg(MAX_ARTICULATION)}),\n          THREE.MathUtils.degToRad(${deg(MAX_ARTICULATION)}),\n        );`;
assert.equal(
  source.split(articulationBlock).length - 1,
  1,
  "prepared runtime articulation bounds drifted from the shared module",
);

assert.ok(source.includes("sim.mainGearCenter = null;"), "prepared runtime no longer resets main-gear history on attachment changes");
assert.ok(source.includes("sim.lastAttachedNose.set(attachedNoseX, 0, attachedNoseZ);"), "prepared runtime no longer records the last attached nose pose");
assert.ok(source.includes("if (captureOffset <= maxCaptureCorrection || captureOffset < 0.002) sim.towOffsetLocal.set(0, 0, 0);"), "prepared runtime no longer settles capture offsets cleanly");
assert.ok(!source.includes("const requestedYawStep = lateralNoseTravel / 11.2;"), "obsolete direct lateral-yaw coupling remains in prepared runtime");

console.log("Prepared runtime kinematics parity verified against shared capture, main-gear wheelbase, delayed yaw-rate, and articulation constants.");

// build-production.mjs invokes this verifier as its final step immediately before
// Vite. Normalize the generated A1 terminal-joint camera here, after every late
// production rewrite and before the exact browser artifact is bundled.
await import(`./prepare-a1-final-terminal-joint-camera-guard-v1.mjs?pre-vite=${Date.now()}`);

// The Aug. 15 remote-Rotunda module is regenerated inside verify-prepared-runtime,
// which runs after the earlier fixed-door pass. Reassert the fixed rendered CRJ
// forward-door endpoint here at the true final pre-Vite handoff so no later
// decoded parking-target regeneration can collapse the movable A1 span again.
// This changes only the generated A1 target calculation; Terminal 4, the CRJ and
// the exact supplied Airport_Jetway.glb geometry/textures remain untouched.
await import(`./prepare-a1-fixed-door-remote-rotunda-v3.mjs?final-pre-vite-fixed-door=${Date.now()}`);
