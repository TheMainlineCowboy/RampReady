const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-full-3d-door-plane-v14";
const A1_CRJ700_FORWARD_LEFT_DOOR_AUTHORITY = "authored-crj700-forward-left-door-from-model-v14";
const A1_CRJ700_FORWARD_LEFT_DOOR_WORLD = Object.freeze({
  x: -1.309233922,
  y: 1.72,
  z: 2.23886,
});
const SOURCE_PART_Z_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});
const SOURCE_PART_Y_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});
const EXTENSION_LIMITS = Object.freeze({ minimum: -14.25, maximum: 14.25 });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value)));
}

export function normalizeJetwayAngle(angle) {
  let value = finite(angle);
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function rotateXZ(vector, yaw) {
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  return {
    x: cosine * vector.x + sine * vector.z,
    y: vector.y,
    z: -sine * vector.x + cosine * vector.z,
  };
}

function resolveTarget(placement) {
  if (!placement || typeof placement !== "object") throw new Error("Uploaded jetway articulation requires a gate placement");
  const attached = placement.gate === "A1";
  const authoredA1Target = attached ? A1_CRJ700_FORWARD_LEFT_DOOR_WORLD : null;
  const hasPlacementTarget = Number.isFinite(Number(placement.targetX))
    && Number.isFinite(Number(placement.targetZ));
  const targetX = authoredA1Target
    ? authoredA1Target.x - finite(placement.x)
    : hasPlacementTarget
      ? finite(placement.targetX) - finite(placement.x)
      : Math.sin(finite(placement.yaw)) * finite(placement.bridgeEnd, NaN);
  const targetZ = authoredA1Target
    ? authoredA1Target.z - finite(placement.z)
    : hasPlacementTarget
      ? finite(placement.targetZ) - finite(placement.z)
      : Math.cos(finite(placement.yaw)) * finite(placement.bridgeEnd, NaN);
  const targetY = authoredA1Target ? authoredA1Target.y : finite(placement.cabinY, NaN);
  if (![targetX, targetY, targetZ].every(Number.isFinite)) {
    throw new Error(`Uploaded jetway ${placement.gate || "unknown"} has no valid 3D target`);
  }
  const aircraftHeading = finite(placement.aircraftHeading, NaN);
  const desiredOpeningYaw = Number.isFinite(aircraftHeading)
    ? normalizeJetwayAngle(-aircraftHeading)
    : normalizeJetwayAngle(finite(placement.yaw));
  return {
    attached,
    targetAuthority: authoredA1Target
      ? A1_CRJ700_FORWARD_LEFT_DOOR_AUTHORITY
      : hasPlacementTarget
        ? "package-placement-aircraft-target"
        : "package-static-bridge-end-target",
    point: { x: targetX, y: targetY, z: targetZ },
    worldPoint: authoredA1Target
      ? { ...authoredA1Target }
      : { x: finite(placement.x) + targetX, y: targetY, z: finite(placement.z) + targetZ },
    desiredOpeningYaw,
    targetDistance: Math.hypot(targetX, targetZ),
  };
}

export function computeUploadedJetwayArticulation(placement, sourceGeometry) {
  const geometry = sourceGeometry || {};
  const cabPivot = geometry.cabPivot || {};
  const contactLever = geometry.cabContactLever || {};
  const sourceOpeningYaw = finite(geometry.cabOpeningYaw, 0);
  const sourcePivotX = finite(cabPivot.x, NaN);
  const sourcePivotY = finite(cabPivot.y, NaN);
  const sourcePivotZ = finite(cabPivot.z, NaN);
  const sourceContactY = finite(geometry.cabContact?.y, NaN);
  if (![sourcePivotX, sourcePivotY, sourcePivotZ, sourceContactY].every(Number.isFinite)) {
    throw new Error("Uploaded jetway source geometry is missing the supplied Cab pivot/contact pose");
  }
  const lever = {
    x: finite(contactLever.x, NaN),
    y: finite(contactLever.y, NaN),
    z: finite(contactLever.z, NaN),
  };
  if (![lever.x, lever.y, lever.z].every(Number.isFinite)) {
    throw new Error("Uploaded jetway source geometry is missing the supplied Cab contact lever");
  }

  const target = resolveTarget(placement);
  const cabWorldRotation = normalizeJetwayAngle(target.desiredOpeningYaw - sourceOpeningYaw);
  const rotatedLever = rotateXZ(lever, cabWorldRotation);
  const desiredPivot = {
    x: target.point.x - rotatedLever.x,
    y: target.point.y - rotatedLever.y,
    z: target.point.z - rotatedLever.z,
  };
  const desiredPivotRadius = Math.hypot(desiredPivot.x, desiredPivot.z);
  if (!(desiredPivotRadius > Math.abs(sourcePivotX))) {
    throw new Error(`Uploaded jetway ${placement.gate} cannot solve the supplied Cab pivot radius`);
  }
  const solvedPivotZ = Math.sqrt(Math.max(0, desiredPivotRadius ** 2 - sourcePivotX ** 2));
  const requestedExtension = solvedPivotZ - sourcePivotZ;
  const extension = clamp(requestedExtension, EXTENSION_LIMITS.minimum, EXTENSION_LIMITS.maximum);
  const articulatedPivotZ = sourcePivotZ + extension;
  const sourcePivotAngle = Math.atan2(sourcePivotX, articulatedPivotZ);
  const desiredPivotAngle = Math.atan2(desiredPivot.x, desiredPivot.z);
  const anchorYaw = normalizeJetwayAngle(desiredPivotAngle - sourcePivotAngle);
  const cabYawOffset = normalizeJetwayAngle(target.desiredOpeningYaw - anchorYaw - sourceOpeningYaw);
  const cabVerticalOffset = target.point.y - sourceContactY;

  const partOffsets = Object.fromEntries(
    Object.keys(SOURCE_PART_Z_WEIGHTS).map((part) => [part, {
      z: extension * SOURCE_PART_Z_WEIGHTS[part],
      y: cabVerticalOffset * SOURCE_PART_Y_WEIGHTS[part],
    }]),
  );

  const predictedPivot = rotateXZ({ x: sourcePivotX, y: sourcePivotY + cabVerticalOffset, z: articulatedPivotZ }, anchorYaw);
  predictedPivot.y = sourcePivotY + cabVerticalOffset;
  const predictedLever = rotateXZ(lever, anchorYaw + cabYawOffset);
  const predictedContact = {
    x: predictedPivot.x + predictedLever.x,
    y: predictedPivot.y + predictedLever.y,
    z: predictedPivot.z + predictedLever.z,
  };
  const contactError = Math.hypot(
    predictedContact.x - target.point.x,
    predictedContact.y - target.point.y,
    predictedContact.z - target.point.z,
  );
  const predictedOpeningYaw = normalizeJetwayAngle(sourceOpeningYaw + anchorYaw + cabYawOffset);
  const openingYawError = Math.abs(normalizeJetwayAngle(predictedOpeningYaw - target.desiredOpeningYaw));

  return {
    authority: ARTICULATION_AUTHORITY,
    targetAuthority: target.targetAuthority,
    gate: placement.gate,
    attached: target.attached,
    sourceContactDistance: finite(geometry.sourceContactDistance, NaN),
    targetDistance: target.targetDistance,
    targetContact: target.point,
    targetWorldContact: target.worldPoint,
    desiredOpeningYaw: target.desiredOpeningYaw,
    sourceOpeningYaw,
    anchorYaw,
    cabYawOffset,
    requestedExtension,
    extension,
    cabVerticalOffset,
    predictedContact,
    predictedDoorGap: contactError,
    openingYawError,
    partOffsets,
    clamped: Math.abs(requestedExtension - extension) > 1e-6,
  };
}

export {
  ARTICULATION_AUTHORITY as UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  A1_CRJ700_FORWARD_LEFT_DOOR_AUTHORITY as UPLOADED_AIRPORT_JETWAY_A1_TARGET_AUTHORITY,
  A1_CRJ700_FORWARD_LEFT_DOOR_WORLD as UPLOADED_AIRPORT_JETWAY_A1_TARGET_WORLD,
  SOURCE_PART_Z_WEIGHTS as UPLOADED_AIRPORT_JETWAY_ARTICULATION_WEIGHTS,
  SOURCE_PART_Y_WEIGHTS as UPLOADED_AIRPORT_JETWAY_VERTICAL_WEIGHTS,
  EXTENSION_LIMITS as UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS,
};
