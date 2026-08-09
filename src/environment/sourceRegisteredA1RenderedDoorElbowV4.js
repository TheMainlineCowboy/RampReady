import {
  enforceSourceRegisteredA1RotundaElbow as enforceLegacySourceTargetElbow,
} from "./sourceRegisteredA1RotundaElbowV3.js";

const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "source-airport-a1-fixed-rotunda-rigid-heading-aircraft-conforms-v6";
const TARGET_DIRECTION_AUTHORITY = "source-jetway-cab-endpoint-aircraft-conforms-v1";
const TELESCOPING_AUTHORITY = "a1-source-authored-rigid-heading-aircraft-conforms-v1";
const SOURCE_MODEL_YAW_DEGREES = 0.491;
const AUTHORED_DOOR_LOCAL_X = -1.34;
const AUTHORED_DOOR_LOCAL_Z = 7.32;
const MINIMUM_SOURCE_AXIS_COSINE = 0.99999;

function centerInFleet(THREE, fleet, object) {
  fleet.updateWorldMatrix(true, true);
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(`A1 source-owned fit cannot measure ${object?.name || "object"}`);
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
  if (points.length < 100) throw new Error(`A1 source-owned fit has too few vertices for ${object?.name || "object"}: ${points.length}`);
  return points;
}

function endpointBandCenter(THREE, points, origin, direction, bandMeters = 0.16) {
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const point of points) maximumProjection = Math.max(maximumProjection, point.clone().sub(origin).dot(direction));
  const selected = points.filter((point) => maximumProjection - point.clone().sub(origin).dot(direction) <= bandMeters);
  if (selected.length < 3) throw new Error("A1 source-owned Cab endpoint band is empty");
  const center = new THREE.Vector3();
  for (const point of selected) center.add(point);
  return center.multiplyScalar(1 / selected.length);
}

function measureLowContactWorld(THREE, model) {
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
  if (!Number.isFinite(minimumY) || meshes.length < 5) throw new Error("A1 source-owned fit could not measure authored low contact");
  const bounds = new THREE.Box3();
  let count = 0;
  for (const { entry, position } of meshes) {
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(entry.matrixWorld);
      if (point.y > minimumY + 0.08) continue;
      bounds.expandByPoint(point);
      count += 1;
    }
  }
  if (bounds.isEmpty() || count < 8) throw new Error(`A1 source-owned fit lost authored ramp contact: ${count}`);
  return {
    minimumY,
    count,
    center: bounds.getCenter(new THREE.Vector3()),
    span: bounds.getSize(new THREE.Vector3()),
  };
}

export function enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements) {
  const legacy = enforceLegacySourceTargetElbow(THREE, group, fleet, placements);
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  const cab = model?.getObjectByName("Cab") || model?.getObjectByName("Cab_Jetway_0");
  if (!placement || !anchor || !model || !rotunda || !tunnelA || !cab) {
    throw new Error("A1 source-owned fit cannot resolve the exact Rotunda/Tunnel A/Cab chain");
  }

  // The preceding source pass is authoritative. From this point forward the
  // complete supplied A1 bridge may not rotate, translate, or telescope merely
  // to chase an aircraft door. Measure the Cab endpoint where the decoded KPHX
  // x/z/yaw places it; the trainer will place the starting aircraft to this
  // endpoint instead.
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const fixedRotunda = centerInFleet(THREE, fleet, rotunda);
  const expectedRotundaX = Number(placement.x);
  const expectedRotundaZ = Number(placement.z);
  const rotundaPreservationError = Math.hypot(fixedRotunda.x - expectedRotundaX, fixedRotunda.z - expectedRotundaZ);
  if (rotundaPreservationError > 0.002) {
    throw new Error(`A1 source-owned rendered-door stage found the Rotunda off its decoded KPHX position by ${rotundaPreservationError} m`);
  }

  const tunnelACenter = centerInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelACenter.clone().sub(fixedRotunda);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("A1 source-owned bridge direction is degenerate");
  bridgeDirection.normalize();

  const cabContact = endpointBandCenter(THREE, verticesInFleet(THREE, fleet, cab), fixedRotunda, bridgeDirection);
  const cabVector = cabContact.clone().sub(fixedRotunda);
  cabVector.y = 0;
  const targetDistance = cabVector.length();
  if (!(targetDistance > 15 && targetDistance < 45)) {
    throw new Error(`A1 source-owned Cab distance is invalid: ${targetDistance}`);
  }
  const cabDirection = cabVector.clone().normalize();
  const targetAlignmentCosine = cabDirection.dot(bridgeDirection);
  if (targetAlignmentCosine < MINIMUM_SOURCE_AXIS_COSINE) {
    throw new Error(`A1 source-owned Cab endpoint is not on the decoded bridge axis: ${targetAlignmentCosine}`);
  }

  const terminalDirectionRaw = group.userData.uploadedJetwayA1TerminalConnectionDirection || [];
  const terminalDirection = new THREE.Vector3(Number(terminalDirectionRaw[0]), 0, Number(terminalDirectionRaw[1]));
  if (![terminalDirection.x, terminalDirection.z].every(Number.isFinite) || terminalDirection.lengthSq() < 0.9) {
    throw new Error("A1 source-owned terminal direction is missing");
  }
  terminalDirection.normalize();
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(
    Math.acos(THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1)),
  );
  if (!(cornerAngleDegrees >= 45 && cornerAngleDegrees <= 150)) {
    throw new Error(`A1 decoded KPHX bridge lost the required terminal-side elbow: ${cornerAngleDegrees}`);
  }

  const targetWorld = fleet.localToWorld(cabContact.clone());
  const rotundaWorld = fleet.localToWorld(fixedRotunda.clone());
  const lowContact = measureLowContactWorld(THREE, model);

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;
  group.userData.uploadedJetwayA1TargetDirectionAuthority = TARGET_DIRECTION_AUTHORITY;
  group.userData.uploadedJetwayA1TelescopingAuthority = TELESCOPING_AUTHORITY;
  group.userData.uploadedJetwayA1TargetAlignmentCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1TunnelAxisTargetCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1EndpointAngularCorrectionRadians = 0;
  group.userData.uploadedJetwayA1SourceDoorTargetX = cabContact.x;
  group.userData.uploadedJetwayA1SourceDoorTargetZ = cabContact.z;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldX = targetWorld.x;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldZ = targetWorld.z;
  group.userData.uploadedJetwayA1SourceDoorTargetDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1RotundaPreservationErrorMeters = rotundaPreservationError;
  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = cornerAngleDegrees;
  group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters = 0;
  group.userData.uploadedJetwayA1CabContactWorldX = targetWorld.x;
  group.userData.uploadedJetwayA1CabContactWorldZ = targetWorld.z;
  group.userData.uploadedJetwayA1ExactRotundaWorldX = rotundaWorld.x;
  group.userData.uploadedJetwayA1ExactRotundaWorldY = rotundaWorld.y;
  group.userData.uploadedJetwayA1ExactRotundaWorldZ = rotundaWorld.z;
  group.userData.uploadedJetwayA1RenderedDoorLocalX = AUTHORED_DOOR_LOCAL_X;
  group.userData.uploadedJetwayA1RenderedDoorLocalZ = AUTHORED_DOOR_LOCAL_Z;
  group.userData.uploadedJetwayA1RenderedDoorSourceModelYawDegrees = SOURCE_MODEL_YAW_DEGREES;
  group.userData.uploadedJetwayA1TelescopeCorrectionMeters = 0;
  group.userData.uploadedJetwayA1ResidualTelescopeCorrectionMeters = 0;
  group.userData.uploadedJetwayA1FinalCabReachMeters = targetDistance;
  group.userData.uploadedJetwayA1TargetDoorDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1PredictedContactDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1ActualContactDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1PredictedDoorGapMeters = 0;
  group.userData.uploadedJetwayA1ActualDoorGapMeters = 0;
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
    yawDeltaRadians: 0,
    endpointAngularCorrectionRadians: 0,
    targetAlignmentCosine,
    tunnelAxisTargetCosine: targetAlignmentCosine,
    targetDistanceMeters: targetDistance,
    telescopeCorrectionMeters: 0,
    residualTelescopeCorrectionMeters: 0,
    finalCabErrorMeters: 0,
    finalCabReachMeters: targetDistance,
    cornerAngleDegrees,
    sourceDoorTargetLocal: [cabContact.x, cabContact.z],
    sourceDoorTargetWorld: [targetWorld.x, targetWorld.z],
    finalCabWorld: [targetWorld.x, targetWorld.z],
  });
}

export {
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
  TARGET_DIRECTION_AUTHORITY as SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY,
  TELESCOPING_AUTHORITY as SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY,
};
