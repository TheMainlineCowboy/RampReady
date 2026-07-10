const NOSE_START_Z = 6.2;
const CRADLE_Z = 3.45;
const MAX_FREE_SPEED = 3.2;
const MAX_TOW_SPEED = 1.25;

const failures = [];
const approx = (actual, expected, tolerance, label) => {
  if (Math.abs(actual - expected) > tolerance) {
    failures.push(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function stepVelocity({ velocity, throttle, direction, connected, stage, dt = 0.016 }) {
  const usefulThrottle = throttle > 0.02 ? 0.16 + throttle * 0.84 : 0;
  const connectedPushPhase = connected && stage === 4;
  const connectedMotionLocked = connected && !connectedPushPhase;
  const pushDirectionLocked = connectedPushPhase && direction !== -1;
  const signedDirection = connectedPushPhase ? 1 : direction;
  const maxSpeed = connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
  const targetSpeed = connectedMotionLocked || pushDirectionLocked ? 0 : usefulThrottle * signedDirection * maxSpeed;
  const nextVelocity = lerp(velocity, targetSpeed, 1 - Math.exp((connected ? -3.4 : -4.4) * dt));
  return { usefulThrottle, targetSpeed, nextVelocity };
}

// Partial throttle must create a visible movement command. This prevents the old 100%-only bug.
const lowFree = stepVelocity({ velocity: 0, throttle: 0.12, direction: 1, connected: false, stage: 1 });
if (lowFree.targetSpeed <= 0.22) failures.push(`Partial free-drive throttle too weak: ${lowFree.targetSpeed}`);
if (lowFree.nextVelocity <= 0.01) failures.push(`Partial free-drive throttle does not move on first frame: ${lowFree.nextVelocity}`);

// Connected pushback with REV selected must move the aircraft toward the red stop line.
const connectedRev = stepVelocity({ velocity: 0, throttle: 0.25, direction: -1, connected: true, stage: 4 });
if (connectedRev.targetSpeed <= 0) failures.push(`Connected REV should produce positive pushback speed, got ${connectedRev.targetSpeed}`);
if (connectedRev.nextVelocity <= 0.01) failures.push(`Connected REV should move on first frame, got ${connectedRev.nextVelocity}`);

// FWD during pushback must be interlocked rather than briefly moving the aircraft the wrong way.
const connectedFwd = stepVelocity({ velocity: 0, throttle: 0.25, direction: 1, connected: true, stage: 4 });
if (connectedFwd.targetSpeed !== 0) failures.push(`Connected FWD power should be locked, got ${connectedFwd.targetSpeed}`);

// Connected equipment must remain stationary through clearance, brake confirmation, and release.
for (const stage of [2, 3, 5]) {
  const locked = stepVelocity({ velocity: 0, throttle: 1, direction: stage === 5 ? -1 : 1, connected: true, stage });
  if (locked.targetSpeed !== 0) failures.push(`Connected stage ${stage} should lock motion, got ${locked.targetSpeed}`);
  if (locked.nextVelocity !== 0) failures.push(`Connected stage ${stage} should remain stationary, got ${locked.nextVelocity}`);
}

// Stable trainer uses a short integrated cradle, not a stretched bucket arm.
if (CRADLE_Z >= 4.5) failures.push(`Cradle offset too long: ${CRADLE_Z}`);
if (CRADLE_Z <= 2.8) failures.push(`Cradle offset too short to represent the pan: ${CRADLE_Z}`);
approx(NOSE_START_Z - CRADLE_Z, 2.75, 0.55, "Initial tug-body-to-nose spacing");

if (failures.length) {
  console.error("RampReady physics verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RampReady physics verification passed.");
