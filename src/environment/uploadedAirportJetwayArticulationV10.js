const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-per-gate-telescoping-v10";
const SOURCE_PART_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});
// Measured against the supplied Tunnel A/B/C hierarchy. At -14.25 m the
// sections remain ordered and nested, while the shortest authored static park
// target (11.9 m) remains reachable from the 25.981 m source pose.
const EXTENSION_LIMITS = Object.freeze({ minimum: -14.25, maximum: 8.75 });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, finite(value)));
}

export function resolveUploadedJetwayTargetDistance(placement) {
  if (!placement || typeof placement !== "object") {
    throw new Error("Uploaded jetway articulation requires a gate placement");
  }
  const aircraftDoorDistance = finite(placement.aircraftDoorDistance, NaN);
  const parkedBridgeEnd = finite(placement.bridgeEnd, NaN);
  const targetDistance = placement.gate === "A1" && Number.isFinite(aircraftDoorDistance)
    ? aircraftDoorDistance
    : parkedBridgeEnd;
  if (!(targetDistance > 0)) {
    throw new Error(`Uploaded jetway ${placement.gate || "unknown"} has no valid articulation target`);
  }
  return targetDistance;
}

export function computeUploadedJetwayArticulation(placement, sourceContactDistance) {
  const sourceDistance = finite(sourceContactDistance, NaN);
  if (!(sourceDistance > 0)) {
    throw new Error(`Uploaded jetway source contact distance is invalid: ${sourceContactDistance}`);
  }
  const targetDistance = resolveUploadedJetwayTargetDistance(placement);
  const requestedExtension = targetDistance - sourceDistance;
  const extension = clamp(requestedExtension, EXTENSION_LIMITS.minimum, EXTENSION_LIMITS.maximum);
  const predictedContactDistance = sourceDistance + extension;
  const contactError = targetDistance - predictedContactDistance;
  const partOffsets = Object.fromEntries(
    Object.entries(SOURCE_PART_WEIGHTS).map(([part, weight]) => [part, extension * weight]),
  );
  return {
    authority: ARTICULATION_AUTHORITY,
    gate: placement.gate,
    sourceContactDistance,
    targetDistance,
    requestedExtension,
    extension,
    predictedContactDistance,
    contactError,
    partOffsets,
    clamped: Math.abs(requestedExtension - extension) > 1e-6,
  };
}

export {
  ARTICULATION_AUTHORITY as UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  SOURCE_PART_WEIGHTS as UPLOADED_AIRPORT_JETWAY_ARTICULATION_WEIGHTS,
  EXTENSION_LIMITS as UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS,
};
