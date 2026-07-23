import {
  CRADLE_CAPTURE_OFFSET,
  JACKKNIFE_LIMIT,
  TOW_MAX_SPEED,
  createPushbackState,
  stepPushbackDynamics,
} from "../src/simulation/pushbackDynamics.js";

function simulate(dt, seconds, commandFactory) {
  let state = createPushbackState();
  const frames = Math.ceil(seconds / dt);
  let maxArticulation = 0;
  let maxSpeed = 0;
  let warned = false;
  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame * dt;
    state = stepPushbackDynamics(state, commandFactory(t, state), dt);
    maxArticulation = Math.max(maxArticulation, Math.abs(state.articulation));
    maxSpeed = Math.max(maxSpeed, Math.abs(state.speed));
    warned ||= state.jackknifeWarning;
  }
  return { state, maxArticulation, maxSpeed, warned };
}

const failures = [];
const initial = createPushbackState();
if (Math.abs(initial.aircraftX) > 1e-12 || Math.abs(initial.aircraftZ - CRADLE_CAPTURE_OFFSET) > 1e-12) {
  failures.push(`default connected state is not seated on the cradle: (${initial.aircraftX}, ${initial.aircraftZ})`);
}
const firstAttachedFrame = stepPushbackDynamics(
  initial,
  { connected: true, throttle: 0, direction: 1, steer: 0, brake: true },
  1 / 60,
);
const firstFrameJump = Math.hypot(
  firstAttachedFrame.aircraftX - initial.aircraftX,
  firstAttachedFrame.aircraftZ - initial.aircraftZ,
);
if (firstFrameJump > 1e-12) failures.push(`attachment initialization teleported the aircraft by ${firstFrameJump} m`);

for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
  const straight = simulate(dt, 8, () => ({ connected: true, throttle: 0.8, direction: 1, steer: 0, brake: false }));
  if (Math.abs(straight.state.aircraftYaw) > 1e-4) failures.push(`${dt}s straight tow introduced yaw ${straight.state.aircraftYaw}`);
  if (straight.maxSpeed > TOW_MAX_SPEED + 1e-9) failures.push(`${dt}s exceeded tow speed ${straight.maxSpeed}`);
  if (straight.state.aircraftZ <= CRADLE_CAPTURE_OFFSET + 3) failures.push(`${dt}s aircraft did not move during straight tow`);

  const turn = simulate(dt, 12, (t) => ({ connected: true, throttle: 0.72, direction: 1, steer: t < 2 ? 0 : 0.78, brake: false }));
  if (Math.abs(turn.state.tugYaw) < 0.08) failures.push(`${dt}s tug failed to turn`);
  if (Math.abs(turn.state.aircraftYaw) >= Math.abs(turn.state.tugYaw)) failures.push(`${dt}s aircraft copied or exceeded tug heading`);
  if (turn.maxArticulation > JACKKNIFE_LIMIT + 1e-9) failures.push(`${dt}s articulation exceeded hard limit`);

  const stop = simulate(dt, 9, (t) => ({ connected: true, throttle: t < 5 ? 1 : 0, direction: 1, steer: 0, brake: t >= 5 }));
  if (Math.abs(stop.state.speed) > 0.015) failures.push(`${dt}s service brake failed to stop: ${stop.state.speed}`);
}

const run30 = simulate(1 / 30, 10, (t) => ({ connected: true, throttle: 0.75, direction: 1, steer: t > 1 ? 0.65 : 0, brake: false }));
const run60 = simulate(1 / 60, 10, (t) => ({ connected: true, throttle: 0.75, direction: 1, steer: t > 1 ? 0.65 : 0, brake: false }));
const run120 = simulate(1 / 120, 10, (t) => ({ connected: true, throttle: 0.75, direction: 1, steer: t > 1 ? 0.65 : 0, brake: false }));
for (const [label, run] of [["30/60", run30], ["120/60", run120]]) {
  if (Math.abs(run.state.aircraftYaw - run60.state.aircraftYaw) > 0.035) failures.push(`${label} aircraft yaw divergence`);
  if (Math.abs(run.state.aircraftZ - run60.state.aircraftZ) > 0.18) failures.push(`${label} aircraft position divergence`);
}

if (failures.length) {
  console.error("RampReady pushback dynamics verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`RampReady pushback dynamics verification passed without attachment teleport: tow speed ${run60.maxSpeed.toFixed(2)} m/s, tug yaw ${(run60.state.tugYaw * 180 / Math.PI).toFixed(1)}°, aircraft yaw ${(run60.state.aircraftYaw * 180 / Math.PI).toFixed(1)}°, articulation ${(run60.maxArticulation * 180 / Math.PI).toFixed(1)}°.`);
