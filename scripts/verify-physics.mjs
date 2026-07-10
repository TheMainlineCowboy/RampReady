const NOSE_START_Z = 6.2;
const CRADLE_Z = 3.45;
const MAX_FREE_SPEED = 3.2;
const MAX_TOW_SPEED = 1.25;
const CONNECT_DISTANCE = 0.42;
const CONNECT_LATERAL_LIMIT = 0.2;
const CONNECT_HEADING_LIMIT = 6;
const CONNECT_SPEED_LIMIT = 0.12;

const failures = [];
const approx = (actual, expected, tolerance, label) => {
  if (Math.abs(actual - expected) > tolerance) {
    failures.push(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stepVelocity({ velocity, throttle, direction, connected, stage, brake = false, dt = 0.016 }) {
  const usefulThrottle = throttle > 0.02 ? 0.16 + throttle * 0.84 : 0;
  const connectedPushPhase = connected && stage === 4;
  const connectedMotionLocked = connected && !connectedPushPhase;
  const pushDirectionLocked = connectedPushPhase && direction !== -1;
  const signedDirection = connectedPushPhase ? 1 : direction;
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
  const frames = Math.ceil(seconds / dt);
  for (let frame = 0; frame < frames; frame += 1) {
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

// Partial throttle must create sustained, controllable movement. This prevents the old 100%-only bug.
const lowFree = stepVelocity({ velocity: 0, throttle: 0.12, direction: 1, connected: false, stage: 1 });
if (lowFree.targetSpeed <= 0.22) failures.push(`Partial free-drive throttle too weak: ${lowFree.targetSpeed}`);
if (lowFree.nextVelocity <= 0.01) failures.push(`Partial free-drive throttle does not move on first frame: ${lowFree.nextVelocity}`);
const lowFreeRun = simulateMotion({ seconds: 2, throttle: 0.12, direction: 1, connected: false, stage: 1 });
if (lowFreeRun.position <= 0.5) failures.push(`Partial throttle does not produce useful travel: ${lowFreeRun.position}`);
if (lowFreeRun.peakSpeed >= MAX_FREE_SPEED * 0.5) failures.push(`Partial throttle accelerates too aggressively: ${lowFreeRun.peakSpeed}`);

// Connected pushback with REV selected must move the aircraft toward the red stop line.
const connectedRev = stepVelocity({ velocity: 0, throttle: 0.25, direction: -1, connected: true, stage: 4 });
if (connectedRev.targetSpeed <= 0) failures.push(`Connected REV should produce positive pushback speed, got ${connectedRev.targetSpeed}`);
if (connectedRev.nextVelocity <= 0.01) failures.push(`Connected REV should move on first frame, got ${connectedRev.nextVelocity}`);
const towRun = simulateMotion({ seconds: 3, throttle: 0.25, direction: -1, connected: true, stage: 4 });
if (towRun.position <= 1.0) failures.push(`Connected low-power pushback travel too short: ${towRun.position}`);
if (towRun.peakSpeed > MAX_TOW_SPEED + 0.01) failures.push(`Connected push exceeds tow speed cap: ${towRun.peakSpeed}`);

// FWD during pushback must be interlocked rather than briefly moving the aircraft the wrong way.
const connectedFwd = stepVelocity({ velocity: 0, throttle: 0.25, direction: 1, connected: true, stage: 4 });
if (connectedFwd.targetSpeed !== 0) failures.push(`Connected FWD power should be locked, got ${connectedFwd.targetSpeed}`);
const lockedRun = simulateMotion({ seconds: 2, throttle: 1, direction: 1, connected: true, stage: 4 });
if (lockedRun.position !== 0 || lockedRun.peakSpeed !== 0) failures.push(`Connected FWD interlock leaked motion: ${JSON.stringify(lockedRun)}`);

// Connected equipment must remain stationary through clearance, brake confirmation, and release.
for (const stage of [2, 3, 5]) {
  const locked = stepVelocity({ velocity: 0, throttle: 1, direction: stage === 5 ? -1 : 1, connected: true, stage });
  if (locked.targetSpeed !== 0) failures.push(`Connected stage ${stage} should lock motion, got ${locked.targetSpeed}`);
  if (locked.nextVelocity !== 0) failures.push(`Connected stage ${stage} should remain stationary, got ${locked.nextVelocity}`);
}

// Braking from towing speed must settle promptly without reversing direction.
const brakingRun = simulateMotion({ seconds: 4, throttle: 0.35, direction: -1, connected: true, stage: 4, brakeAt: 2 });
if (brakingRun.velocity !== 0) failures.push(`Brake should settle tow velocity to zero, got ${brakingRun.velocity}`);
if (brakingRun.position <= 0) failures.push(`Braking simulation moved backward unexpectedly: ${brakingRun.position}`);
if (brakingRun.position > 3.5) failures.push(`Tow braking distance is excessive: ${brakingRun.position}`);

// Nose-gear capture requires a tight, stopped, centered, straight approach.
if (!captureReady({ capture: 0.2, lateral: 0.08, heading: 2, speed: 0.04 })) failures.push("Correctly aligned capture should be ready");
if (captureReady({ capture: 0.6, lateral: 0.08, heading: 2, speed: 0.04 })) failures.push("Distant cradle must not capture");
if (captureReady({ capture: 0.25, lateral: 0.24, heading: 2, speed: 0.04 })) failures.push("Off-center cradle must not capture");
if (captureReady({ capture: 0.25, lateral: 0.08, heading: 9, speed: 0.04 })) failures.push("Angled tug must not capture");
if (captureReady({ capture: 0.25, lateral: 0.08, heading: 2, speed: 0.2 })) failures.push("Moving tug must not capture");

// Stable trainer uses a short integrated cradle, not a stretched bucket arm.
if (CRADLE_Z >= 4.5) failures.push(`Cradle offset too long: ${CRADLE_Z}`);
if (CRADLE_Z <= 2.8) failures.push(`Cradle offset too short to represent the pan: ${CRADLE_Z}`);
approx(NOSE_START_Z - CRADLE_Z, 2.75, 0.55, "Initial tug-body-to-nose spacing");

// Rigid attachment math must preserve the captured nose-gear offset through a turn.
const capturedLocal = { x: 0.08, z: 0.16 };
for (const heading of [0, Math.PI / 6, -Math.PI / 3, Math.PI]) {
  const worldX = capturedLocal.x * Math.cos(heading) + capturedLocal.z * Math.sin(heading);
  const worldZ = -capturedLocal.x * Math.sin(heading) + capturedLocal.z * Math.cos(heading);
  approx(Math.hypot(worldX, worldZ), Math.hypot(capturedLocal.x, capturedLocal.z), 1e-9, `Tow offset length at heading ${heading}`);
}

if (failures.length) {
  console.error("RampReady physics verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RampReady physics verification passed.");