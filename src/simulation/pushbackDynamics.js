import { clamp, normalizeAngle, updateAircraftTowPose } from "./towKinematics.js";

export const TUG_WHEELBASE = 2.35;
export const FREE_MAX_SPEED = 3.2;
export const TOW_MAX_SPEED = 1.25;
export const FREE_ACCELERATION = 1.9;
export const TOW_ACCELERATION = 0.72;
export const SERVICE_BRAKE_DECELERATION = 2.8;
export const COAST_DECELERATION = 0.34;
export const MAX_STEER_ANGLE = 0.42;
export const MAX_STEER_RATE = 1.15;
export const JACKKNIFE_WARNING = (52 * Math.PI) / 180;
export const JACKKNIFE_LIMIT = (62 * Math.PI) / 180;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function moveToward(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  if (value > target) return Math.max(target, value - maxDelta);
  return value;
}

export function createPushbackState({ tugX = 0, tugZ = 0, tugYaw = 0, aircraftX = 0, aircraftZ = 6.2, aircraftYaw = 0 } = {}) {
  return {
    tugX,
    tugZ,
    tugYaw,
    aircraftX,
    aircraftZ,
    aircraftYaw,
    mainGearX: aircraftX + Math.sin(aircraftYaw) * 11.2,
    mainGearZ: aircraftZ + Math.cos(aircraftYaw) * 11.2,
    speed: 0,
    steerAngle: 0,
    articulation: normalizeAngle(aircraftYaw - tugYaw),
    jackknifeWarning: false,
    jackknifeLimited: false,
  };
}

export function stepPushbackDynamics(state, command, dt) {
  const safeDt = clamp(finite(dt, 0), 0, 0.05);
  const connected = Boolean(command.connected);
  const throttle = clamp(finite(command.throttle, 0), 0, 1);
  const direction = command.direction === -1 ? -1 : 1;
  const brake = Boolean(command.brake);
  const steerInput = clamp(finite(command.steer, 0), -1, 1);
  const maxSpeed = connected ? TOW_MAX_SPEED : FREE_MAX_SPEED;
  const acceleration = connected ? TOW_ACCELERATION : FREE_ACCELERATION;

  const speedRatio = maxSpeed > 0 ? Math.min(1, Math.abs(state.speed) / maxSpeed) : 0;
  const speedSteerScale = 1 - 0.48 * speedRatio;
  let requestedSteer = steerInput * MAX_STEER_ANGLE * speedSteerScale;

  const currentArticulation = normalizeAngle(finite(state.aircraftYaw) - finite(state.tugYaw));
  const warning = connected && Math.abs(currentArticulation) >= JACKKNIFE_WARNING;
  const limited = connected && Math.abs(currentArticulation) >= JACKKNIFE_LIMIT;

  if (warning && Math.sign(requestedSteer) === Math.sign(currentArticulation)) requestedSteer *= 0.22;
  if (limited && Math.sign(requestedSteer) === Math.sign(currentArticulation)) requestedSteer = 0;

  const steerAngle = moveToward(finite(state.steerAngle), requestedSteer, MAX_STEER_RATE * safeDt);
  const targetSpeed = throttle * direction * maxSpeed;
  let speed = finite(state.speed);

  if (brake) speed = moveToward(speed, 0, SERVICE_BRAKE_DECELERATION * safeDt);
  else if (throttle > 0.001) speed = moveToward(speed, targetSpeed, acceleration * safeDt);
  else speed = moveToward(speed, 0, COAST_DECELERATION * safeDt);

  if (limited && Math.sign(speed) === Math.sign(targetSpeed)) speed = moveToward(speed, 0, SERVICE_BRAKE_DECELERATION * 0.65 * safeDt);

  const tugYaw = normalizeAngle(finite(state.tugYaw) + (speed / TUG_WHEELBASE) * Math.tan(steerAngle) * safeDt);
  const tugX = finite(state.tugX) + Math.sin(tugYaw) * speed * safeDt;
  const tugZ = finite(state.tugZ) + Math.cos(tugYaw) * speed * safeDt;

  if (!connected) {
    return {
      ...state,
      tugX,
      tugZ,
      tugYaw,
      speed,
      steerAngle,
      articulation: currentArticulation,
      jackknifeWarning: false,
      jackknifeLimited: false,
    };
  }

  const previousNose = { x: finite(state.aircraftX), z: finite(state.aircraftZ) };
  const attachedNose = {
    x: tugX + Math.sin(tugYaw) * finite(command.cradleOffset, 3.45),
    z: tugZ + Math.cos(tugYaw) * finite(command.cradleOffset, 3.45),
  };
  const pose = updateAircraftTowPose({
    aircraftYaw: finite(state.aircraftYaw),
    tugYaw,
    previousNose,
    attachedNose,
    mainGear: { x: finite(state.mainGearX), z: finite(state.mainGearZ) },
    dt: safeDt,
    maxArticulation: JACKKNIFE_LIMIT,
  });

  return {
    ...state,
    tugX,
    tugZ,
    tugYaw,
    aircraftX: pose.x,
    aircraftZ: pose.z,
    aircraftYaw: pose.yaw,
    mainGearX: pose.mainGearX,
    mainGearZ: pose.mainGearZ,
    speed,
    steerAngle,
    articulation: pose.articulation,
    jackknifeWarning: Math.abs(pose.articulation) >= JACKKNIFE_WARNING,
    jackknifeLimited: Math.abs(pose.articulation) >= JACKKNIFE_LIMIT - 1e-5,
  };
}
