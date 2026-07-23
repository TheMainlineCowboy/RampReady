export const CAPTURE_CORRECTION_RATE = 0.28;
export const AIRCRAFT_WHEELBASE = 11.2;
export const MAX_AIRCRAFT_YAW_RATE = (8 * Math.PI) / 180;
export const MAX_ARTICULATION = (65 * Math.PI) / 180;
export const MIN_TOW_MOTION = 0.0005;

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
  const noseTravel = Math.hypot(noseDx, noseDz);
  const aircraftRightX = Math.cos(safeAircraftYaw);
  const aircraftRightZ = -Math.sin(safeAircraftYaw);
  const lateralNoseTravel = noseDx * aircraftRightX + noseDz * aircraftRightZ;

  // Treat the aircraft as a long trailer. The captured nose point moves with the tug,
  // while the main-gear axle remains the rotation center and cannot teleport sideways.
  // Yaw is therefore limited by both elapsed time and actual nose displacement. This
  // prevents steering input at zero speed from rotating the aircraft in place and keeps
  // reversal behavior tied to the distance the tug really moved.
  let nextYaw = safeAircraftYaw;
  let requestedYawDelta = 0;
  let motionYawLimit = 0;

  if (noseTravel >= MIN_TOW_MOTION) {
    let axleX = safeMainGear.x - safeAttachedNose.x;
    let axleZ = safeMainGear.z - safeAttachedNose.z;
    let axleDistance = Math.hypot(axleX, axleZ);
    if (!Number.isFinite(axleDistance) || axleDistance < 1e-6) {
      axleX = Math.sin(safeAircraftYaw) * safeWheelbase;
      axleZ = Math.cos(safeAircraftYaw) * safeWheelbase;
      axleDistance = safeWheelbase;
    }

    const desiredYaw = Math.atan2(axleX / axleDistance, axleZ / axleDistance);
    requestedYawDelta = normalizeAngle(desiredYaw - safeAircraftYaw);
    const timeYawLimit = safeYawRate * safeDt;
    motionYawLimit = Math.atan2(noseTravel, safeWheelbase);
    const yawLimit = Math.min(timeYawLimit, motionYawLimit);
    nextYaw = safeAircraftYaw + clamp(requestedYawDelta, -yawLimit, yawLimit);

    let articulation = normalizeAngle(nextYaw - safeTugYaw);
    articulation = clamp(articulation, -safeArticulation, safeArticulation);
    nextYaw = safeTugYaw + articulation;
  }

  const articulation = normalizeAngle(nextYaw - safeTugYaw);
  const nextMainGear = mainGearFromPose(safeAttachedNose, nextYaw, safeWheelbase);
  const expectedMainGear = mainGearFromPose(safeAttachedNose, safeAircraftYaw, safeWheelbase);
  const mainGearLateralSlip = Math.hypot(
    nextMainGear.x - expectedMainGear.x,
    nextMainGear.z - expectedMainGear.z,
  );

  return {
    x: safeAttachedNose.x,
    z: safeAttachedNose.z,
    yaw: nextYaw,
    yawDelta: normalizeAngle(nextYaw - safeAircraftYaw),
    requestedYawDelta,
    motionYawLimit,
    articulation,
    noseTravel,
    lateralNoseTravel,
    mainGearLateralSlip,
    mainGearX: nextMainGear.x,
    mainGearZ: nextMainGear.z,
  };
}
