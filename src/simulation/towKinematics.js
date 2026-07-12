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

function positiveFinite(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function finitePoint(point, fallback = { x: 0, z: 0 }) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return fallback;
  return point;
}

export function settleCaptureOffset(offset, dt, correctionRate = CAPTURE_CORRECTION_RATE) {
  const safeDt = positiveFinite(dt, 0);
  const safeCorrectionRate = positiveFinite(correctionRate, CAPTURE_CORRECTION_RATE);
  const safeOffset = finitePoint(offset);
  const distance = Math.hypot(safeOffset.x, safeOffset.z);
  if (!Number.isFinite(distance) || distance < 0.002) return { x: 0, z: 0 };
  const maxCorrection = safeCorrectionRate * safeDt;
  if (distance <= maxCorrection) return { x: 0, z: 0 };
  const scale = (distance - maxCorrection) / distance;
  return { x: safeOffset.x * scale, z: safeOffset.z * scale };
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
  const safeDt = positiveFinite(dt, 0);
  const safeWheelbase = positiveFinite(wheelbase, AIRCRAFT_WHEELBASE);
  const safeYawRate = positiveFinite(maxYawRate, MAX_AIRCRAFT_YAW_RATE);
  const safeArticulation = positiveFinite(maxArticulation, MAX_ARTICULATION);
  const safeAttachedNose = finitePoint(attachedNose);
  const safePreviousNose = finitePoint(previousNose, safeAttachedNose);
  const safeAircraftYaw = Number.isFinite(aircraftYaw) ? aircraftYaw : 0;
  const safeTugYaw = Number.isFinite(tugYaw) ? tugYaw : safeAircraftYaw;
  const noseDx = safeAttachedNose.x - safePreviousNose.x;
  const noseDz = safeAttachedNose.z - safePreviousNose.z;
  const aircraftRightX = Math.cos(safeAircraftYaw);
  const aircraftRightZ = -Math.sin(safeAircraftYaw);
  const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;
  const requestedYawStep = lateralNoseTravel / safeWheelbase;
  const yawRateStep = clamp(requestedYawStep, -safeYawRate * safeDt, safeYawRate * safeDt);
  const articulation = normalizeAngle(safeAircraftYaw - safeTugYaw);
  const boundedArticulation = clamp(articulation + yawRateStep, -safeArticulation, safeArticulation);
  return {
    x: safeAttachedNose.x,
    z: safeAttachedNose.z,
    yaw: safeTugYaw + boundedArticulation,
    articulation: boundedArticulation,
    lateralNoseTravel,
  };
}
