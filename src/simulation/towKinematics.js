export const CAPTURE_CORRECTION_RATE = 0.28;
export const AIRCRAFT_WHEELBASE = 11.2;
export const MAX_AIRCRAFT_YAW_RATE = (8 * Math.PI) / 180;
export const MAX_ARTICULATION = (65 * Math.PI) / 180;

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

function mainGearFromPose(nose, yaw, wheelbase) {
  return {
    x: nose.x + Math.sin(yaw) * wheelbase,
    z: nose.z + Math.cos(yaw) * wheelbase,
  };
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
  mainGear,
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
  const safeMainGear = finitePoint(mainGear, mainGearFromPose(safePreviousNose, safeAircraftYaw, safeWheelbase));

  const noseDx = safeAttachedNose.x - safePreviousNose.x;
  const noseDz = safeAttachedNose.z - safePreviousNose.z;
  const aircraftRightX = Math.cos(safeAircraftYaw);
  const aircraftRightZ = -Math.sin(safeAircraftYaw);
  const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;

  // Treat the aircraft as a long trailer. The tug controls the nose point, while the main-gear axle
  // follows behind and cannot instantly copy the tug heading. Projecting the previous axle onto the
  // wheelbase circle produces the delayed, opposite-sign aircraft response seen in real pushbacks.
  let axleX = safeMainGear.x - safeAttachedNose.x;
  let axleZ = safeMainGear.z - safeAttachedNose.z;
  let axleDistance = Math.hypot(axleX, axleZ);
  if (!Number.isFinite(axleDistance) || axleDistance < 1e-6) {
    axleX = Math.sin(safeAircraftYaw) * safeWheelbase;
    axleZ = Math.cos(safeAircraftYaw) * safeWheelbase;
    axleDistance = safeWheelbase;
  }

  const desiredYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);
  const requestedYawDelta = normalizeAngle(desiredYaw - safeAircraftYaw);
  const yawRateLimit = safeYawRate * safeDt;
  let nextYaw = safeAircraftYaw + clamp(requestedYawDelta, -yawRateLimit, yawRateLimit);

  let articulation = normalizeAngle(nextYaw - safeTugYaw);
  articulation = clamp(articulation, -safeArticulation, safeArticulation);
  nextYaw = safeTugYaw + articulation;

  const nextMainGear = mainGearFromPose(safeAttachedNose, nextYaw, safeWheelbase);
  return {
    x: safeAttachedNose.x,
    z: safeAttachedNose.z,
    yaw: nextYaw,
    articulation,
    lateralNoseTravel,
    mainGearX: nextMainGear.x,
    mainGearZ: nextMainGear.z,
  };
}
