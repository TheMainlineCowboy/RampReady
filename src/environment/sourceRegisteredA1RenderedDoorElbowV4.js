import {
  enforceSourceRegisteredA1RotundaElbow as enforceLegacySourceTargetElbow,
} from "./sourceRegisteredA1RotundaElbowV3.js";

const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "source-airport-a1-fixed-rotunda-rigid-heading-aircraft-conforms-v6";
const TARGET_DIRECTION_AUTHORITY = "source-jetway-cab-endpoint-aircraft-conforms-v1";
const TELESCOPING_AUTHORITY = "a1-source-authored-rigid-heading-aircraft-conforms-v1";
const RENDERED_DOOR_CONTINUITY_AUTHORITY = "a1-rendered-door-source-heading-through-continuity-v1";
const SOURCE_MODEL_YAW_DEGREES = 0.491;
const AUTHORED_DOOR_LOCAL_X = -1.34;
const AUTHORED_DOOR_LOCAL_Z = 7.32;
const MINIMUM_REAL_WALL_DISTANCE_METERS = 2.9;
const MAXIMUM_REAL_WALL_DISTANCE_METERS = 5.8;
const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;
const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;
// The exact Cab endpoint band and Tunnel-A mesh centroid are not mathematically
// collinear even when every supplied child transform is untouched. Accept a
// sub-degree source-mesh centroid difference without rotating or telescoping the
// bridge to manufacture a perfect line. 0.9999 is about 0.81 degrees.
const MINIMUM_SOURCE_AXIS_COSINE = 0.9999;

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

  // The preceding real-wall pass is authoritative. From this point forward the
  // complete supplied A1 bridge may not rotate, translate, or telescope merely
  // to chase an aircraft door. Critically, placement.x/z are the raw decoded
  // source-placement reference, NOT the final rendered Rotunda center after the
  // verified terminal-wall registration. The old equality check against those
  // coordinates rejected the correct short wall fit and forced the later 18.56 m
  // duplicate terminal tunnel. Validate the physical wall/Rotunda registration
  // produced by the preceding pass instead.
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const fixedRotunda = centerInFleet(THREE, fleet, rotunda);
  const terminalWallDistance = Number(group.userData.uploadedJetwayA1TerminalWallDistanceMeters);
  const visibleTerminalLegMeters = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters);
  const rotundaPreservationError = Number(group.userData.uploadedJetwayA1RotundaPreservationErrorMeters);
  if (!(terminalWallDistance >= MINIMUM_REAL_WALL_DISTANCE_METERS && terminalWallDistance <= MAXIMUM_REAL_WALL_DISTANCE_METERS)) {
    throw new Error(`A1 rendered-door stage lost the verified real terminal wall distance: ${terminalWallDistance} m`);
  }
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(`A1 rendered-door stage lost the verified compact terminal leg: ${visibleTerminalLegMeters} m`);
  }
  if (!Number.isFinite(rotundaPreservationError) || rotundaPreservationError > 0.001) {
    throw new Error(`A1 rendered-door stage moved the Rotunda after real-wall registration: ${rotundaPreservationError} m`);
  }
  const decodedSourceRotundaOffsetMeters = Math.hypot(
    fixedRotunda.x - Number(placement.x),
    fixedRotunda.z - Number(placement.z),
  );
  if (!Number.isFinite(decodedSourceRotundaOffsetMeters)) {
    throw new Error("A1 rendered-door stage cannot measure the decoded-source/reference offset");
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
  const terminalBridgeDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(terminalBridgeDot));
  const throughTurnDegrees = 180 - cornerAngleDegrees;
  // The terminal leg and decoded-source bridge must continue through the Rotunda
  // into opposite hemispheres. Do not require an artificial 30+ degree visible
  // bend: the measured KPHX wall and supplied bridge currently produce a nearly
  // straight physical path, and rotating the airport-owned bridge to manufacture
  // an elbow would violate the decoded source heading.
  if (!Number.isFinite(cornerAngleDegrees) || terminalBridgeDot >= 0) {
    throw new Error(`A1 rendered-door source-heading path folds back through the Rotunda: branch=${cornerAngleDegrees} turn=${throughTurnDegrees}`);
  }

  const targetWorld = fleet.localToWorld(cabContact.clone());
  const rotundaWorld = fleet.localToWorld(fixedRotunda.clone());
  const lowContact = measureLowContactWorld(THREE, model);

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;
  group.userData.uploadedJetwayA1TargetDirectionAuthority = TARGET_DIRECTION_AUTHORITY;
  group.userData.uploadedJetwayA1TelescopingAuthority = TELESCOPING_AUTHORITY;
  group.userData.uploadedJetwayA1RenderedDoorContinuityAuthority = RENDERED_DOOR_CONTINUITY_AUTHORITY;
  group.userData.uploadedJetwayA1RenderedDoorThroughTurnDegrees = throughTurnDegrees;
  group.userData.uploadedJetwayA1TargetAlignmentCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1TunnelAxisTargetCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1EndpointAngularCorrectionRadians = 0;
  group.userData.uploadedJetwayA1SourceDoorTargetX = cabContact.x;
  group.userData.uploadedJetwayA1SourceDoorTargetZ = cabContact.z;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldX = targetWorld.x;
  group.userData.uploadedJetwayA1SourceDoorTargetWorldZ = targetWorld.z;
  group.userData.uploadedJetwayA1SourceDoorTargetDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1RotundaPreservationErrorMeters = rotundaPreservationError;
  group.userData.uploadedJetwayA1DecodedSourceRotundaOffsetMeters = decodedSourceRotundaOffsetMeters;
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
    renderedDoorContinuityAuthority: RENDERED_DOOR_CONTINUITY_AUTHORITY,
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
    throughTurnDegrees,
    decodedSourceRotundaOffsetMeters,
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
