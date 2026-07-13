const NOSE_START_Z = 6.2;
const CRADLE_Z = 3.45;
const MAX_FREE_SPEED = 3.2;
const MAX_TOW_SPEED = 1.25;
const CONNECT_DISTANCE = 0.42;
const CONNECT_LATERAL_LIMIT = 0.2;
const CONNECT_HEADING_LIMIT = 6;
const CONNECT_SPEED_LIMIT = 0.12;
const MAX_AIRCRAFT_YAW_RATE = 12 * Math.PI / 180;
const CAPTURE_CENTERING_RESPONSE = 6;

const failures = [];
const approx = (actual, expected, tolerance, label) => {
  if (Math.abs(actual - expected) > tolerance) failures.push(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const shortestAngleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const dampAngle = (from, to, response, dt) => {
  const requestedStep = shortestAngleDelta(from, to) * (1 - Math.exp(-response * dt));
  return from + clamp(requestedStep, -MAX_AIRCRAFT_YAW_RATE * dt, MAX_AIRCRAFT_YAW_RATE * dt);
};
const decayCaptureOffset = (offset, dt) => offset * Math.exp(-CAPTURE_CENTERING_RESPONSE * dt);

function stepVelocity({ velocity, throttle, direction, connected, stage, brake = false, dt = 0.016 }) {
  const usefulThrottle = throttle > 0.02 ? 0.16 + throttle * 0.84 : 0;
  const connectedPushPhase = connected && stage === 4;
  const connectedMotionLocked = connected && !connectedPushPhase;
  const pushDirectionLocked = connectedPushPhase && direction !== 1;
  const signedDirection = direction;
  const maxSpeed = connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
  const targetSpeed = connectedMotionLocked || pushDirectionLocked ? 0 : usefulThrottle * signedDirection * maxSpeed;
  let nextVelocity = lerp(velocity, targetSpeed, 1 - Math.exp((connected ? -3.4 : -4.4) * dt));
  if (brake) nextVelocity = lerp(nextVelocity, 0, 1 - Math.exp(-9 * dt));
  if (usefulThrottle === 0) nextVelocity = lerp(nextVelocity, 0, 1 - Math.exp(-1.7 * dt));
  if (Math.abs(nextVelocity) < 0.01) nextVelocity = 0;
  return { usefulThrottle, targetSpeed, nextVelocity };
}

function simulateMotion({ seconds, throttle, direction, connected, stage, brakeAt = Infinity, dt = 0.016 }) {
  let velocity = 0;
  let position = 0;
  let peakSpeed = 0;
  for (let frame = 0; frame < Math.ceil(seconds / dt); frame += 1) {
    const elapsed = frame * dt;
    const step = stepVelocity({ velocity, throttle: elapsed >= brakeAt ? 0 : throttle, direction, connected, stage, brake: elapsed >= brakeAt, dt });
    velocity = step.nextVelocity;
    position += velocity * dt;
    peakSpeed = Math.max(peakSpeed, Math.abs(velocity));
  }
  return { velocity, position, peakSpeed };
}

function captureReady({ capture, lateral, heading, speed }) {
  return capture <= CONNECT_DISTANCE && lateral <= CONNECT_LATERAL_LIMIT && heading <= CONNECT_HEADING_LIMIT && speed <= CONNECT_SPEED_LIMIT;
}

function simulateCaptureCentering({ seconds = 1, dt }) {
  let offset = CONNECT_DISTANCE;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    offset = decayCaptureOffset(offset, Math.min(dt, seconds - elapsed));
  }
  return offset;
}

function simulateYawConvergence({ from, to, seconds = 2, dt }) {
  let yaw = from;
  let maxStep = 0;
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) {
    const frameDt = Math.min(dt, seconds - elapsed);
    const next = dampAngle(yaw, to, 0.7, frameDt);
    maxStep = Math.max(maxStep, Math.abs(shortestAngleDelta(yaw, next)));
    yaw = next;
  }
  return { error: Math.abs(shortestAngleDelta(yaw, to)), maxStep };
}

const lowFree = stepVelocity({ velocity: 0, throttle: 0.12, direction: 1, connected: false, stage: 1 });
if (lowFree.targetSpeed <= 0.22) failures.push(`Partial free-drive throttle too weak: ${lowFree.targetSpeed}`);
if (lowFree.nextVelocity <= 0.01) failures.push(`Partial free-drive throttle does not move on first frame: ${lowFree.nextVelocity}`);
const lowFreeRun = simulateMotion({ seconds: 2, throttle: 0.12, direction: 1, connected: false, stage: 1 });
if (lowFreeRun.position <= 0.5) failures.push(`Partial throttle does not produce useful travel: ${lowFreeRun.position}`);
if (lowFreeRun.peakSpeed >= MAX_FREE_SPEED * 0.5) failures.push(`Partial throttle accelerates too aggressively: ${lowFreeRun.peakSpeed}`);

const towRun = simulateMotion({ seconds: 3, throttle: 0.25, direction: 1, connected: true, stage: 4 });
if (towRun.position <= 1.0) failures.push(`Connected FWD pushback did not travel forward far enough: ${towRun.position}`);
if (towRun.peakSpeed > MAX_TOW_SPEED + 0.01) failures.push(`Connected push exceeds tow speed cap: ${towRun.peakSpeed}`);
const lockedRun = simulateMotion({ seconds: 2, throttle: 1, direction: -1, connected: true, stage: 4 });
if (lockedRun.position !== 0 || lockedRun.peakSpeed !== 0) failures.push(`Connected REV interlock leaked motion: ${JSON.stringify(lockedRun)}`);
for (const stage of [2, 3, 5]) {
  const locked = stepVelocity({ velocity: 0, throttle: 1, direction: stage === 5 ? -1 : 1, connected: true, stage });
  if (locked.targetSpeed !== 0 || locked.nextVelocity !== 0) failures.push(`Connected stage ${stage} should remain stationary`);
}
const brakingRun = simulateMotion({ seconds: 4, throttle: 0.35, direction: 1, connected: true, stage: 4, brakeAt: 2 });
if (brakingRun.velocity !== 0) failures.push(`Brake should settle tow velocity to zero, got ${brakingRun.velocity}`);
if (brakingRun.position <= 0 || brakingRun.position > 3.5) failures.push(`Tow braking distance invalid: ${brakingRun.position}`);

if (!captureReady({ capture: 0.2, lateral: 0.08, heading: 2, speed: 0.04 })) failures.push("Correctly aligned capture should be ready");
if (captureReady({ capture: 0.6, lateral: 0.08, heading: 2, speed: 0.04 })) failures.push("Distant cradle must not capture");
if (captureReady({ capture: 0.25, lateral: 0.24, heading: 2, speed: 0.04 })) failures.push("Off-center cradle must not capture");
if (captureReady({ capture: 0.25, lateral: 0.08, heading: 9, speed: 0.04 })) failures.push("Angled tug must not capture");
if (captureReady({ capture: 0.25, lateral: 0.08, heading: 2, speed: 0.2 })) failures.push("Moving tug must not capture");
if (CRADLE_Z >= 4.5 || CRADLE_Z <= 2.8) failures.push(`Cradle offset outside integrated-pan range: ${CRADLE_Z}`);
approx(NOSE_START_Z - CRADLE_Z, 2.75, 0.55, "Initial tug-body-to-nose spacing");

const capturedLocal = { x: 0.08, z: 0.16 };
for (const heading of [0, Math.PI / 6, -Math.PI / 3, Math.PI]) {
  const worldX = capturedLocal.x * Math.cos(heading) + capturedLocal.z * Math.sin(heading);
  const worldZ = -capturedLocal.x * Math.sin(heading) + capturedLocal.z * Math.cos(heading);
  approx(Math.hypot(worldX, worldZ), Math.hypot(capturedLocal.x, capturedLocal.z), 1e-9, `Tow offset length at heading ${heading}`);
}

let captureOffset = CONNECT_DISTANCE;
let previousCaptureOffset = captureOffset;
for (let frame = 0; frame < 60; frame += 1) {
  captureOffset = decayCaptureOffset(captureOffset, 0.016);
  if (captureOffset >= previousCaptureOffset) failures.push(`Capture offset failed to decrease at frame ${frame}: ${captureOffset}`);
  previousCaptureOffset = captureOffset;
}
if (captureOffset > 0.002) failures.push(`Capture offset did not center within one second: ${captureOffset}`);
const firstCaptureStep = CONNECT_DISTANCE - decayCaptureOffset(CONNECT_DISTANCE, 0.016);
if (firstCaptureStep > 0.05) failures.push(`Capture centering snaps too far in one frame: ${firstCaptureStep}`);

const captureAt30 = simulateCaptureCentering({ dt: 1 / 30 });
const captureAt60 = simulateCaptureCentering({ dt: 1 / 60 });
const captureAt120 = simulateCaptureCentering({ dt: 1 / 120 });
approx(captureAt30, captureAt60, 1e-9, "Capture centering 30/60 Hz equivalence");
approx(captureAt120, captureAt60, 1e-9, "Capture centering 120/60 Hz equivalence");

const seamFrom = Math.PI - 0.02;
const seamTo = -Math.PI + 0.02;
const seamDelta = shortestAngleDelta(seamFrom, seamTo);
if (Math.abs(seamDelta) > 0.05) failures.push(`Heading seam selected long turn: ${seamDelta}`);
let aircraftYaw = seamFrom;
let previousError = Math.abs(shortestAngleDelta(aircraftYaw, seamTo));
for (let frame = 0; frame < 120; frame += 1) {
  const nextYaw = dampAngle(aircraftYaw, seamTo, 0.7, 0.016);
  const frameDelta = Math.abs(shortestAngleDelta(aircraftYaw, nextYaw));
  if (frameDelta > MAX_AIRCRAFT_YAW_RATE * 0.016 + 1e-9) failures.push(`Aircraft yaw exceeded articulation rate: ${frameDelta} rad in one frame`);
  aircraftYaw = nextYaw;
  const error = Math.abs(shortestAngleDelta(aircraftYaw, seamTo));
  if (error > previousError + 1e-9) failures.push(`Aircraft yaw diverged across heading seam: ${error}`);
  previousError = error;
}
if (previousError >= 0.02) failures.push(`Aircraft yaw did not converge smoothly: ${previousError}`);

const yaw30 = simulateYawConvergence({ from: seamFrom, to: seamTo, dt: 1 / 30 });
const yaw60 = simulateYawConvergence({ from: seamFrom, to: seamTo, dt: 1 / 60 });
const yaw120 = simulateYawConvergence({ from: seamFrom, to: seamTo, dt: 1 / 120 });
approx(yaw30.error, yaw60.error, 0.0002, "Yaw convergence 30/60 Hz equivalence");
approx(yaw120.error, yaw60.error, 0.0002, "Yaw convergence 120/60 Hz equivalence");
if (yaw30.maxStep > MAX_AIRCRAFT_YAW_RATE / 30 + 1e-9) failures.push(`30 Hz yaw step exceeded articulation cap: ${yaw30.maxStep}`);
if (yaw120.maxStep > MAX_AIRCRAFT_YAW_RATE / 120 + 1e-9) failures.push(`120 Hz yaw step exceeded articulation cap: ${yaw120.maxStep}`);

const sharpTurnStart = 0;
const sharpTurnTarget = Math.PI / 2;
const sharpTurnNext = dampAngle(sharpTurnStart, sharpTurnTarget, 0.7, 0.04);
const sharpTurnStep = Math.abs(shortestAngleDelta(sharpTurnStart, sharpTurnNext));
approx(sharpTurnStep, MAX_AIRCRAFT_YAW_RATE * 0.04, 1e-9, "Sharp-turn yaw rate cap");

if (failures.length) {
  console.error("RampReady physics verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("RampReady physics verification passed.");