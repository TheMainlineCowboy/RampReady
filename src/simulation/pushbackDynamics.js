import { clamp, normalizeAngle, updateAircraftTowPose } from "./towKinematics.js";
import { getVehiclePhysicsProfile } from "../config/vehiclePhysicsProfiles.js";

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

function positive(value, fallback) {
  const resolved = finite(value, fallback);
  return resolved > 0 ? resolved : fallback;
}

function nonnegative(value, fallback) {
  const resolved = finite(value, fallback);
  return resolved >= 0 ? resolved : fallback;
}

function moveToward(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  if (value > target) return Math.max(target, value - maxDelta);
  return value;
}

function inferredProfile(command, steeringMode, wheelbase) {
  if (command.vehicleId) return getVehiclePhysicsProfile(command.vehicleId);
  if (steeringMode === "front") return getVehiclePhysicsProfile("manager-kubota");
  return getVehiclePhysicsProfile(wheelbase < 2 ? "standup-tug" : "lektro-88");
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
  const steeringMode = command.steeringMode === "rear" ? "rear" : "front";
  const wheelbase = Math.max(0.5, finite(command.wheelbase, TUG_WHEELBASE));
  const profile = inferredProfile(command, steeringMode, wheelbase);

  const freeMaxSpeed = positive(command.freeMaxSpeed, profile.freeMaxSpeed ?? FREE_MAX_SPEED);
  const towMaxSpeed = positive(command.towMaxSpeed, profile.towMaxSpeed || TOW_MAX_SPEED);
  const freeAcceleration = positive(command.freeAcceleration, profile.freeAcceleration ?? FREE_ACCELERATION);
  const towAcceleration = positive(command.towAcceleration, profile.towAcceleration || TOW_ACCELERATION);
  const serviceBrakeDeceleration = positive(command.serviceBrakeDeceleration, profile.serviceBrakeDeceleration ?? SERVICE_BRAKE_DECELERATION);
  const coastDeceleration = nonnegative(command.coastDeceleration, profile.coastDeceleration ?? COAST_DECELERATION);
  const maxSteerAngle = positive(command.maxSteerAngle, profile.maxSteerAngle ?? MAX_STEER_ANGLE);
  const kinematicMaxSteerAngle = positive(command.kinematicMaxSteerAngle, profile.kinematicMaxSteerAngle ?? maxSteerAngle);
  const maxSteerRate = positive(command.maxSteerRate, profile.maxSteerRate ?? MAX_STEER_RATE);
  const fullLockSpeedScale = clamp(finite(command.fullLockSpeedScale, profile.fullLockSpeedScale ?? 0.52), 0.04, 1);
  const maxSpeed = connected ? towMaxSpeed : freeMaxSpeed;
  const acceleration = connected ? towAcceleration : freeAcceleration;

  let requestedSteer = steerInput * maxSteerAngle;
  const currentArticulation = normalizeAngle(finite(state.aircraftYaw) - finite(state.tugYaw));
  const warning = connected && Math.abs(currentArticulation) >= JACKKNIFE_WARNING;
  const limited = connected && Math.abs(currentArticulation) >= JACKKNIFE_LIMIT;

  if (warning && Math.sign(requestedSteer) === Math.sign(currentArticulation)) requestedSteer *= 0.42;
  if (limited && Math.sign(requestedSteer) === Math.sign(currentArticulation)) requestedSteer = 0;

  const steerAngle = moveToward(finite(state.steerAngle), requestedSteer, maxSteerRate * safeDt);
  const physicalSteerRatio = maxSteerAngle > 0 ? Math.min(1, Math.abs(steerAngle) / maxSteerAngle) : 0;
  const steerSpeedScale = 1 - (1 - fullLockSpeedScale) * physicalSteerRatio * physicalSteerRatio;
  const targetSpeed = throttle * direction * maxSpeed * steerSpeedScale;
  let speed = finite(state.speed);

  if (brake) speed = moveToward(speed, 0, serviceBrakeDeceleration * safeDt);
  else if (throttle > 0.001) speed = moveToward(speed, targetSpeed, acceleration * safeDt);
  else speed = moveToward(speed, 0, coastDeceleration * safeDt);

  if (limited && Math.sign(speed) === Math.sign(targetSpeed)) speed = moveToward(speed, 0, serviceBrakeDeceleration * 0.65 * safeDt);

  const effectiveSteer = clamp(steerAngle, -kinematicMaxSteerAngle, kinematicMaxSteerAngle);
  let tugYaw;
  let travelYaw;
  if (steeringMode === "rear") {
    const rearAxleAngle = -effectiveSteer;
    const slipAngle = Math.atan(0.5 * Math.tan(rearAxleAngle));
    const yawRate = -(speed / wheelbase) * Math.cos(slipAngle) * Math.tan(rearAxleAngle);
    tugYaw = normalizeAngle(finite(state.tugYaw) + yawRate * safeDt);
    travelYaw = tugYaw + slipAngle;
  } else {
    tugYaw = normalizeAngle(finite(state.tugYaw) + (speed / wheelbase) * Math.tan(effectiveSteer) * safeDt);
    travelYaw = tugYaw;
  }

  const tugX = finite(state.tugX) + Math.sin(travelYaw) * speed * safeDt;
  const tugZ = finite(state.tugZ) + Math.cos(travelYaw) * speed * safeDt;

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
