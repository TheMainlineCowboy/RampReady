const MAX_FREE_SPEED = 3.2;
const MAX_TOW_SPEED = 1.25;
const FRAME_RATES = [30, 60, 120];
const failures = [];

const lerp = (a, b, t) => a + (b - a) * t;

function stepVelocity({ velocity, throttle, direction, connected, stage, dt }) {
  const usefulThrottle = throttle > 0.02 ? 0.16 + throttle * 0.84 : 0;
  const connectedPushPhase = connected && stage === 4;
  const connectedMotionLocked = connected && !connectedPushPhase;
  const pushDirectionLocked = connectedPushPhase && direction !== -1;
  const signedDirection = direction;
  const maxSpeed = connected ? MAX_TOW_SPEED : MAX_FREE_SPEED;
  const targetSpeed = connectedMotionLocked || pushDirectionLocked
    ? 0
    : usefulThrottle * signedDirection * maxSpeed;
  let nextVelocity = lerp(velocity, targetSpeed, 1 - Math.exp((connected ? -3.4 : -4.4) * dt));
  if (usefulThrottle === 0) nextVelocity = lerp(nextVelocity, 0, 1 - Math.exp(-1.7 * dt));
  if (Math.abs(nextVelocity) < 0.01 && usefulThrottle === 0) nextVelocity = 0;
  return { targetSpeed, nextVelocity };
}

function simulate({ fps, seconds, throttle, direction, connected, stage }) {
  const dt = 1 / fps;
  let velocity = 0;
  let position = 0;
  let firstMovingFrame = null;
  for (let frame = 0; frame < Math.ceil(seconds * fps); frame += 1) {
    const result = stepVelocity({ velocity, throttle, direction, connected, stage, dt });
    velocity = result.nextVelocity;
    position += velocity * dt;
    if (firstMovingFrame === null && Math.abs(velocity) >= 0.01) firstMovingFrame = frame + 1;
  }
  return { velocity, position, firstMovingFrame };
}

const freeResults = FRAME_RATES.map((fps) => ({ fps, ...simulate({ fps, seconds: 2, throttle: 0.08, direction: 1, connected: false, stage: 1 }) }));
const towResults = FRAME_RATES.map((fps) => ({ fps, ...simulate({ fps, seconds: 3, throttle: 0.12, direction: -1, connected: true, stage: 4 }) }));

for (const result of freeResults) {
  if (result.firstMovingFrame === null || result.firstMovingFrame > 5) failures.push(`${result.fps} Hz free drive did not respond promptly: ${JSON.stringify(result)}`);
  if (result.position <= 0.35) failures.push(`${result.fps} Hz free drive partial throttle travel too small: ${result.position}`);
  if (result.velocity >= MAX_FREE_SPEED * 0.4) failures.push(`${result.fps} Hz free drive partial throttle too aggressive: ${result.velocity}`);
}

for (const result of towResults) {
  if (result.firstMovingFrame === null || result.firstMovingFrame > 8) failures.push(`${result.fps} Hz connected REV did not respond promptly: ${JSON.stringify(result)}`);
  if (result.position >= -0.65) failures.push(`${result.fps} Hz connected REV partial throttle travel too small: ${result.position}`);
  if (Math.abs(result.velocity) >= MAX_TOW_SPEED * 0.5) failures.push(`${result.fps} Hz connected REV partial throttle too aggressive: ${result.velocity}`);
}

const freePositions = freeResults.map(({ position }) => position);
const towPositions = towResults.map(({ position }) => position);
if (Math.max(...freePositions) - Math.min(...freePositions) > 0.025) failures.push(`Free-drive partial throttle is frame-rate dependent: ${freePositions.join(", ")}`);
if (Math.max(...towPositions) - Math.min(...towPositions) > 0.025) failures.push(`Tow partial throttle is frame-rate dependent: ${towPositions.join(", ")}`);

const deadband = simulate({ fps: 60, seconds: 2, throttle: 0.02, direction: 1, connected: false, stage: 1 });
if (deadband.position !== 0 || deadband.velocity !== 0) failures.push(`Throttle deadband leaked movement: ${JSON.stringify(deadband)}`);

const locked = simulate({ fps: 60, seconds: 2, throttle: 1, direction: 1, connected: true, stage: 4 });
if (locked.position !== 0 || locked.velocity !== 0) failures.push(`Connected FWD interlock leaked movement: ${JSON.stringify(locked)}`);

if (failures.length) {
  console.error("RampReady partial-throttle verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RampReady partial-throttle verification passed.");
console.log(JSON.stringify({ freeResults, towResults }, null, 2));
