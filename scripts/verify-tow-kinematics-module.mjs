import assert from "node:assert/strict";
import {
  AIRCRAFT_WHEELBASE,
  CAPTURE_CORRECTION_RATE,
  MAX_AIRCRAFT_YAW_RATE,
  MAX_ARTICULATION,
  MIN_TOW_MOTION,
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

const straight = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 0, z: 0.1 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 1 / 60,
});
assert.equal(straight.x, 0);
assert.equal(straight.z, 0.1);
assert.ok(Math.abs(straight.yaw) < 1e-12, "straight pushback introduced yaw");
assert.ok(Math.abs(Math.hypot(straight.mainGearX - straight.x, straight.mainGearZ - straight.z) - AIRCRAFT_WHEELBASE) < 1e-9, "straight pushback broke wheelbase");

const initialized = updateAircraftTowPose({
  aircraftYaw: 0.35,
  tugYaw: 0.35,
  previousNose: null,
  attachedNose: { x: 1.2, z: -4.5 },
  dt: 1 / 60,
});
assert.equal(initialized.x, 1.2, "first-frame initialization changed attached nose x");
assert.equal(initialized.z, -4.5, "first-frame initialization changed attached nose z");
assert.ok(Math.abs(initialized.yaw - 0.35) < 1e-12, "first-frame initialization injected yaw");
assert.equal(initialized.lateralNoseTravel, 0, "first-frame initialization reported phantom lateral travel");

const stationarySteer = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0.4,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 0, z: 0 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 1 / 30,
});
assert.equal(stationarySteer.yaw, 0, "stationary tug steering rotated the aircraft in place");
assert.equal(stationarySteer.yawDelta, 0, "stationary tow reported a yaw change");
assert.equal(stationarySteer.noseTravel, 0, "stationary tow reported nose travel");
assert.equal(stationarySteer.motionYawLimit, 0, "stationary tow created a displacement yaw allowance");

const subThresholdMotion = updateAircraftTowPose({
  aircraftYaw: 0.12,
  tugYaw: 0.3,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: MIN_TOW_MOTION * 0.5, z: 0 },
  mainGear: { x: Math.sin(0.12) * AIRCRAFT_WHEELBASE, z: Math.cos(0.12) * AIRCRAFT_WHEELBASE },
  dt: 1 / 60,
});
assert.equal(subThresholdMotion.yaw, 0.12, "sub-threshold numerical motion rotated the aircraft");

const invalidInput = updateAircraftTowPose({
  aircraftYaw: Number.NaN,
  tugYaw: Number.POSITIVE_INFINITY,
  previousNose: undefined,
  attachedNose: undefined,
  mainGear: undefined,
  dt: Number.NaN,
});
assert.deepEqual(
  { x: invalidInput.x, z: invalidInput.z, yaw: invalidInput.yaw, lateralNoseTravel: invalidInput.lateralNoseTravel },
  { x: 0, z: 0, yaw: 0, lateralNoseTravel: 0 },
  "invalid first-frame tow input did not fail closed",
);
assert.deepEqual(settleCaptureOffset(undefined, 1 / 60), { x: 0, z: 0 }, "missing capture offset did not fail closed");

for (const fps of [30, 60, 120]) {
  const dt = 1 / fps;
  const noseRight = updateAircraftTowPose({
    aircraftYaw: 0,
    tugYaw: 0.02,
    previousNose: { x: 0, z: 0 },
    attachedNose: { x: 0.2, z: 0.1 },
    mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
    dt,
  });
  const noseLeft = updateAircraftTowPose({
    aircraftYaw: 0,
    tugYaw: -0.02,
    previousNose: { x: 0, z: 0 },
    attachedNose: { x: -0.2, z: 0.1 },
    mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
    dt,
  });
  assert.ok(noseRight.yaw < 0, `right-moving captured nose did not rotate aircraft opposite the tug at ${fps} fps`);
  assert.ok(noseLeft.yaw > 0, `left-moving captured nose did not rotate aircraft opposite the tug at ${fps} fps`);
  assert.ok(Math.abs(noseRight.yaw) <= MAX_AIRCRAFT_YAW_RATE * dt + 1e-12, `right yaw exceeded rate limit at ${fps} fps`);
  assert.ok(Math.abs(noseLeft.yaw) <= MAX_AIRCRAFT_YAW_RATE * dt + 1e-12, `left yaw exceeded rate limit at ${fps} fps`);
  assert.ok(Math.abs(noseRight.yawDelta) <= noseRight.motionYawLimit + 1e-12, `right yaw exceeded displacement allowance at ${fps} fps`);
  assert.ok(Math.abs(noseLeft.yawDelta) <= noseLeft.motionYawLimit + 1e-12, `left yaw exceeded displacement allowance at ${fps} fps`);
  assert.ok(noseRight.mainGearLateralSlip < 0.1, `right turn generated excessive main-gear lateral correction at ${fps} fps`);
  assert.ok(noseLeft.mainGearLateralSlip < 0.1, `left turn generated excessive main-gear lateral correction at ${fps} fps`);
  for (const pose of [noseRight, noseLeft]) {
    const measuredWheelbase = Math.hypot(pose.mainGearX - pose.x, pose.mainGearZ - pose.z);
    assert.ok(Math.abs(measuredWheelbase - AIRCRAFT_WHEELBASE) < 1e-9, `main-gear wheelbase drifted at ${fps} fps`);
  }
}

const shortMove = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0.2,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 0.01, z: 0 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 1,
});
const longMove = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0.2,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 0.5, z: 0 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 1,
});
assert.ok(Math.abs(shortMove.yawDelta) < Math.abs(longMove.yawDelta), "aircraft yaw did not increase with actual nose travel");
assert.ok(shortMove.motionYawLimit < longMove.motionYawLimit, "displacement yaw allowance did not scale with tow motion");

const articulated = updateAircraftTowPose({
  aircraftYaw: Math.PI,
  tugYaw: 0,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 10, z: 0 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 1,
});
assert.ok(Math.abs(articulated.articulation) <= MAX_ARTICULATION + 1e-12, "articulation exceeded safety bound");

const zeroed = settleCaptureOffset({ x: 0.001, z: 0.001 }, 1 / 120);
assert.deepEqual(zeroed, { x: 0, z: 0 }, "tiny capture offset did not settle cleanly");

console.log(`Tow kinematics module passed capture settling, motion-coupled yaw, stationary steering isolation, main-gear wheelbase/slip, opposite-sign turn response, yaw-rate, invalid-input, and articulation checks at 30/60/120 fps; capture settles in ${settleTimes.map((v) => v.toFixed(3)).join(" / ")} seconds.`);
