import {
  AUTOGATE_REFERENCE,
  getAutoGateDoorTargets,
  getRampReadyAircraftDoorProfile,
} from "./aircraftDoorAuthority.js";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const radians = (degrees) => degrees * Math.PI / 180;

// User-supplied MisterX AutoGate-26m.obj horizontal articulation.
// A1's exact WED stock-facade reach is 23.860805 m, making the 26 m
// AutoGate bridge the closest supplied kinematic reference.
const AUTOGATE_26M = Object.freeze({
  sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-26m.obj",
  latRangeMeters: Object.freeze([0, 7.5]),
  bridgeYawDegrees: Object.freeze([58.87485095, 66.4785727]),
  cabinRelativeYawDegrees: Object.freeze([-60.6997204, -67.50015727]),
  sourceTranslationZMeters: Object.freeze([1, -6.5]),
});

function linearCurve([a, b], valueMeters) {
  const t = clamp(valueMeters / AUTOGATE_26M.latRangeMeters[1], 0, 1);
  return lerp(a, b, t);
}

function rotate2(x, z, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c + z * s, z: -x * s + z * c };
}

function requireObject(root, name) {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`A1 exact jetway articulation is missing ${name}`);
  return object;
}

export function installA1ExactAutoGateController({
  THREE,
  root,
  footprint,
  wallEvidence,
  gateMap,
}) {
  if (!THREE || !root?.isObject3D) throw new Error("A1 exact stock jetway root is required");
  if (gateMap?.gate !== "A1" || gateMap?.facadeWedObjectId !== 104804) {
    throw new Error("A1 exact AutoGate controller received the wrong WED facade");
  }
  if (!Array.isArray(footprint) || footprint.length !== 7) {
    throw new Error(`A1 exact AutoGate controller expected seven WED nodes, received ${footprint?.length ?? 0}`);
  }
  if (wallEvidence?.map((entry) => entry.wallName).join("|")
    !== "Rotunda_extension|Rotunda_extension|Rotunda_extension|Rotunda_extension|Tunnel_11-15.5m|Cabin") {
    throw new Error("A1 exact AutoGate controller wall sequence changed");
  }

  const profile = getRampReadyAircraftDoorProfile("CRJ700");
  const doorTargets = getAutoGateDoorTargets(profile);
  const attachedLatMeters = doorTargets.latMeters;
  if (!(attachedLatMeters > 0 && attachedLatMeters < AUTOGATE_26M.latRangeMeters[1])) {
    throw new Error(`A1 CRJ AutoGate lat target is outside the supplied 26 m curve: ${attachedLatMeters}`);
  }

  const fixedWalls = [1, 2, 3, 4].map((number) =>
    requireObject(root, `Wall_${number}_Rotunda_extension`));
  const tunnelWall = requireObject(root, "Wall_5_Tunnel_11-15.5m");
  const cabinWall = requireObject(root, "Wall_6_Cabin");
  const terminalTunnelSegment = requireObject(tunnelWall, "Segment_10_0");
  const aircraftTunnelSegment = requireObject(tunnelWall, "Segment_11_1");
  const terminalTunnelMesh = requireObject(terminalTunnelSegment, "FacadeMesh_10_0");
  const cabinHalfB = requireObject(aircraftTunnelSegment, "Attached_jw_cabin_1b.obj");
  requireObject(terminalTunnelSegment, "Attached_jw_tunnel_2_5a.obj");
  requireObject(aircraftTunnelSegment, "Attached_jw_tunnel_2_5b.obj");
  requireObject(cabinWall, "Attached_jw_cabin_1a.obj");

  const pivot = footprint[4];
  const attachedCabinJoint = footprint[5];
  const attachedTunnelVector = {
    x: attachedCabinJoint.x - pivot.x,
    z: attachedCabinJoint.y - pivot.y,
  };
  const attachedTunnelLength = Math.hypot(attachedTunnelVector.x, attachedTunnelVector.z);
  if (!(attachedTunnelLength > attachedLatMeters + 1)) {
    throw new Error(`A1 exact tunnel length ${attachedTunnelLength} cannot retract ${attachedLatMeters} m safely`);
  }
  const tunnelUnit = {
    x: attachedTunnelVector.x / attachedTunnelLength,
    z: attachedTunnelVector.z / attachedTunnelLength,
  };

  const fixedWallOriginals = fixedWalls.map((wall) => Object.freeze({
    name: wall.name,
    x: wall.position.x,
    y: wall.position.y,
    z: wall.position.z,
    rotationY: wall.rotation.y,
  }));

  const originals = Object.freeze({
    tunnelRotationY: tunnelWall.rotation.y,
    cabinPosition: cabinWall.position.clone(),
    cabinRotationY: cabinWall.rotation.y,
    aircraftTunnelSegmentZ: aircraftTunnelSegment.position.z,
    terminalTunnelMeshScaleZ: terminalTunnelMesh.scale.z,
    cabinHalfBRotationY: cabinHalfB.rotation.y,
  });

  const attachedBridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, attachedLatMeters);
  const attachedCabinRelativeYaw = linearCurve(
    AUTOGATE_26M.cabinRelativeYawDegrees,
    attachedLatMeters,
  );
  const terminalTunnelWorldLength = 9.5 * tunnelWall.scale.z;
  const history = ["attached-to-aircraft-door"];
  let deployment = 1;

  function setDeployment(value) {
    deployment = clamp(Number(value) || 0, 0, 1);
    const currentLatMeters = attachedLatMeters * deployment;
    const retractMeters = attachedLatMeters - currentLatMeters;

    // AutoGate's top-level lat translation is exactly one metre of entrance
    // travel per metre of dataref movement. Preserve the authored attached pose
    // as zero delta and reverse that curve toward the rest state.
    const bridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, currentLatMeters);
    const bridgeYawDelta = radians(bridgeYaw - attachedBridgeYaw);
    const cabinRelativeYaw = linearCurve(
      AUTOGATE_26M.cabinRelativeYawDegrees,
      currentLatMeters,
    );
    const cabinCounterYawDelta = radians(cabinRelativeYaw - attachedCabinRelativeYaw);

    tunnelWall.rotation.y = originals.tunnelRotationY + bridgeYawDelta;

    // The exact wall spelling [10,11] uses jw_tunnel_2_5a at the rotunda end
    // and jw_tunnel_2_5b at the aircraft end. Slide the aircraft-side source
    // segment back over the terminal-side source segment instead of scaling
    // either source OBJ.
    aircraftTunnelSegment.position.z = originals.aircraftTunnelSegmentZ
      + retractMeters / tunnelWall.scale.z;

    // Shrink only the facade's zero-thickness longitudinal filler plane so it
    // terminates at the moving inner tunnel. The exact tunnel OBJ geometry is
    // never scaled, remeshed, or substituted.
    const remainingFillerMeters = Math.max(0.2, terminalTunnelWorldLength - retractMeters);
    terminalTunnelMesh.scale.z = originals.terminalTunnelMeshScaleZ
      * (remainingFillerMeters / terminalTunnelWorldLength);

    const currentTunnelLength = attachedTunnelLength - retractMeters;
    const unrotatedJoint = {
      x: tunnelUnit.x * currentTunnelLength,
      z: tunnelUnit.z * currentTunnelLength,
    };
    const rotatedJoint = rotate2(unrotatedJoint.x, unrotatedJoint.z, bridgeYawDelta);
    cabinWall.position.set(
      pivot.x + rotatedJoint.x,
      originals.cabinPosition.y,
      pivot.y + rotatedJoint.z,
    );
    cabinWall.rotation.y = originals.cabinRotationY + bridgeYawDelta + cabinCounterYawDelta;

    // jw_cabin_1b is attached to the moving tunnel endpoint while cabin_1a is
    // attached to the Cabin wall. Apply the same AutoGate cabin counter-yaw so
    // both exact source halves remain aligned.
    cabinHalfB.rotation.y = originals.cabinHalfBRotationY + cabinCounterYawDelta;

    const state = deployment >= 0.995
      ? "attached-to-aircraft-door"
      : deployment <= 0.005
        ? "parked-clear-of-aircraft"
        : "autogate-disengaging";
    if (history.at(-1) !== state) history.push(state);

    root.userData.a1AutoGateDeployment = deployment;
    root.userData.a1AutoGateLatMeters = currentLatMeters;
    root.userData.a1AutoGateRetractedMeters = retractMeters;
    root.userData.a1AutoGateBridgeYawDeltaDegrees = bridgeYaw - attachedBridgeYaw;
    root.userData.a1AutoGateCabinCounterYawDeltaDegrees = cabinRelativeYaw - attachedCabinRelativeYaw;
    root.userData.a1AutoGateState = state;

    let fixedWallMotionMaxMeters = 0;
    let fixedWallRotationMaxRadians = 0;
    fixedWalls.forEach((wall, index) => {
      const baseline = fixedWallOriginals[index];
      fixedWallMotionMaxMeters = Math.max(
        fixedWallMotionMaxMeters,
        Math.hypot(
          wall.position.x - baseline.x,
          wall.position.y - baseline.y,
          wall.position.z - baseline.z,
        ),
      );
      fixedWallRotationMaxRadians = Math.max(
        fixedWallRotationMaxRadians,
        Math.abs(wall.rotation.y - baseline.rotationY),
      );
    });
    root.userData.a1AutoGateFixedWallMotionMaxMeters = fixedWallMotionMaxMeters;
    root.userData.a1AutoGateFixedWallRotationMaxRadians = fixedWallRotationMaxRadians;
  }

  const controller = Object.freeze({
    setDeployment,
    getDeployment: () => deployment,
    getState: () => root.userData.a1AutoGateState,
    getStateHistory: () => [...history],
    getLatMeters: () => root.userData.a1AutoGateLatMeters,
    getRetractedMeters: () => root.userData.a1AutoGateRetractedMeters,
    getBridgeYawDeltaDegrees: () => root.userData.a1AutoGateBridgeYawDeltaDegrees,
    getCabinCounterYawDeltaDegrees: () => root.userData.a1AutoGateCabinCounterYawDeltaDegrees,
    getFixedWallMotionMaxMeters: () => root.userData.a1AutoGateFixedWallMotionMaxMeters,
    getFixedWallRotationMaxRadians: () => root.userData.a1AutoGateFixedWallRotationMaxRadians,
    getAttachedLatMeters: () => attachedLatMeters,
    getMotionDurationMs: () => AUTOGATE_REFERENCE.motionDurationSeconds * 1000,
    getDoorTargets: () => doorTargets,
  });

  root.userData.a1AutoGateControllerAuthority =
    "exact-WED-104804-XP11-stock-facade-plus-MisterX-AutoGate-26m-horizontal-kinematics-v1";
  root.userData.a1AutoGateSourceGeometryAuthority =
    "KPHX-1.75.1-WED-104804-plus-XP11-Jetway_1_solid.fac";
  root.userData.a1AutoGateMotionSource = AUTOGATE_26M.sourceAsset;
  root.userData.a1AutoGateHorizontalDataref = AUTOGATE_REFERENCE.horizontalDataref;
  root.userData.a1AutoGateVerticalDataref = AUTOGATE_REFERENCE.verticalDataref;
  root.userData.a1AutoGateAttachedLatMeters = attachedLatMeters;
  root.userData.a1AutoGateVerticalResolved = doorTargets.verticalResolved;
  root.userData.a1AutoGateFixedWalls = fixedWalls.map((wall) => wall.name).join("|");
  root.userData.a1AutoGateMovingWall = tunnelWall.name;
  root.userData.a1AutoGateCabinWall = cabinWall.name;
  root.userData.a1AutoGatePivotWedNodeId = 104809;
  root.userData.a1AutoGateCabinJointWedNodeId = 104810;
  root.userData.a1AutoGateAttachedTunnelLengthMeters = attachedTunnelLength;
  root.userData.a1AutoGateRequiredPrePushSequence =
    "AutoGate DISENGAGE: reverse meter-space lat target to zero over 15 seconds; exact tunnel telescopes and cabin counter-rotates";
  setDeployment(1);

  return controller;
}
