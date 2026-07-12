import assert from "node:assert/strict";
import {
  AIRCRAFT_WHEELBASE,
  CAPTURE_CORRECTION_RATE,
  MAX_AIRCRAFT_YAW_RATE,
  MAX_ARTICULATION,
  settleCaptureOffset,
  updateAircraftTowPose,
} from "../src/simulation/towKinematics.js";

function settleAtFps(fps) {
  let offset = { x: 0.42, z: 0 };
  const dt = 1 / fps;
  let elapsed = 0;
  while (Math.hypot(offset.x, offset.z) > 0 && elapsed < 5) {
    offset = settleCaptureOffset(offset, dt);
    elapsed += dt;
  }
  return elapsed;
}

const settleTimes = [30, 60, 120].map(settleAtFps);
const expectedSettleTime = 0.42 / CAPTURE_CORRECTION_RATE;
for (const time of settleTimes) {
  assert.ok(Math.abs(time - expectedSettleTime) <= 1 / 30, `capture settling drifted: ${time.toFixed(4)}s`);
}
assert.ok(Math.max(...settleTimes) - Math.min(...settleTimes) <= 1 / 30, "capture settling is frame-rate dependent");

const stationary = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 0, z: -0.1 },
  dt: 1 / 60,
});
assert.equal(stationary.x, 0);
assert.equal(stationary.z, -0.1);
assert.ok(Math.abs(stationary.yaw) < 1e-12, "straight reverse towing introduced yaw");

for (const fps of [30, 60, 120]) {
  const dt = 1 / fps;
  const left = updateAircraftTowPose({
    aircraftYaw: 0,
    tugYaw: 0,
    previousNose: { x: 0, z: 0 },
    attachedNose: { x: 0.2, z: -0.1 },
    dt,
  });
  const right = updateAircraftTowPose({
    aircraftYaw: 0,
    tugYaw: 0,
    previousNose: { x: 0, z: 0 },
    attachedNose: { x: -0.2, z: -0.1 },
    dt,
  });
  assert.ok(left.yaw > 0, `left lateral nose travel produced wrong yaw sign at ${fps} fps`);
  assert.ok(right.yaw < 0, `right lateral nose travel produced wrong yaw sign at ${fps} fps`);
  assert.ok(Math.abs(left.yaw) <= MAX_AIRCRAFT_YAW_RATE * dt + 1e-12, `left yaw exceeded rate limit at ${fps} fps`);
  assert.ok(Math.abs(right.yaw) <= MAX_AIRCRAFT_YAW_RATE * dt + 1e-12, `right yaw exceeded rate limit at ${fps} fps`);
}

const wheelbaseResponse = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: AIRCRAFT_WHEELBASE * 0.01, z: -0.1 },
  dt: 1,
});
assert.ok(Math.abs(wheelbaseResponse.yaw - 0.01) < 1e-12, "wheelbase-constrained yaw response drifted");

const articulated = updateAircraftTowPose({
  aircraftYaw: Math.PI,
  tugYaw: 0,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 10, z: 0 },
  dt: 1,
});
assert.ok(Math.abs(articulated.articulation) <= MAX_ARTICULATION + 1e-12, "articulation exceeded safety bound");

const zeroed = settleCaptureOffset({ x: 0.001, z: 0.001 }, 1 / 120);
assert.deepEqual(zeroed, { x: 0, z: 0 }, "tiny capture offset did not settle cleanly");

console.log(`Tow kinematics module passed capture, reverse steering, yaw-rate, wheelbase, and articulation checks at 30/60/120 fps; capture settles in ${settleTimes.map((v) => v.toFixed(3)).join(" / ")} seconds.`);
