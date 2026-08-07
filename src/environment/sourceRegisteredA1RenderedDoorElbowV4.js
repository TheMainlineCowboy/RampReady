import {
  enforceSourceRegisteredA1RotundaElbow as enforceLegacySourceTargetElbow,
} from "./sourceRegisteredA1RotundaElbowV3.js";

const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "photo-registered-a1-fixed-wall-rotunda-rendered-door-target-elbow-v4";
const TARGET_DIRECTION_AUTHORITY = "authored-rendered-forward-left-door-at-source-a1-stop-v2";
const TELESCOPING_AUTHORITY = "a1-authored-tunnels-fitted-to-rendered-source-door-v1";
const SOURCE_MODEL_YAW_DEGREES = 0.491;
const AUTHORED_DOOR_LOCAL_X = -1.262;
const AUTHORED_DOOR_LOCAL_Z = 3.90;
const MAXIMUM_FINAL_CAB_ERROR_METERS = 0.06;
const MAXIMUM_TELESCOPE_CORRECTION_METERS = 5.0;

function wrappedAngle(THREE, radians) {
  return THREE.MathUtils.euclideanModulo(radians + Math.PI, Math.PI * 2) - Math.PI;
}

function centerInFleet(THREE, fleet, object) {
  fleet.updateWorldMatrix(true, true);
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(`A1 rendered-door fit cannot measure ${object?.name || "object"}`);
  return fleet.worldToLocal(bounds.getCenter(new THREE.Vector3()));
}

function verticesInFleet(THREE, fleet, object) {
  const points = [];
  const point = new THREE.Vector3();
  fleet.updateWorldMatrix(true, true);
  object.updateWorldMatrix(true, true);
  object.traverse((entry) => {
    if (!entry?.isMesh || entry.visible === false) return;
    const position = entry.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(entry.matrixWorld);
      fleet.worldToLocal(point);
      points.push(point.clone());
    }
  });
  if (points.length < 100) throw new Error(`A1 rendered-door fit has too few vertices for ${object?.name || "object"}: ${points.length}`);
  return points;
}

function endpointBandCenter(THREE, points, origin, direction, bandMeters = 0.16) {
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const point of points) maximumProjection = Math.max(maximumProjection, point.clone().sub(origin).dot(direction));
  const selected = points.filter((point) => maximumProjection - point.clone().sub(origin).dot(direction) <= bandMeters);
  if (selected.length < 3) throw new Error("A1 rendered-door Cab endpoint band is empty");
  const center = new THREE.Vector3();
  for (const point of selected) center.add(point);
  return center.multiplyScalar(1 / selected.length);
}

function sourceDoorTargetInFleet(THREE) {
  const yaw = THREE.MathUtils.degToRad(SOURCE_MODEL_YAW_DEGREES);
  return new THREE.Vector3(
    Math.cos(yaw) * AUTHORED_DOOR_LOCAL_X + Math.sin(yaw) * AUTHORED_DOOR_LOCAL_Z,
    0,
    -Math.sin(yaw) * AUTHORED_DOOR_LOCAL_X + Math.cos(yaw) * AUTHORED_DOOR_LOCAL_Z,
  );
}

function measureLowContactWorld(THREE, fleet, model) {
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const point = new THREE.Vector3();
  let minimumY = Number.POSITIVE_INFINITY;
  const meshes = [];
  model.traverse((entry) => {
    if (!entry?.isMesh || entry.visible === false) return;
    const position = entry.geometry?.getAttribute?.("position");
    if (!position) return;
    meshes.push({ entry, position });
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(entry.matrixWorld);
      minimumY = Math.min(minimumY, point.y);
    }
  });
  if (!Number.isFinite(minimumY) || meshes.length < 5) throw new Error("A1 rendered-door fit could not measure authored low contact");
  const band = 0.08;
  const bounds = new THREE.Box3();
  let count = 0;
  for (const { entry, position } of meshes) {
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(entry.matrixWorld);
      if (point.y > minimumY + band) continue;
      bounds.expandByPoint(point);
      count += 1;
    }
  }
  if (bounds.isEmpty() || count < 8) throw new Error(`A1 rendered-door fit lost authored ramp contact: ${count}`);
  const center = bounds.getCenter(new THREE.Vector3());
  const span = bounds.getSize(new THREE.Vector3());
  return { minimumY, count, center, span };
}

export function enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements) {
  const legacy = enforceLegacySourceTargetElbow(THREE, group, fleet, placements);
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  const tunnelB = model?.getObjectByName("Tunnel_B") || model?.getObjectByName("Tunnel_B_Jetway_0");
  const tunnelC = model?.getObjectByName("Tunnel_C") || model?.getObjectByName("Tunnel_C_Jetway_0");
  const cab = model?.getObjectByName("Cab") || model?.getObjectByName("Cab_Jetway_0");
  if (!placement || !anchor || !model || !rotunda || !tunnelA || !tunnelB || !tunnelC || !cab) {
    throw new Error("A1 rendered-door fit cannot resolve the complete exact five-part bridge");
  }

  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const fixedRotunda = centerInFleet(THREE, fleet, rotunda);
  const targetPoint = sourceDoorTargetInFleet(THREE);
  targetPoint.y = fixedRotunda.y;
  const targetDirection = targetPoint.clone().sub(fixedRotunda);
  targetDirection.y = 0;
  const targetDistance = targetDirection.length();
  if (!(targetDistance > 20 && targetDistance < 35)) throw new Error(`A1 rendered source-door target distance is invalid: ${targetDistance}`);
  targetDirection.normalize();

  const tunnelACenter = centerInFleet(THREE, fleet, tunnelA);
  const currentDirection = tunnelACenter.clone().sub(fixedRotunda);
  currentDirection.y = 0;
  if (currentDirection.lengthSq() < 0.25) throw new Error("A1 rendered-door bridge direction is degenerate");
  currentDirection.normalize();
  const currentYaw = Math.atan2(currentDirection.x, currentDirection.z);
  const targetYaw = Math.atan2(targetDirection.x, targetDirection.z);
  const yawDelta = wrappedAngle(THREE, targetYaw - currentYaw);
  anchor.rotation.y += yawDelta;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const rotatedRotunda = centerInFleet(THREE, fleet, rotunda);
  anchor.position.x += fixedRotunda.x - rotatedRotunda.x;
  anchor.position.z += fixedRotunda.z - rotatedRotunda.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const preservedRotunda = centerInFleet(THREE, fleet, rotunda);
  const rotundaPreservationError = Math.hypot(preservedRotunda.x - fixedRotunda.x, preservedRotunda.z - fixedRotunda.z);
  if (rotundaPreservationError > 1e-6) throw new Error(`A1 rendered-door pivot moved the fixed Rotunda by ${rotundaPreservationError} m`);

  const bridgeDirection = centerInFleet(THREE, fleet, tunnelA).sub(preservedRotunda);
  bridgeDirection.y = 0;
  bridgeDirection.normalize();
  const targetAlignmentCosine = bridgeDirection.dot(targetDirection);
  if (targetAlignmentCosine < 0.99999) throw new Error(`A1 rendered-door heading alignment failed: ${targetAlignmentCosine}`);

  // Measure the existing exact Cab endpoint after the final heading pivot, then
  // change only the authored telescoping part translations. Tunnel A/Rotunda and
  // the terminal connector remain fixed. This keeps the supplied hierarchy and
  // makes the Cab meet the real rendered door rather than moving the airplane.
  const beforeCabContact = endpointBandCenter(THREE, verticesInFleet(THREE, fleet, cab), preservedRotunda, bridgeDirection);
  const beforeReach = beforeCabContact.clone().sub(preservedRotunda).dot(bridgeDirection);
  const telescopeCorrection = targetDistance - beforeReach;
  if (!Number.isFinite(telescopeCorrection) || Math.abs(telescopeCorrection) > MAXIMUM_TELESCOPE_CORRECTION_METERS) {
    throw new Error(`A1 rendered-door telescope correction is invalid: ${telescopeCorrection}`);
  }
  tunnelB.position.z += telescopeCorrection / 3;
  tunnelC.position.z += telescopeCorrection * 2 / 3;
  cab.position.z += telescopeCorrection;
  tunnelB.updateMatrix();
  tunnelC.updateMatrix();
  cab.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const finalRotunda = centerInFleet(THREE, fleet, rotunda);
  const finalCabContact = endpointBandCenter(THREE, verticesInFleet(THREE, fleet, cab), finalRotunda, targetDirection);
  const finalCabError = Math.hypot(finalCabContact.x - targetPoint.x, finalCabContact.z - targetPoint.z);
  const finalReach = finalCabContact.clone().sub(finalRotunda).dot(targetDirection);
  if (finalCabError > MAXIMUM_FINAL_CAB_ERROR_METERS) {
    throw new Error(`A1 exact Cab missed the actual rendered source-gate door by ${finalCabError} m`);
  }

  const terminalDirectionRaw = group.userData.uploadedJetwayA1TerminalConnectionDirection || [];
  const terminalDirection = new THREE.Vector3(Number(terminalDirectionRaw[0]), 0, Number(terminalDirectionRaw[1]));
  terminalDirection.normalize();
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(terminalDirection.dot(targetDirection), -1, 1)));
  if (!(cornerAngleDegrees >= 45 && cornerAngleDegrees <= 150)) {
    throw new Error(`A1 rendered-door fit lost the visible Rotunda elbow: ${cornerAngleDegrees}`);
  }

  const targetWorld = fleet.localToWorld(targetPoint.clone());
  const cabWorld = fleet.localToWorld(finalCabContact.clone());
  const rotundaWorld = fleet.localToWorld(finalRotunda.clone());
  const lowContact = measureLowContactWorld(THREE, fleet, model);

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;
  group.userData.uploadedJetwayA1TargetDirectionAuthority = TARGET_DIRECTION_AUTHORITY;
  group.userData.uploadedJetwayA1TelescopingAuthority = TELESCOPING_AUTHORITY;
  group.userData.uploadedJetwayA1TargetAlignmentCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1SourceDoorTargetX = targetPoint.x;
  group.userData.uploadedJetwayA1SourceDoorTargetZ = targetPoint.z;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldX = targetWorld.x;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldZ = targetWorld.z;
  group.userData.uploadedJetwayA1SourceDoorTargetDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1RotundaPreservationErrorMeters = rotundaPreservationError;
  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = cornerAngleDegrees;
  group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters = finalCabError;
  group.userData.uploadedJetwayA1CabContactWorldX = cabWorld.x;
  group.userData.uploadedJetwayA1CabContactWorldZ = cabWorld.z;
  group.userData.uploadedJetwayA1ExactRotundaWorldX = rotundaWorld.x;
  group.userData.uploadedJetwayA1ExactRotundaWorldY = rotundaWorld.y;
  group.userData.uploadedJetwayA1ExactRotundaWorldZ = rotundaWorld.z;
  group.userData.uploadedJetwayA1RenderedDoorLocalX = AUTHORED_DOOR_LOCAL_X;
  group.userData.uploadedJetwayA1RenderedDoorLocalZ = AUTHORED_DOOR_LOCAL_Z;
  group.userData.uploadedJetwayA1RenderedDoorSourceModelYawDegrees = SOURCE_MODEL_YAW_DEGREES;
  group.userData.uploadedJetwayA1TelescopeCorrectionMeters = telescopeCorrection;
  group.userData.uploadedJetwayA1FinalCabReachMeters = finalReach;
  group.userData.uploadedJetwayA1TargetDoorDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1PredictedContactDistanceMeters = finalReach;
  group.userData.uploadedJetwayA1ActualContactDistanceMeters = finalReach;
  group.userData.uploadedJetwayA1PredictedDoorGapMeters = Math.abs(finalReach - targetDistance);
  group.userData.uploadedJetwayA1ActualDoorGapMeters = finalCabError;
  group.userData.uploadedJetwayBogieGroundContactCenterX = lowContact.center.x;
  group.userData.uploadedJetwayBogieGroundContactCenterY = lowContact.center.y;
  group.userData.uploadedJetwayBogieGroundContactCenterZ = lowContact.center.z;
  group.userData.uploadedJetwayBogieGroundContactMinimumX = lowContact.center.x - lowContact.span.x / 2;
  group.userData.uploadedJetwayBogieGroundContactMinimumZ = lowContact.center.z - lowContact.span.z / 2;
  group.userData.uploadedJetwayBogieGroundContactMaximumX = lowContact.center.x + lowContact.span.x / 2;
  group.userData.uploadedJetwayBogieGroundContactMaximumZ = lowContact.center.z + lowContact.span.z / 2;
  group.userData.uploadedJetwayBogieGroundContactPointCount = lowContact.count;

  return Object.freeze({
    ...legacy,
    authority: SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
    targetDirectionAuthority: TARGET_DIRECTION_AUTHORITY,
    telescopingAuthority: TELESCOPING_AUTHORITY,
    yawDeltaRadians: yawDelta,
    targetAlignmentCosine,
    targetDistanceMeters: targetDistance,
    telescopeCorrectionMeters: telescopeCorrection,
    finalCabErrorMeters: finalCabError,
    finalCabReachMeters: finalReach,
    cornerAngleDegrees,
    sourceDoorTargetLocal: [targetPoint.x, targetPoint.z],
    sourceDoorTargetWorld: [targetWorld.x, targetWorld.z],
    finalCabWorld: [cabWorld.x, cabWorld.z],
  });
}

export {
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
  TARGET_DIRECTION_AUTHORITY as SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY,
  TELESCOPING_AUTHORITY as SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY,
};
