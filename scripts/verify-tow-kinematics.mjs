import {
  AIRCRAFT_WHEELBASE,
  CAPTURE_CORRECTION_RATE,
  MAX_AIRCRAFT_YAW_RATE,
  MAX_ARTICULATION,
  settleCaptureOffset,
  updateAircraftTowPose,
} from "../src/simulation/towKinematics.js";

function simulateCapture({ dt, seconds = 2, initialOffset = { x: 0.36, z: 0.22 } }) {
  let offset = { ...initialOffset };
  let maxCorrection = 0;
  let previousDistance = Math.hypot(offset.x, offset.z);
  const frames = Math.ceil(seconds / dt);
  for (let frame = 0; frame < frames; frame += 1) {
    const frameDt = Math.min(dt, seconds - frame * dt);
    if (frameDt <= 0) break;
    const next = settleCaptureOffset(offset, frameDt);
    const correction = Math.hypot(offset.x - next.x, offset.z - next.z);
    maxCorrection = Math.max(maxCorrection, correction);
    offset = next;
    const distance = Math.hypot(offset.x, offset.z);
    if (distance > previousDistance + 1e-12) throw new Error(`Capture correction moved away from cradle: ${distance} > ${previousDistance}`);
    previousDistance = distance;
  }
  return { remaining: Math.hypot(offset.x, offset.z), maxCorrection };
}

function simulate({ dt, seconds = 7, speed = 0.8, tugTurnRate = 6 * Math.PI / 180 }) {
  let tugYaw = 0;
  let nose = { x: 0, z: 0 };
  let aircraftYaw = 0;
  let mainGear = { x: 0, z: AIRCRAFT_WHEELBASE };
  let maxYawStep = 0;
  let maxArticulation = 0;
  let maxWheelbaseError = 0;
  const frames = Math.ceil(seconds / dt);
  for (let frame = 0; frame < frames; frame += 1) {
    const frameDt = Math.min(dt, seconds - frame * dt);
    if (frameDt <= 0) break;
    tugYaw += tugTurnRate * frameDt;
    const previousNose = nose;
    nose = {
      x: nose.x + Math.sin(tugYaw) * speed * frameDt,
      z: nose.z + Math.cos(tugYaw) * speed * frameDt,
    };
    const previousYaw = aircraftYaw;
    const pose = updateAircraftTowPose({
      aircraftYaw,
      tugYaw,
      previousNose,
      attachedNose: nose,
      mainGear,
      dt: frameDt,
    });
    aircraftYaw = pose.yaw;
    mainGear = { x: pose.mainGearX, z: pose.mainGearZ };
    maxYawStep = Math.max(maxYawStep, Math.abs(Math.atan2(Math.sin(aircraftYaw - previousYaw), Math.cos(aircraftYaw - previousYaw))));
    maxArticulation = Math.max(maxArticulation, Math.abs(pose.articulation));
    maxWheelbaseError = Math.max(maxWheelbaseError, Math.abs(Math.hypot(mainGear.x - nose.x, mainGear.z - nose.z) - AIRCRAFT_WHEELBASE));
  }
  return { aircraftYaw, tugYaw, maxYawStep, maxArticulation, maxWheelbaseError, nose, mainGear };
}

const failures = [];
const straight = simulate({ dt: 1 / 60, tugTurnRate: 0 });
if (Math.abs(straight.aircraftYaw) > 1e-12) failures.push(`Straight pushback introduced aircraft yaw: ${straight.aircraftYaw}`);

const capture30 = simulateCapture({ dt: 1 / 30 });
const capture60 = simulateCapture({ dt: 1 / 60 });
const capture120 = simulateCapture({ dt: 1 / 120 });
for (const [label, run, dt] of [["capture 30 Hz", capture30, 1 / 30], ["capture 60 Hz", capture60, 1 / 60], ["capture 120 Hz", capture120, 1 / 120]]) {
  if (run.maxCorrection > CAPTURE_CORRECTION_RATE * dt + 1e-12) failures.push(`${label} exceeded capture correction rate: ${run.maxCorrection}`);
  if (run.remaining > 1e-9) failures.push(`${label} failed to settle capture offset: ${run.remaining}`);
}

const run30 = simulate({ dt: 1 / 30 });
const run60 = simulate({ dt: 1 / 60 });
const run120 = simulate({ dt: 1 / 120 });
for (const [label, run, dt] of [["30 Hz", run30, 1 / 30], ["60 Hz", run60, 1 / 60], ["120 Hz", run120, 1 / 120]]) {
  if (run.tugYaw <= 0) failures.push(`${label} tug did not turn`);
  if (run.aircraftYaw >= 0) failures.push(`${label} aircraft copied tug yaw instead of pivoting around the main gear: ${run.aircraftYaw}`);
  if (Math.abs(run.aircraftYaw) >= Math.abs(run.tugYaw)) failures.push(`${label} aircraft over-rotated relative to tug: aircraft=${run.aircraftYaw}, tug=${run.tugYaw}`);
  if (run.maxYawStep > MAX_AIRCRAFT_YAW_RATE * dt + 1e-12) failures.push(`${label} exceeded aircraft yaw-rate cap: ${run.maxYawStep}`);
  if (run.maxArticulation > MAX_ARTICULATION + 1e-12) failures.push(`${label} articulation exceeded safe envelope: ${run.maxArticulation}`);
  if (run.maxWheelbaseError > 1e-9) failures.push(`${label} main-gear wheelbase drifted: ${run.maxWheelbaseError}`);
}
if (Math.abs(run30.aircraftYaw - run60.aircraftYaw) > 0.02) failures.push(`30/60 Hz yaw divergence: ${run30.aircraftYaw} vs ${run60.aircraftYaw}`);
if (Math.abs(run120.aircraftYaw - run60.aircraftYaw) > 0.02) failures.push(`120/60 Hz yaw divergence: ${run120.aircraftYaw} vs ${run60.aircraftYaw}`);

const opposite = simulate({ dt: 1 / 60, tugTurnRate: -6 * Math.PI / 180 });
if (opposite.tugYaw >= 0 || opposite.aircraftYaw <= 0) failures.push(`Opposite turn did not mirror articulated response: tug=${opposite.tugYaw}, aircraft=${opposite.aircraftYaw}`);

const sudden = updateAircraftTowPose({
  aircraftYaw: 0,
  tugYaw: 0.2,
  previousNose: { x: 0, z: 0 },
  attachedNose: { x: 1, z: 0.1 },
  mainGear: { x: 0, z: AIRCRAFT_WHEELBASE },
  dt: 0.016,
});
if (Math.abs(sudden.yaw) > MAX_AIRCRAFT_YAW_RATE * 0.016 + 1e-12) failures.push(`Sudden lateral cradle motion exceeded yaw cap: ${sudden.yaw}`);

if (failures.length) {
  console.error("RampReady tow-kinematics verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`RampReady tow-kinematics verification passed: tug turn ${(run60.tugYaw * 180 / Math.PI).toFixed(2)}°, delayed opposite aircraft turn ${(run60.aircraftYaw * 180 / Math.PI).toFixed(2)}°, main-gear wheelbase error ${run60.maxWheelbaseError.toExponential(1)}, articulation ${(run60.maxArticulation * 180 / Math.PI).toFixed(2)}°.`);
