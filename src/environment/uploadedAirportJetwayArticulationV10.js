const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only";
const STATIC_RIGID_AUTHORITY = "57-static-exact-glb-rigid-source-hierarchy-v1";
const SOURCE_PART_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});
const ZERO_PART_OFFSETS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 0,
  Tunnel_C: 0,
  Cab: 0,
});
// A1 remains the only bridge that is allowed to telescope for the training
// sequence. The other 57 bridges are unoccupied scenery and must preserve the
// exact supplied GLB hierarchy as one rigid assembly. Artificially retracting
// them by up to ~14.5 m was visibly pulling Tunnel B/C and Cab away from each
// other and producing the broken/falling-off appearance in live screenshots.
const EXTENSION_LIMITS = Object.freeze({ minimum: -14.5, maximum: 8.75 });

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

  // Static gates have no aircraft to fit. Keep every authored source part at
  // its exact GLB transform so Tunnel A/B/C, the Rotunda and Cab cannot separate.
  if (placement?.gate !== "A1") {
    return {
      authority: STATIC_RIGID_AUTHORITY,
      gate: placement?.gate,
      sourceContactDistance: sourceDistance,
      targetDistance: sourceDistance,
      requestedExtension: 0,
      extension: 0,
      predictedContactDistance: sourceDistance,
      contactError: 0,
      partOffsets: { ...ZERO_PART_OFFSETS },
      clamped: false,
      rigidSourceHierarchy: true,
    };
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
    rigidSourceHierarchy: false,
  };
}

export {
  ARTICULATION_AUTHORITY as UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  STATIC_RIGID_AUTHORITY as UPLOADED_AIRPORT_JETWAY_STATIC_RIGID_AUTHORITY,
  SOURCE_PART_WEIGHTS as UPLOADED_AIRPORT_JETWAY_ARTICULATION_WEIGHTS,
  EXTENSION_LIMITS as UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS,
};
