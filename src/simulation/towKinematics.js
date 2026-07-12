export const CAPTURE_CORRECTION_RATE = 0.28;
export const AIRCRAFT_WHEELBASE = 11.2;
export const MAX_AIRCRAFT_YAW_RATE = Math.PI / 15;
export const MAX_ARTICULATION = (70 * Math.PI) / 180;

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function settleCaptureOffset(offset, dt, correctionRate = CAPTURE_CORRECTION_RATE) {
  const distance = Math.hypot(offset.x, offset.z);
  const maxCorrection = correctionRate * dt;
  if (distance <= maxCorrection || distance < 0.002) return { x: 0, z: 0 };
  const scale = (distance - maxCorrection) / distance;
  return { x: offset.x * scale, z: offset.z * scale };
}

export function updateAircraftTowPose({
  aircraftYaw,
  tugYaw,
  previousNose,
  attachedNose,
  dt,
  wheelbase = AIRCRAFT_WHEELBASE,
  maxYawRate = MAX_AIRCRAFT_YAW_RATE,
  maxArticulation = MAX_ARTICULATION,
}) {
  const noseDx = attachedNose.x - previousNose.x;
  const noseDz = attachedNose.z - previousNose.z;
  const aircraftRightX = Math.cos(aircraftYaw);
  const aircraftRightZ = -Math.sin(aircraftYaw);
  const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;
  const requestedYawStep = lateralNoseTravel / wheelbase;
  const yawRateStep = clamp(requestedYawStep, -maxYawRate * dt, maxYawRate * dt);
  const articulation = normalizeAngle(aircraftYaw - tugYaw);
  const boundedArticulation = clamp(articulation + yawRateStep, -maxArticulation, maxArticulation);
  return {
    x: attachedNose.x,
    z: attachedNose.z,
    yaw: tugYaw + boundedArticulation,
    articulation: boundedArticulation,
    lateralNoseTravel,
  };
}
