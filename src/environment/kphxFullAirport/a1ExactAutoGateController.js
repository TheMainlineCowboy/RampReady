import {
  AUTOGATE_REFERENCE,
  getAutoGateDoorTargets,
  getRampReadyAircraftDoorProfile,
} from "./aircraftDoorAuthority.js";

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const lerp = (a, b, t) => a + (b - a) * t;
const radians = (degrees) => degrees * Math.PI / 180;

const AUTOGATE_26M = Object.freeze({
  sourceAsset: "MisterX_Library/Airport/Jetways-Steel/AutoGate-26m.obj",
  latRangeMeters: Object.freeze([0, 7.5]),
  bridgeYawDegrees: Object.freeze([58.87485095, 66.4785727]),
  cabinRelativeYawDegrees: Object.freeze([-60.6997204, -67.50015727]),
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

function matrixMaxAbsDelta(a, b) {
  let max = 0;
  for (let i = 0; i < 16; i += 1) {
    max = Math.max(max, Math.abs(a.elements[i] - b.elements[i]));
  }
  return max;
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

  const defaultProfile = getRampReadyAircraftDoorProfile("CRJ900");
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
  const terminalTunnelVisual = requireObject(terminalTunnelSegment, "Attached_jw_tunnel_2_5a.obj");
  const aircraftTunnelVisual = requireObject(aircraftTunnelSegment, "Attached_jw_tunnel_2_5b.obj");
  const cabinHalfA = requireObject(cabinWall, "Attached_jw_cabin_1a.obj");

  root.updateMatrixWorld(true);

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
    tunnelPosition: tunnelWall.position.clone(),
    tunnelQuaternion: tunnelWall.quaternion.clone(),
    tunnelScale: tunnelWall.scale.clone(),
    cabinPosition: cabinWall.position.clone(),
    cabinQuaternion: cabinWall.quaternion.clone(),
    cabinScale: cabinWall.scale.clone(),
    aircraftTunnelSegmentPosition: aircraftTunnelSegment.position.clone(),
    aircraftTunnelSegmentQuaternion: aircraftTunnelSegment.quaternion.clone(),
    aircraftTunnelSegmentScale: aircraftTunnelSegment.scale.clone(),
    cabinHalfBPosition: cabinHalfB.position.clone(),
    cabinHalfBQuaternion: cabinHalfB.quaternion.clone(),
    cabinHalfBScale: cabinHalfB.scale.clone(),
    tunnelMatrix: tunnelWall.matrix.clone(),
    cabinMatrix: cabinWall.matrix.clone(),
    aircraftTunnelSegmentMatrix: aircraftTunnelSegment.matrix.clone(),
    cabinHalfBMatrix: cabinHalfB.matrix.clone(),
  });

  const sourceSupportBox = new THREE.Box3().setFromObject(aircraftTunnelVisual);
  const sourceSupportBottomY = sourceSupportBox.min.y;

  const attachedBridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, attachedLatMeters);
  const attachedCabinRelativeYaw = linearCurve(
    AUTOGATE_26M.cabinRelativeYawDegrees,
    attachedLatMeters,
  );

  const history = ["attached-to-aircraft-door"];
  let deployment = 1;
  let connectedLatMeters = attachedLatMeters;
  let connectedVertMeters = 0;
  let dockingCorrectionMeters = 0;
  let dockingVerticalCorrectionMeters = 0;
  let doorContactGapMeters = Number.NaN;
  let doorContactHitObject = "unregistered";
  let doorContactReady = false;

  function restoreAnimatedSourceLocals() {
    tunnelWall.position.copy(originals.tunnelPosition);
    tunnelWall.quaternion.copy(originals.tunnelQuaternion);
    tunnelWall.scale.copy(originals.tunnelScale);
    cabinWall.position.copy(originals.cabinPosition);
    cabinWall.quaternion.copy(originals.cabinQuaternion);
    cabinWall.scale.copy(originals.cabinScale);
    aircraftTunnelSegment.position.copy(originals.aircraftTunnelSegmentPosition);
    aircraftTunnelSegment.quaternion.copy(originals.aircraftTunnelSegmentQuaternion);
    aircraftTunnelSegment.scale.copy(originals.aircraftTunnelSegmentScale);
    cabinHalfB.position.copy(originals.cabinHalfBPosition);
    cabinHalfB.quaternion.copy(originals.cabinHalfBQuaternion);
    cabinHalfB.scale.copy(originals.cabinHalfBScale);
  }

  function setDeployment(value) {
    deployment = clamp(Number(value) || 0, 0, 1);
    restoreAnimatedSourceLocals();

    const currentLatMeters = connectedLatMeters * deployment;
    const retractMeters = connectedLatMeters - currentLatMeters;
    const bridgeYaw = linearCurve(AUTOGATE_26M.bridgeYawDegrees, currentLatMeters);
    const bridgeYawDelta = radians(bridgeYaw - attachedBridgeYaw);
    const cabinRelativeYaw = linearCurve(
      AUTOGATE_26M.cabinRelativeYawDegrees,
      currentLatMeters,
    );
    const cabinCounterYawDelta = radians(cabinRelativeYaw - attachedCabinRelativeYaw);

    // The exact ZIP/WED facade pose is deployment=1 and is restored byte-for-
    // byte before every evaluation. Articulation is horizontal only: rotate
    // Wall 5 around its authored WED start node, telescope only Segment 11,
    // and move Cabin wall 6 to the resulting authored endpoint. No object is
    // re-parented, vertically translated, scaled, or deformed.
    tunnelWall.rotation.y = originals.tunnelQuaternion
      ? new THREE.Euler().setFromQuaternion(originals.tunnelQuaternion, "XYZ").y + bridgeYawDelta
      : tunnelWall.rotation.y + bridgeYawDelta;

    aircraftTunnelSegment.position.z =
      originals.aircraftTunnelSegmentPosition.z + retractMeters / originals.tunnelScale.z;

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
    const cabinBaseEuler = new THREE.Euler().setFromQuaternion(originals.cabinQuaternion, "XYZ");
    cabinWall.rotation.set(
      cabinBaseEuler.x,
      cabinBaseEuler.y + bridgeYawDelta + cabinCounterYawDelta,
      cabinBaseEuler.z,
    );

    const cabinBBaseEuler = new THREE.Euler().setFromQuaternion(originals.cabinHalfBQuaternion, "XYZ");
    cabinHalfB.rotation.set(
      cabinBBaseEuler.x,
      cabinBBaseEuler.y + cabinCounterYawDelta,
      cabinBBaseEuler.z,
    );

    root.updateMatrixWorld(true);

    const cabinHalfBJointWorld =
      cabinHalfBAttachmentPivot.getWorldPosition(new THREE.Vector3());
    const cabinWallJointWorld = cabinWall.getWorldPosition(new THREE.Vector3());
    const cabinJointGapMeters =
      cabinHalfBJointWorld.distanceTo(cabinWallJointWorld);

    const cabinAWorldYawDelta =
      cabinWall.rotation.y - cabinBaseEuler.y;
    const tunnelBaseEuler =
      new THREE.Euler().setFromQuaternion(originals.tunnelQuaternion, "XYZ");
    const cabinBWorldYawDelta =
      (tunnelWall.rotation.y - tunnelBaseEuler.y)
      + (cabinHalfB.rotation.y - cabinBBaseEuler.y);
    const cabinRelativeYawDriftRadians =
      cabinBWorldYawDelta - cabinAWorldYawDelta;

    tunnelWall.updateMatrix();
    cabinWall.updateMatrix();
    aircraftTunnelSegment.updateMatrix();
    cabinHalfB.updateMatrix();

    const sourcePoseMaxMatrixDelta = deployment >= 0.999999
      ? Math.max(
        matrixMaxAbsDelta(tunnelWall.matrix, originals.tunnelMatrix),
        matrixMaxAbsDelta(cabinWall.matrix, originals.cabinMatrix),
        matrixMaxAbsDelta(
          aircraftTunnelSegment.matrix,
          originals.aircraftTunnelSegmentMatrix,
        ),
        matrixMaxAbsDelta(cabinHalfB.matrix, originals.cabinHalfBMatrix),
      )
      : Number.NaN;

    const supportBox = new THREE.Box3().setFromObject(aircraftTunnelVisual);
    const supportBottomDeltaMeters = supportBox.min.y - sourceSupportBottomY;

    const state = deployment >= 0.995
      ? "attached-to-aircraft-door"
      : deployment <= 0.005
        ? "parked-clear-of-aircraft"
        : "autogate-disengaging";
    if (history.at(-1) !== state) history.push(state);

    root.userData.a1AutoGateDeployment = deployment;
    root.userData.a1AutoGateLatMeters = currentLatMeters;
    root.userData.a1AutoGateVertMeters = 0;
    root.userData.a1AutoGateBridgePitchDegrees = 0;
    root.userData.a1AutoGateCabinVerticalDeltaMeters = 0;
    root.userData.a1AutoGateRetractedMeters = retractMeters;
    root.userData.a1AutoGateBridgeYawDeltaDegrees =
      THREE.MathUtils.radToDeg(bridgeYawDelta);
    root.userData.a1AutoGateCabinCounterYawDeltaDegrees =
      THREE.MathUtils.radToDeg(cabinCounterYawDelta);
    root.userData.a1AutoGateCabinJointGapMeters = cabinJointGapMeters;
    root.userData.a1AutoGateCabinRelativeYawDriftRadians =
      cabinRelativeYawDriftRadians;
    root.userData.a1AutoGateSourcePoseMaxMatrixDelta =
      sourcePoseMaxMatrixDelta;
    root.userData.a1AutoGateSupportBottomYMeters = supportBox.min.y;
    root.userData.a1AutoGateSupportBottomDeltaMeters =
      supportBottomDeltaMeters;
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
    root.userData.a1AutoGateFixedWallMotionMaxMeters =
      fixedWallMotionMaxMeters;
    root.userData.a1AutoGateFixedWallRotationMaxRadians =
      fixedWallRotationMaxRadians;
  }

  function measureDoorContactGap(targetWorld, outwardWorldDirection) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      return {
        distance: Number.POSITIVE_INFINITY,
        signedDistance: Number.NaN,
        objectName: "invalid-target",
      };
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
      if (hits.length) candidates.push({ ...hits[0], sign });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    if (!candidates.length) {
      return {
        distance: Number.POSITIVE_INFINITY,
        signedDistance: Number.NaN,
        objectName: "no-visible-cabin-hit",
      };
    }
    return {
      distance: candidates[0].distance,
      signedDistance: candidates[0].distance * candidates[0].sign,
      objectName: candidates[0].object?.name
        || candidates[0].object?.parent?.name
        || "cabin-mesh",
    };
  }

  function registerAircraftDoorContact({
    targetWorld,
    outwardWorldDirection,
    aircraftType = doorTargets.aircraftType,
  } = {}) {
    if (!targetWorld?.isVector3 || !outwardWorldDirection?.isVector3) {
      throw new Error(
        "A1 X-Plane ACF aircraft door contact requires exact world point and outward direction",
      );
    }
    const profile = getRampReadyAircraftDoorProfile(aircraftType);
    if (!profile) throw new Error(`Unsupported A1 aircraft AutoGate profile: ${aircraftType}`);
    const exactTargets = getAutoGateDoorTargets(profile);
    // Consume both ACF targets as source evidence. The XP11 stock facade is
    // preserved at its authored vertical geometry; only the AutoGate lateral
    // curve is portable without splitting/deforming the stock OBJ hierarchy.
    const requestedVertMeters = exactTargets.vertMeters;
    if (Math.abs(exactTargets.latMeters - attachedLatMeters) > 0.001) {
      throw new Error(
        `A1 AutoGate lateral source changed from ${attachedLatMeters.toFixed(4)} to ${exactTargets.latMeters.toFixed(4)} m`,
      );
    }
    if (!Number.isFinite(requestedVertMeters)) {
      throw new Error(`A1 ${profile.aircraftType} ACF has no finite AutoGate vertical target`);
    }

    doorTargets = exactTargets;
    connectedLatMeters = exactTargets.latMeters;
    connectedVertMeters = 0;
    dockingCorrectionMeters = 0;
    dockingVerticalCorrectionMeters = 0;

    setDeployment(1);
    const hit = measureDoorContactGap(targetWorld, outwardWorldDirection);
    doorContactGapMeters = hit.distance;
    doorContactHitObject = hit.objectName;
    doorContactReady =
      Number.isFinite(doorContactGapMeters) && doorContactGapMeters <= 0.08;

    root.userData.a1AutoGateAircraftType = profile.aircraftType;
    root.userData.a1AutoGateAircraftSourceAcf = profile.sourceAcf;
    root.userData.a1AutoGateRequestedAcfVertMeters = requestedVertMeters;
    root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
    root.userData.a1AutoGateConnectedVertMeters = 0;
    root.userData.a1AutoGateDockingCorrectionMeters = 0;
    root.userData.a1AutoGateDockingVerticalCorrectionMeters = 0;
    root.userData.a1AutoGateDoorContactGapMeters = doorContactGapMeters;
    root.userData.a1AutoGateDoorContactSignedGapMeters = hit.signedDistance;
    root.userData.a1AutoGateDoorContactHitObject = doorContactHitObject;
    root.userData.a1AutoGateDoorContactReady = doorContactReady;
    root.userData.a1AutoGateVerticalResolved = doorContactReady;
    root.userData.a1AutoGateDoorContactAuthority =
      "exact-XP11-stock-source-pose-plus-XPlane-CRJ900-ACF-horizontal-contact-v1";

    return Object.freeze({
      aircraftType: profile.aircraftType,
      sourceAcf: profile.sourceAcf,
      connectedLatMeters,
      connectedVertMeters: 0,
      correctionMeters: 0,
      verticalCorrectionMeters: 0,
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
    getVertMeters: () => 0,
    getBridgePitchDegrees: () => 0,
    getCabinVerticalDeltaMeters: () => 0,
    getRetractedMeters: () => root.userData.a1AutoGateRetractedMeters,
    getBridgeYawDeltaDegrees: () =>
      root.userData.a1AutoGateBridgeYawDeltaDegrees,
    getCabinCounterYawDeltaDegrees: () =>
      root.userData.a1AutoGateCabinCounterYawDeltaDegrees,
    getCabinJointGapMeters: () =>
      root.userData.a1AutoGateCabinJointGapMeters,
    getCabinRelativeYawDriftRadians: () =>
      root.userData.a1AutoGateCabinRelativeYawDriftRadians,
    getFixedWallMotionMaxMeters: () =>
      root.userData.a1AutoGateFixedWallMotionMaxMeters,
    getFixedWallRotationMaxRadians: () =>
      root.userData.a1AutoGateFixedWallRotationMaxRadians,
    getSourcePoseMaxMatrixDelta: () =>
      root.userData.a1AutoGateSourcePoseMaxMatrixDelta,
    getSupportBottomDeltaMeters: () =>
      root.userData.a1AutoGateSupportBottomDeltaMeters,
    getAttachedLatMeters: () => attachedLatMeters,
    getConnectedLatMeters: () => connectedLatMeters,
    getConnectedVertMeters: () => 0,
    getDockingCorrectionMeters: () => dockingCorrectionMeters,
    getDockingVerticalCorrectionMeters: () => 0,
    getDoorContactGapMeters: () => doorContactGapMeters,
    getDoorContactHitObject: () => doorContactHitObject,
    isDoorContactReady: () => doorContactReady,
    getMotionDurationMs: () => AUTOGATE_REFERENCE.motionDurationSeconds * 1000,
    getDoorTargets: () => Object.freeze({
      ...doorTargets,
      vertMeters: 0,
      verticalResolved: doorContactReady,
      authority:
        "XP11-stock-source-height-preserved-plus-XPlane-ACF-horizontal-AutoGate-v1",
    }),
  });

  root.userData.a1AutoGateControllerAuthority =
    "exact-WED-104804-XP11-stock-source-pose-plus-horizontal-AutoGate-articulation-v7";
  root.userData.a1AutoGateSourceGeometryAuthority =
    "KPHX-1.75.1-WED-104804-plus-XP11-Jetway_1_solid.fac";
  root.userData.a1AutoGateMotionSource = AUTOGATE_26M.sourceAsset;
  root.userData.a1AutoGateHorizontalDataref =
    AUTOGATE_REFERENCE.horizontalDataref;
  root.userData.a1AutoGateVerticalDataref =
    AUTOGATE_REFERENCE.verticalDataref;
  root.userData.a1AutoGateAttachedLatMeters = attachedLatMeters;
  root.userData.a1AutoGateConnectedLatMeters = connectedLatMeters;
  root.userData.a1AutoGateConnectedVertMeters = 0;
  root.userData.a1AutoGateDockingCorrectionMeters = 0;
  root.userData.a1AutoGateDockingVerticalCorrectionMeters = 0;
  root.userData.a1AutoGateDoorContactGapMeters = Number.NaN;
  root.userData.a1AutoGateDoorContactHitObject = "unregistered";
  root.userData.a1AutoGateDoorContactReady = false;
  root.userData.a1AutoGateVerticalResolved = false;
  root.userData.a1AutoGateFixedWalls =
    fixedWalls.map((wall) => wall.name).join("|");
  root.userData.a1AutoGateMovingWall = tunnelWall.name;
  root.userData.a1AutoGateCabinWall = cabinWall.name;
  root.userData.a1AutoGateCabinHalfA = cabinHalfA.name;
  root.userData.a1AutoGateCabinHalfB = cabinHalfB.name;
  root.userData.a1AutoGateSourcePoseAuthority =
    "deployment-1-equals-unmodified-XP11-stock-facade-local-transforms";
  root.userData.a1AutoGateCabinJointAuthority =
    "Segment-11-endpoint-equals-Cabin-Segment-20-start";
  root.userData.a1AutoGatePivotWedNodeId = 104809;
  root.userData.a1AutoGateCabinJointWedNodeId = 104810;
  root.userData.a1AutoGateAttachedTunnelLengthMeters = attachedTunnelLength;
  root.userData.a1AutoGateRequiredPrePushSequence =
    "AutoGate DISENGAGE: preserve exact source height; telescope Segment 11 and rotate bridge/cabin horizontally to park";
  root.userData.a1AutoGateTerminalTunnelVisual = terminalTunnelVisual.name;
  setDeployment(1);

  return controller;
}
