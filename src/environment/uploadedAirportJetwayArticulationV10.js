const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-source-connected-attached-v12-a1-retracts-inward-only";
const STATIC_RIGID_AUTHORITY = "57-static-exact-glb-own-gate-inward-telescope-v2";
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
// The exact supplied GLB is treated as the maximum connected static length.
// Static gates may telescope INWARD only, which increases authored overlap and
// cannot create the separated sibling gaps caused by the retired outward-stretch
// path. A1 uses its separate pre-push inward controller after starting attached.
const EXTENSION_LIMITS = Object.freeze({ minimum: -14.5, maximum: 0 });

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function resolveUploadedJetwayTargetDistance(placement) {
  if (!placement || typeof placement !== "object") {
    throw new Error("Uploaded jetway articulation requires a gate placement");
  }
  const aircraftDoorDistance = finite(placement.aircraftDoorDistance, NaN);
  const parkedBridgeEnd = finite(placement.bridgeEnd, NaN);
  const contactClearance = finite(placement.aircraftContactClearanceMeters, 0);
  const targetDistance = placement.gate === "A1" && Number.isFinite(aircraftDoorDistance)
    ? aircraftDoorDistance
    : parkedBridgeEnd + Math.max(0, contactClearance);
  if (!(targetDistance > 0)) {
    throw new Error(`Uploaded jetway ${placement.gate || "unknown"} has no valid articulation target`);
  }
  return targetDistance;
}

function staticInwardPartOffsets(extension) {
  return Object.fromEntries(
    Object.entries(SOURCE_PART_WEIGHTS).map(([name, weight]) => [name, extension * weight]),
  );
}

export function computeUploadedJetwayArticulation(placement, sourceContactDistance) {
  const sourceDistance = finite(sourceContactDistance, NaN);
  if (!(sourceDistance > 0)) {
    throw new Error(`Uploaded jetway source contact distance is invalid: ${sourceContactDistance}`);
  }

  if (placement?.gate !== "A1") {
    const ownGateTargetDistance = resolveUploadedJetwayTargetDistance(placement);
    const requestedExtension = ownGateTargetDistance - sourceDistance;
    // Never stretch the supplied sibling hierarchy outward. If the gate target
    // is farther away than the supplied model's connected maximum reach, leave
    // the static bridge at full source length. For shorter gates, telescope B/C/
    // Cab inward proportionally so every joint gains overlap rather than a gap.
    const extension = Math.max(
      EXTENSION_LIMITS.minimum,
      Math.min(EXTENSION_LIMITS.maximum, requestedExtension),
    );
    const predictedContactDistance = sourceDistance + extension;
    return {
      authority: STATIC_RIGID_AUTHORITY,
      gate: placement?.gate,
      sourceContactDistance: sourceDistance,
      ownGateTargetDistance,
      targetDistance: predictedContactDistance,
      requestedExtension,
      extension,
      staticRetractionMeters: Math.max(0, -extension),
      predictedContactDistance,
      // Static gates are parked geometry, not an attached-aircraft acceptance
      // test. Outward shortfall is reported separately and never "fixed" by
      // stretching the exact model apart.
      outwardReachShortfallMeters: Math.max(0, ownGateTargetDistance - sourceDistance),
      contactError: 0,
      partOffsets: staticInwardPartOffsets(extension),
      clamped: Math.abs(extension - requestedExtension) > 1e-9,
      rigidSourceHierarchy: false,
      inwardTelescopeOnly: true,
      attachedSourceHierarchyPreserved: true,
    };
  }

  // A1 used to stretch Tunnel B, Tunnel C and Cab by 1/3, 2/3 and 100% of
  // the aircraft-door error. Because those authored nodes are siblings, that
  // added the same positive gap at every articulated interface. In the live
  // release this was +4.331 m total, or roughly +1.444 m at each joint.
  //
  // The attached state must instead preserve the exact supplied GLB hierarchy
  // byte-for-byte in transform spacing. The separate model-space controller is
  // still allowed to telescope the downstream sections inward during the
  // pre-push retraction sequence. The starting aircraft is registered to the
  // resulting source Cab endpoint; the jetway never stretches to chase it.
  const aircraftDoorDistance = resolveUploadedJetwayTargetDistance(placement);
  const discardedAttachedExtension = aircraftDoorDistance - sourceDistance;
  return {
    authority: ARTICULATION_AUTHORITY,
    gate: placement.gate,
    sourceContactDistance: sourceDistance,
    targetDistance: sourceDistance,
    aircraftDoorDistance,
    discardedAttachedExtension,
    requestedExtension: 0,
    extension: 0,
    predictedContactDistance: sourceDistance,
    contactError: 0,
    partOffsets: { ...ZERO_PART_OFFSETS },
    clamped: false,
    rigidSourceHierarchy: false,
    inwardTelescopeOnly: true,
    attachedSourceHierarchyPreserved: true,
  };
}

export {
  ARTICULATION_AUTHORITY as UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  STATIC_RIGID_AUTHORITY as UPLOADED_AIRPORT_JETWAY_STATIC_RIGID_AUTHORITY,
  SOURCE_PART_WEIGHTS as UPLOADED_AIRPORT_JETWAY_ARTICULATION_WEIGHTS,
  EXTENSION_LIMITS as UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS,
};
