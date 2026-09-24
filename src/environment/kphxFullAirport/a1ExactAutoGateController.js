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
  vertRangeMeters: Object.freeze([-2, 0]),
  sourceBridgePitchDegreesAtMinus2: 3.99981854,
});

function linearCurve([a, b], valueMeters) {
  const t = clamp(valueMeters / AUTOGATE_26M.latRangeMeters[1], 0, 1);
  return lerp(a, b, t);
}

function sourceVerticalPitchRadians(vertMeters) {
  const t = clamp((-Number(vertMeters || 0)) / 2, 0, 1);
  // MisterX AutoGate-26m.obj:
  // marginal.org.uk/autogate/vert 0 -> -2 rotates the bridge +3.99981854°
  // in OBJ8 source space. In the RampReady facade frame, negative local-X
  // pitch lowers the aircraft end while preserving the terminal pivot.
  return radians(-AUTOGATE_26M.sourceBridgePitchDegreesAtMinus2 * t);
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

  const defaultProfile = getRampReadyAircraftDoorProfile("CRJ700");
  let doorTargets = getAutoGateDoorTargets(defaultProfile);
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
  const cabinHalfB = requireObject(aircraftTunnelSegment, "Attached_jw_cabin_1b.obj");
  const cabinHalfBAttachmentPivot = cabinHalfB.parent;
  requireObject(terminalTunnelSegment, "Attached_jw_tunnel_2_5a.obj");
  requireObject(aircraftTunnelSegment, "Attached_jw_tunnel_2_5b.obj");
  const cabinHalfA = requireObject(cabinWall, "Attached_jw_cabin_1a.obj");

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
    tunnelRotationX: tunnelWall.rotation.x,
    tunnelRotationY: tunnelWall.rotation.y,
    cabinPosition: cabinWall.position.clone(),
    cabinRotationY: cabinWall.rotation.y,
    aircraftTunnelSegmentZ: aircraftTunnelSegment.position.z,
    cabinHalfBRotationY: cabinHalfB.rotation.y,
    cabinHalfARotationY: cabinHalfA.rotation.y,
  });

  const attachedBridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, attachedLatMeters);
  const attachedCabinRelativeYaw = linearCurve(
    AUTOGATE_26M.cabinRelativeYawDegrees,
    attachedLatMeters,
  );
  const history = ["attached-to-aircraft-door"];
  let deployment = 1;
  let connectedLatMeters = attachedLatMeters;
  let connectedVertMeters = doorTargets.vertMeters;
  let dockingCorrectionMeters = 0;
  let dockingVerticalCorrectionMeters = 0;
  let doorContactGapMeters = Number.NaN;
  let doorContactHitObject = "unregistered";
  let doorContactReady = false;

  function setDeployment(value) {
    deployment = clamp(Number(value) || 0, 0, 1);
    // The WED-authored pose is the exact geometry baseline. Once the rendered
    // aircraft door is available, connectedLatMeters includes only the small
    // AutoGate-consistent correction required to put the visible cabin/hood
    // against that real door. Deployment 0 still returns to the source rest
    // dataref value rather than bypassing the visible departure motion.
    const currentLatMeters = connectedLatMeters * deployment;
    const currentVertMeters = connectedVertMeters * deployment;
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

    const bridgePitchDelta = sourceVerticalPitchRadians(currentVertMeters);
    tunnelWall.rotation.x = originals.tunnelRotationX + bridgePitchDelta;
    tunnelWall.rotation.y = originals.tunnelRotationY + bridgeYawDelta;

    // Exact XP11 spelling [10,11]: Segment 10 is the 9.5 m terminal-side
    // outer tunnel and remains completely fixed. Segment 11 is the 1.5 m
    // aircraft-side inner section with jw_tunnel_2_5b + cabin-half attachments.
    // Telescope by translating only Segment 11 back inside Segment 10.
    aircraftTunnelSegment.position.z = originals.aircraftTunnelSegmentZ
      + retractMeters / tunnelWall.scale.z;

    const currentTunnelLength = attachedTunnelLength - retractMeters;
    const horizontalTunnelLength = currentTunnelLength * Math.cos(bridgePitchDelta);
    const jointVerticalDelta = currentTunnelLength * Math.sin(bridgePitchDelta);
    const unrotatedJoint = {
      x: tunnelUnit.x * horizontalTunnelLength,
      z: tunnelUnit.z * horizontalTunnelLength,
    };
    const rotatedJoint = rotate2(unrotatedJoint.x, unrotatedJoint.z, bridgeYawDelta);
    cabinWall.position.set(
      pivot.x + rotatedJoint.x,
      originals.cabinPosition.y + jointVerticalDelta,
      pivot.y + rotatedJoint.z,
    );
    cabinWall.rotation.y = originals.cabinRotationY + bridgeYawDelta + cabinCounterYawDelta;

    // jw_cabin_1b is attached to the moving tunnel endpoint while cabin_1a is
    // attached to the Cabin wall. Apply the same AutoGate cabin counter-yaw so
    // both exact source halves remain aligned.
    cabinHalfB.rotation.y = originals.cabinHalfBRotationY + cabinCounterYawDelta;

    // The two stock cabin source objects meet at the same authored joint:
    // Segment 11 places jw_cabin_1b at its far endpoint and Cabin Segment 20
    // begins jw_cabin_1a at that exact WED node. Verify that articulation keeps
    // the joint closed and preserves the source relative yaw.
    root.updateMatrixWorld(true);
    const cabinHalfBJointWorld = cabinHalfBAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const cabinWallJointWorld = cabinWall.getWorldPosition(new THREE.Vector3());
    const cabinJointGapMeters = cabinHalfBJointWorld.distanceTo(cabinWallJointWorld);
    const cabinAWorldYawDelta = cabinWall.rotation.y - originals.cabinRotationY;
    const cabinBWorldYawDelta =
      (tunnelWall.rotation.y - originals.tunnelRotationY)
      + (cabinHalfB.rotation.y - originals.cabinHalfBRotationY);
    const cabinRelativeYawDriftRadians = cabinBWorldYawDelta - cabinAWorldYawDelta;

    const state = deployment >= 0.995
      ? "attached-to-aircraft-door"
      : deployment <= 0.005
        ? "parked-clear-of-aircraft"
        : "autogate-disengaging";
    if (history.at(-1) !== state) history.push(state);

    root.userData.a1AutoGateDeployment = deployment;
    root.userData.a1AutoGateLatMeters = currentLatMeters;
    root.userData.a1AutoGateVertMeters = currentVertMeters;
    root.userData.a1AutoGateBridgePitchDegrees = THREE.MathUtils.radToDeg(bridgePitchDelta);
    root.userData.a1AutoGateCabinVerticalDeltaMeters = jointVerticalDelta;
    root.userData.a1AutoGateRetractedMeters = retractMeters;
    root.userData.a1AutoGateBridgeYawDeltaDegrees = bridgeYaw - attachedBridgeYaw;
    root.userData.a1AutoGateCabinCounterYawDeltaDegrees = cabinRelativeYaw - attachedCabinRelativeYaw;
    root.userData.a1AutoGateCabinJointGapMeters = cabinJointGapMeters;
    root.userData.a1AutoGateCabinRelativeYawDriftRadians = cabinRelativeYawDriftRadians;
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

  function measureDoorContactGap(targetWorld, outwardWorldDirection) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      return { distance: Number.POSITIVE_INFINITY, objectName: "invalid-target" };
    }
    root.updateMatrixWorld(true);
    const direction = outwardWorldDirection.clone().normalize();
    const candidates = [];
    for (const sign of [1, -1]) {
      const raycaster = new THREE.Raycaster(
        targetWorld,
        direction.clone().multiplyScalar(sign),
        0,
        4.5,
      );
      const hits = raycaster.intersectObjects([cabinHalfA, cabinHalfB], true)
        .filter((hit) => Number.isFinite(hit.distance) && hit.distance >= 0);
      if (hits.length) candidates.push(hits[0]);
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) {
      return { distance: Number.POSITIVE_INFINITY, objectName: "no-visible-cabin-hit" };
    }
    return {
      distance: candidates[0].distance,
      objectName: candidates[0].object?.name
        || candidates[0].object?.parent?.name
        || "cabin-mesh",
    };
  }

  function evaluateConnectedPose(
    candidateLatMeters,
    candidateVertMeters,
    targetWorld,
    outwardWorldDirection,
  ) {
    connectedLatMeters = clamp(candidateLatMeters, 0.05, AUTOGATE_26M.latRangeMeters[1]);
    connectedVertMeters = clamp(
      candidateVertMeters,
      AUTOGATE_26M.vertRangeMeters[0],
      AUTOGATE_26M.vertRangeMeters[1],
    );
    setDeployment(1);
    const hit = measureDoorContactGap(targetWorld, outwardWorldDirection);
    return {
      connectedLatMeters,
      connectedVertMeters,
      correctionMeters: connectedLatMeters - attachedLatMeters,
      verticalCorrectionMeters: connectedVertMeters,
      gapMeters: hit.distance,
      objectName: hit.objectName,
    };
  }

  function registerAircraftDoorContact({
    targetWorld,
    outwardWorldDirection,
    aircraftType = doorTargets.aircraftType,
  } = {}) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      throw new Error("A1 X-Plane ACF aircraft door contact requires exact world point and outward direction");
    }

    const profile = getRampReadyAircraftDoorProfile(aircraftType);
    if (!profile) throw new Error(`Unsupported A1 aircraft AutoGate profile: ${aircraftType}`);
    const exactTargets = getAutoGateDoorTargets(profile);
    if (Math.abs(exactTargets.latMeters - attachedLatMeters) > 0.001) {
      throw new Error(
        `A1 AutoGate lateral source changed from ${attachedLatMeters.toFixed(4)} to ${exactTargets.latMeters.toFixed(4)} m`,
      );
    }
    if (!Number.isFinite(exactTargets.vertMeters)) {
      throw new Error(`A1 ${profile.aircraftType} ACF has no finite AutoGate vertical target`);
    }

    doorTargets = exactTargets;
    const exact = evaluateConnectedPose(
      exactTargets.latMeters,
      exactTargets.vertMeters,
      targetWorld,
      outwardWorldDirection,
    );
    connectedLatMeters = exact.connectedLatMeters;
    connectedVertMeters = exact.connectedVertMeters;
    dockingCorrectionMeters = exact.correctionMeters;
    dockingVerticalCorrectionMeters = exact.verticalCorrectionMeters;
    setDeployment(1);

    const finalHit = measureDoorContactGap(targetWorld, outwardWorldDirection);
    doorContactGapMeters = finalHit.distance;
    doorContactHitObject = finalHit.objectName;
    doorContactReady =
      Number.isFinite(doorContactGapMeters) && doorContactGapMeters <= 0.08;

    root.userData.a1AutoGateAircraftType = profile.aircraftType;
    root.userData.a1AutoGateAircraftSourceAcf = profile.sourceAcf;
    root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
    root.userData.a1AutoGateConnectedVertMeters = connectedVertMeters;
    root.userData.a1AutoGateDockingCorrectionMeters = dockingCorrectionMeters;
    root.userData.a1AutoGateDockingVerticalCorrectionMeters = dockingVerticalCorrectionMeters;
    root.userData.a1AutoGateDoorContactGapMeters = doorContactGapMeters;
    root.userData.a1AutoGateDoorContactHitObject = doorContactHitObject;
    root.userData.a1AutoGateDoorContactReady = doorContactReady;
    root.userData.a1AutoGateVerticalResolved = doorContactReady;
    root.userData.a1AutoGateDoorContactAuthority =
      "RobertSV-XPlane11-ACF-dock-port-plus-Marginal-AutoGate-lat-vert-to-XP11-stock-cabin-v1";

    return Object.freeze({
      aircraftType: profile.aircraftType,
      sourceAcf: profile.sourceAcf,
      connectedLatMeters,
      connectedVertMeters,
      correctionMeters: dockingCorrectionMeters,
      verticalCorrectionMeters: dockingVerticalCorrectionMeters,
      gapMeters: doorContactGapMeters,
      hitObject: doorContactHitObject,
      ready: doorContactReady,
    });
  }

  const controller = Object.freeze({
    setDeployment,
    registerAircraftDoorContact,
    getDeployment: () => deployment,
    getState: () => root.userData.a1AutoGateState,
    getStateHistory: () => [...history],
    getLatMeters: () => root.userData.a1AutoGateLatMeters,
    getVertMeters: () => root.userData.a1AutoGateVertMeters,
    getBridgePitchDegrees: () => root.userData.a1AutoGateBridgePitchDegrees,
    getCabinVerticalDeltaMeters: () => root.userData.a1AutoGateCabinVerticalDeltaMeters,
    getRetractedMeters: () => root.userData.a1AutoGateRetractedMeters,
    getBridgeYawDeltaDegrees: () => root.userData.a1AutoGateBridgeYawDeltaDegrees,
    getCabinCounterYawDeltaDegrees: () => root.userData.a1AutoGateCabinCounterYawDeltaDegrees,
    getCabinJointGapMeters: () => root.userData.a1AutoGateCabinJointGapMeters,
    getCabinRelativeYawDriftRadians: () => root.userData.a1AutoGateCabinRelativeYawDriftRadians,
    getFixedWallMotionMaxMeters: () => root.userData.a1AutoGateFixedWallMotionMaxMeters,
    getFixedWallRotationMaxRadians: () => root.userData.a1AutoGateFixedWallRotationMaxRadians,
    getAttachedLatMeters: () => attachedLatMeters,
    getConnectedLatMeters: () => connectedLatMeters,
    getConnectedVertMeters: () => connectedVertMeters,
    getDockingCorrectionMeters: () => dockingCorrectionMeters,
    getDockingVerticalCorrectionMeters: () => dockingVerticalCorrectionMeters,
    getDoorContactGapMeters: () => doorContactGapMeters,
    getDoorContactHitObject: () => doorContactHitObject,
    isDoorContactReady: () => doorContactReady,
    getMotionDurationMs: () => AUTOGATE_REFERENCE.motionDurationSeconds * 1000,
    getDoorTargets: () => Object.freeze({
      ...doorTargets,
      vertMeters: connectedVertMeters,
      verticalResolved: doorContactReady,
      authority: doorContactReady
        ? "autogate-visible-aircraft-door-lat-vert-solved-v2"
        : doorTargets.authority,
    }),
  });

  root.userData.a1AutoGateControllerAuthority =
    "exact-WED-104804-XP11-stock-facade-plus-XPlane-ACF-and-MisterX-AutoGate-26m-kinematics-v3";
  root.userData.a1AutoGateSourceGeometryAuthority =
    "KPHX-1.75.1-WED-104804-plus-XP11-Jetway_1_solid.fac";
  root.userData.a1AutoGateMotionSource = AUTOGATE_26M.sourceAsset;
  root.userData.a1AutoGateHorizontalDataref = AUTOGATE_REFERENCE.horizontalDataref;
  root.userData.a1AutoGateVerticalDataref = AUTOGATE_REFERENCE.verticalDataref;
  root.userData.a1AutoGateAttachedLatMeters = attachedLatMeters;
  root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
  root.userData.a1AutoGateConnectedVertMeters = connectedVertMeters;
  root.userData.a1AutoGateDockingCorrectionMeters = connectedLatMeters - attachedLatMeters;
  root.userData.a1AutoGateDockingVerticalCorrectionMeters = connectedVertMeters;
  root.userData.a1AutoGateDoorContactGapMeters = Number.NaN;
  root.userData.a1AutoGateDoorContactHitObject = "unregistered";
  root.userData.a1AutoGateDoorContactReady = false;
  root.userData.a1AutoGateVerticalResolved = false;
  root.userData.a1AutoGateFixedWalls = fixedWalls.map((wall) => wall.name).join("|");
  root.userData.a1AutoGateMovingWall = tunnelWall.name;
  root.userData.a1AutoGateCabinWall = cabinWall.name;
  root.userData.a1AutoGateCabinHalfA = cabinHalfA.name;
  root.userData.a1AutoGateCabinHalfB = cabinHalfB.name;
  root.userData.a1AutoGateCabinJointAuthority = "Segment-11-endpoint-equals-Cabin-Segment-20-start";
  root.userData.a1AutoGatePivotWedNodeId = 104809;
  root.userData.a1AutoGateCabinJointWedNodeId = 104810;
  root.userData.a1AutoGateAttachedTunnelLengthMeters = attachedTunnelLength;
  root.userData.a1AutoGateRequiredPrePushSequence =
    "AutoGate DISENGAGE: reverse meter-space lat target to zero over 15 seconds; exact tunnel telescopes and cabin counter-rotates";
  setDeployment(1);

  return controller;
}
