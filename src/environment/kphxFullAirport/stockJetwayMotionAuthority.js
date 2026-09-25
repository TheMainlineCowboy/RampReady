const freezeCurve = (values) => Object.freeze([...values]);

const RAW_PROFILES = Object.freeze([
  Object.freeze({
    id: "straight-18m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-Straight-18m.obj",
    nominalReachMeters: 18,
    referenceRestHingeDegrees: 0,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    bridgeYawDegrees: freezeCurve([-3.26757829, 18.49507823]),
    cabinRelativeYawDegrees: freezeCurve([0, -20.60012374]),
    innerTunnelTranslationYMeters: freezeCurve([0, -1.64999988]),
    sourceBridgePitchDegreesAtMinus2: 5.89974622,
  }),
  Object.freeze({
    id: "straight-26m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-Straight-26m.obj",
    nominalReachMeters: 26,
    referenceRestHingeDegrees: 0,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    bridgeYawDegrees: freezeCurve([-2.22937887, 13.31038237]),
    cabinRelativeYawDegrees: freezeCurve([0, -15.73227524]),
    innerTunnelTranslationYMeters: freezeCurve([0, -1.64999998]),
    sourceBridgePitchDegreesAtMinus2: 4.19978044,
  }),
  Object.freeze({
    id: "straight-32m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-Straight-32m.obj",
    nominalReachMeters: 32,
    referenceRestHingeDegrees: 0,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    bridgeYawDegrees: freezeCurve([-1.87930158, 11.13486211]),
    cabinRelativeYawDegrees: freezeCurve([1.54469424, -11.20017921]),
    innerTunnelTranslationYMeters: freezeCurve([0, -0.91999996]),
    sourceBridgePitchDegreesAtMinus2: 3.50019917,
  }),
  Object.freeze({
    id: "standard-18m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-18m.obj",
    nominalReachMeters: 18,
    referenceRestHingeDegrees: 42.77473587,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    bridgeYawDegrees: freezeCurve([42.77473587, 55.82098458]),
    cabinRelativeYawDegrees: freezeCurve([-44.49991188, -57.49974945]),
    innerTunnelTranslationYMeters: freezeCurve([0, -5.71999979]),
    sourceBridgePitchDegreesAtMinus2: 4.6999727,
  }),
  Object.freeze({
    id: "standard-26m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-26m.obj",
    nominalReachMeters: 26,
    referenceRestHingeDegrees: 58.87485095,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    bridgeYawDegrees: freezeCurve([58.87485095, 66.4785727]),
    cabinRelativeYawDegrees: freezeCurve([-60.6997204, -67.50015727]),
    innerTunnelTranslationYMeters: freezeCurve([-0.64999994, -7.41999963]),
    sourceBridgePitchDegreesAtMinus2: 3.99981854,
  }),
  Object.freeze({
    id: "perpendicular-18m",
    sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-Perpendicular-18m.obj",
    nominalReachMeters: 18,
    referenceRestHingeDegrees: 90,
    latRangeMeters: freezeCurve([0, 7.5]),
    vertRangeMeters: freezeCurve([-2, 0]),
    // This reference translates the top-level bridge laterally rather than
    // adding a main yaw curve. RampReady keeps the real WED hinge fixed, so
    // the perpendicular reference contributes telescope/vertical semantics
    // while main bridge yaw remains at its authored WED rest angle.
    bridgeYawDegrees: freezeCurve([0, 0]),
    cabinRelativeYawDegrees: freezeCurve([0, 0]),
    innerTunnelTranslationYMeters: freezeCurve([0, -7.61999989]),
    sourceBridgePitchDegreesAtMinus2: 4.60027797,
  }),
]);

const byId = new Map(RAW_PROFILES.map((profile) => [profile.id, profile]));

function normalizedTurnDegrees(value) {
  let turn = Number(value);
  while (turn > 90) turn -= 180;
  while (turn < -90) turn += 180;
  return turn;
}

function signedTurnAtHinge(rig, footprint) {
  const pivotIndex = rig.pivotFootprintIndex;
  if (pivotIndex < 1) {
    throw new Error(`${rig.gate} jetway hinge has no authored incoming static segment`);
  }
  const previous = footprint[pivotIndex - 1];
  const pivot = footprint[pivotIndex];
  const cabin = footprint[rig.cabinJointFootprintIndex];
  if (!previous || !pivot || !cabin) {
    throw new Error(`${rig.gate} jetway hinge vectors are incomplete`);
  }
  const incomingX = pivot.x - previous.x;
  const incomingZ = pivot.y - previous.y;
  const tunnelX = cabin.x - pivot.x;
  const tunnelZ = cabin.y - pivot.y;
  const incomingLength = Math.hypot(incomingX, incomingZ);
  const tunnelLength = Math.hypot(tunnelX, tunnelZ);
  if (!(incomingLength > 0.01 && tunnelLength > 0.01)) {
    throw new Error(`${rig.gate} jetway hinge vectors are degenerate`);
  }
  const dot = incomingX * tunnelX + incomingZ * tunnelZ;
  const cross = incomingX * tunnelZ - incomingZ * tunnelX;

  // RampReady's 2D facade footprint uses [x,z] = [-north,-east].
  // Relative to WED's [east,north] plane that swaps the axes and therefore
  // reverses signed turn handedness. Negate the local-space cross-product
  // angle so the selector matches the authored WED/MisterX turn direction.
  return -Math.atan2(cross, dot) * 180 / Math.PI;
}

function mirroredProfile(profile, mirrorSign) {
  if (mirrorSign >= 0 || profile.id === "perpendicular-18m") return profile;
  return Object.freeze({
    ...profile,
    id: `${profile.id}-mirrored`,
    mirroredFrom: profile.id,
    bridgeYawDegrees: freezeCurve(profile.bridgeYawDegrees.map((value) => -value)),
    cabinRelativeYawDegrees: freezeCurve(
      profile.cabinRelativeYawDegrees.map((value) => -value),
    ),
  });
}

export function selectExactStockJetwayMotionReference({
  rig,
  footprint,
  gateMap,
}) {
  if (!rig || !Array.isArray(footprint)) {
    throw new Error("Resolved stock jetway rig and footprint are required");
  }
  const rawTurnDegrees = signedTurnAtHinge(rig, footprint);
  const effectiveTurnDegrees = normalizedTurnDegrees(rawTurnDegrees);
  const effectiveAbsDegrees = Math.abs(effectiveTurnDegrees);
  const reachMeters = Number(gateMap?.bridgeEnd);
  if (!Number.isFinite(reachMeters)) {
    throw new Error(`${rig.gate} jetway has no finite authored bridge reach`);
  }

  // Match source mechanism shape first, then nominal model reach. A degree of
  // hinge-angle mismatch is intentionally weighted more strongly than a metre
  // of model-length mismatch so ~90-degree WED layouts stay on the supplied
  // perpendicular mechanism even when their total authored reach is longer
  // than the library's 18 m perpendicular reference.
  const scored = RAW_PROFILES.map((profile) => {
    const angleError = Math.abs(
      effectiveAbsDegrees - profile.referenceRestHingeDegrees,
    );
    const reachError = Math.abs(reachMeters - profile.nominalReachMeters);
    return {
      profile,
      angleError,
      reachError,
      score: angleError + reachError * 0.10,
    };
  }).sort(
    (a, b) =>
      a.score - b.score
      || a.angleError - b.angleError
      || a.reachError - b.reachError
      || a.profile.id.localeCompare(b.profile.id),
  );

  const winner = scored[0];
  const mirrorSign = effectiveTurnDegrees < 0 ? -1 : 1;
  const profile = mirroredProfile(winner.profile, mirrorSign);

  return Object.freeze({
    profile,
    sourceProfileId: winner.profile.id,
    rawTurnDegrees,
    effectiveTurnDegrees,
    effectiveAbsDegrees,
    reachMeters,
    angleErrorDegrees: winner.angleError,
    reachErrorMeters: winner.reachError,
    score: winner.score,
    mirrorSign,
    authority:
      "WED-authored-hinge-angle-plus-authored-reach-to-user-supplied-MisterX-AutoGate-reference-v2",
  });
}

export function getExactStockJetwayMotionProfile(id) {
  return byId.get(id) || null;
}

export const EXACT_STOCK_JETWAY_MOTION_PROFILES = RAW_PROFILES;
