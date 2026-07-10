const WHEELBASE = 11.2;
const MAX_YAW_RATE = 12 * Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const shortestAngleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

function stepAircraft({ yaw, previousNose, attachedNose, dt }) {
  const dx = attachedNose.x - previousNose.x;
  const dz = attachedNose.z - previousNose.z;
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const lateralTravel = dx * rightX + dz * rightZ;
  const requestedYawStep = lateralTravel / WHEELBASE;
  const yawStep = clamp(requestedYawStep, -MAX_YAW_RATE * dt, MAX_YAW_RATE * dt);
  return { yaw: yaw + yawStep, yawStep };
}

function simulate({ dt, seconds = 6, speed = 0.8, turnRate = 7 * Math.PI / 180 }) {
  let tugYaw = 0;
  let nose = { x: 0, z: 0 };
  let aircraftYaw = 0;
  let maxYawStep = 0;
  let maxArticulation = 0;
  const frames = Math.ceil(seconds / dt);
  for (let frame = 0; frame < frames; frame += 1) {
    const frameDt = Math.min(dt, seconds - frame * dt);
    if (frameDt <= 0) break;
    tugYaw += turnRate * frameDt;
    const previousNose = nose;
    nose = {
      x: nose.x + Math.sin(tugYaw) * speed * frameDt,
      z: nose.z + Math.cos(tugYaw) * speed * frameDt,
    };
    const result = stepAircraft({ yaw: aircraftYaw, previousNose, attachedNose: nose, dt: frameDt });
    aircraftYaw = result.yaw;
    maxYawStep = Math.max(maxYawStep, Math.abs(result.yawStep));
    maxArticulation = Math.max(maxArticulation, Math.abs(shortestAngleDelta(aircraftYaw, tugYaw)));
  }
  return { aircraftYaw, tugYaw, maxYawStep, maxArticulation, nose };
}

const failures = [];
const straight = simulate({ dt: 1 / 60, turnRate: 0 });
if (Math.abs(straight.aircraftYaw) > 1e-12) failures.push(`Straight tow introduced aircraft yaw: ${straight.aircraftYaw}`);

const run30 = simulate({ dt: 1 / 30 });
const run60 = simulate({ dt: 1 / 60 });
const run120 = simulate({ dt: 1 / 120 });
for (const [label, run, dt] of [["30 Hz", run30, 1 / 30], ["60 Hz", run60, 1 / 60], ["120 Hz", run120, 1 / 120]]) {
  if (run.aircraftYaw <= 0) failures.push(`${label} aircraft failed to follow curved cradle path`);
  if (run.aircraftYaw >= run.tugYaw) failures.push(`${label} aircraft incorrectly snapped to tug heading`);
  if (run.maxYawStep > MAX_YAW_RATE * dt + 1e-12) failures.push(`${label} exceeded yaw-rate cap: ${run.maxYawStep}`);
  if (run.maxArticulation > 70 * Math.PI / 180) failures.push(`${label} articulation exceeded safe envelope: ${run.maxArticulation}`);
}
if (Math.abs(run30.aircraftYaw - run60.aircraftYaw) > 0.01) failures.push(`30/60 Hz yaw divergence: ${run30.aircraftYaw} vs ${run60.aircraftYaw}`);
if (Math.abs(run120.aircraftYaw - run60.aircraftYaw) > 0.01) failures.push(`120/60 Hz yaw divergence: ${run120.aircraftYaw} vs ${run60.aircraftYaw}`);

const reverse30 = simulate({ dt: 1 / 30, speed: -0.8, turnRate: -7 * Math.PI / 180 });
const reverse60 = simulate({ dt: 1 / 60, speed: -0.8, turnRate: -7 * Math.PI / 180 });
const reverse120 = simulate({ dt: 1 / 120, speed: -0.8, turnRate: -7 * Math.PI / 180 });
for (const [label, run, dt] of [["reverse 30 Hz", reverse30, 1 / 30], ["reverse 60 Hz", reverse60, 1 / 60], ["reverse 120 Hz", reverse120, 1 / 120]]) {
  if (run.aircraftYaw <= 0) failures.push(`${label} aircraft yawed opposite the reverse cradle path`);
  if (run.maxYawStep > MAX_YAW_RATE * dt + 1e-12) failures.push(`${label} exceeded yaw-rate cap: ${run.maxYawStep}`);
  if (run.maxArticulation > 70 * Math.PI / 180) failures.push(`${label} articulation exceeded safe envelope: ${run.maxArticulation}`);
  if (run.nose.z >= 0) failures.push(`${label} nose failed to travel in reverse: ${run.nose.z}`);
}
if (Math.abs(reverse30.aircraftYaw - reverse60.aircraftYaw) > 0.01) failures.push(`Reverse 30/60 Hz yaw divergence: ${reverse30.aircraftYaw} vs ${reverse60.aircraftYaw}`);
if (Math.abs(reverse120.aircraftYaw - reverse60.aircraftYaw) > 0.01) failures.push(`Reverse 120/60 Hz yaw divergence: ${reverse120.aircraftYaw} vs ${reverse60.aircraftYaw}`);

const sudden = stepAircraft({ yaw: 0, previousNose: { x: 0, z: 0 }, attachedNose: { x: 1, z: 0 }, dt: 0.016 });
if (Math.abs(sudden.yawStep) > MAX_YAW_RATE * 0.016 + 1e-12) failures.push(`Sudden lateral cradle motion exceeded yaw cap: ${sudden.yawStep}`);

if (failures.length) {
  console.error("RampReady tow-kinematics verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`RampReady tow-kinematics verification passed: forward yaw ${(run60.aircraftYaw * 180 / Math.PI).toFixed(2)}°, reverse yaw ${(reverse60.aircraftYaw * 180 / Math.PI).toFixed(2)}°, max forward articulation ${(run60.maxArticulation * 180 / Math.PI).toFixed(2)}°, max reverse articulation ${(reverse60.maxArticulation * 180 / Math.PI).toFixed(2)}°.`);