import { addUploadedAirportJetwayStaticTerminalConnectors } from "./uploadedAirportJetwayTerminalConnector.js";

const AUTHORITY = "57-static-authored-rotundas-photo-registered-to-terminal-facade-v2";
const GROUND_AUTHORITY = "a1-anchor-only-grounding-static-fleet-pavement-zero-v1";
const ROOT_OFFSET_AUTHORITY = "exact-supplied-glb-authored-rotunda-center-to-model-root-v1";
const SOURCE_WALL_LENGTH_PADDING_METERS = 0.35;
const VISIBLE_TERMINAL_LEG_METERS = 2.4;
const ROTUNDA_COLLAR_RADIUS_METERS = 1.58;
const ROTUNDA_CENTER_TO_WALL_METERS = VISIBLE_TERMINAL_LEG_METERS + ROTUNDA_COLLAR_RADIUS_METERS;
const MAXIMUM_REGISTRATION_DISPLACEMENT_METERS = 45;

function wrapYaw(THREE, radians) {
  return THREE.MathUtils.euclideanModulo(radians + Math.PI, Math.PI * 2) - Math.PI;
}

function disposeConnectorGroup(group) {
  const geometries = new Set();
  const materials = new Set();
  group?.traverse?.((entry) => {
    if (entry.geometry) geometries.add(entry.geometry);
    for (const material of Array.isArray(entry.material) ? entry.material : [entry.material]) {
      if (material) materials.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose?.();
  for (const material of materials) material.dispose?.();
}

function measureAuthoredRotundaOffsetFromModelRoot(THREE, a1Anchor) {
  const model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  if (!model || !rotunda) {
    throw new Error("Static jetway registration could not measure the exact supplied Rotunda/model-root offset");
  }
  a1Anchor.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  rotunda.updateWorldMatrix(true, true);
  const worldBounds = new THREE.Box3().setFromObject(rotunda);
  if (worldBounds.isEmpty()) throw new Error("Exact supplied Rotunda has empty bounds during static registration");
  const worldCenter = worldBounds.getCenter(new THREE.Vector3());
  const localCenter = a1Anchor.worldToLocal(worldCenter.clone());
  if (![localCenter.x, localCenter.y, localCenter.z].every(Number.isFinite)) {
    throw new Error(`Exact supplied Rotunda/model-root offset is invalid: ${localCenter.toArray().join(",")}`);
  }
  const horizontalMagnitude = Math.hypot(localCenter.x, localCenter.z);
  if (horizontalMagnitude > 12) {
    throw new Error(`Exact supplied Rotunda/model-root horizontal offset is excessive: ${horizontalMagnitude}`);
  }
  return Object.freeze({
    x: localCenter.x,
    y: localCenter.y,
    z: localCenter.z,
    horizontalMagnitude,
    authority: ROOT_OFFSET_AUTHORITY,
  });
}

function buildRegisteredPlacement(THREE, placement, authoredRotundaOffset) {
  const sourceX = Number(placement.x);
  const sourceZ = Number(placement.z);
  const sourceYaw = Number(placement.yaw);
  const towardX = Number(placement.connectorTowardX);
  const towardZ = Number(placement.connectorTowardZ);
  const targetX = Number(placement.targetX);
  const targetZ = Number(placement.targetZ);
  const sourceWallDistance = Number(placement.wallConnectorLength) - SOURCE_WALL_LENGTH_PADDING_METERS;
  if (![sourceX, sourceZ, sourceYaw, towardX, towardZ, targetX, targetZ, sourceWallDistance].every(Number.isFinite)) {
    throw new Error(`Static jetway ${placement.gate} has incomplete source/facade registration evidence`);
  }
  const magnitude = Math.hypot(towardX, towardZ);
  if (!(magnitude > 0.95 && magnitude < 1.05)) {
    throw new Error(`Static jetway ${placement.gate} terminal direction is not normalized: ${magnitude}`);
  }
  if (!(sourceWallDistance > 0.4 && sourceWallDistance < 44)) {
    throw new Error(`Static jetway ${placement.gate} source-to-wall distance is invalid: ${sourceWallDistance}`);
  }
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const rotundaX = wallX - ux * ROTUNDA_CENTER_TO_WALL_METERS;
  const rotundaZ = wallZ - uz * ROTUNDA_CENTER_TO_WALL_METERS;
  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;

  // placement.x/z remain the PHYSICAL Rotunda center because articulation,
  // fixed terminal connectors and Cab closures are all Rotunda-relative. Only
  // the exact GLB instance matrix uses the corrected model-root coordinate.
  const rotatedRotundaOffset = new THREE.Vector3(
    authoredRotundaOffset.x,
    0,
    authoredRotundaOffset.z,
  ).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const modelRootX = rotundaX - rotatedRotundaOffset.x;
  const modelRootZ = rotundaZ - rotatedRotundaOffset.z;
  const reconstructedRotundaX = modelRootX + rotatedRotundaOffset.x;
  const reconstructedRotundaZ = modelRootZ + rotatedRotundaOffset.z;
  const physicalRotundaRegistrationError = Math.hypot(
    reconstructedRotundaX - rotundaX,
    reconstructedRotundaZ - rotundaZ,
  );

  const displacement = Math.hypot(modelRootX - sourceX, modelRootZ - sourceZ);
  if (!(displacement <= MAXIMUM_REGISTRATION_DISPLACEMENT_METERS)) {
    throw new Error(`Static jetway ${placement.gate} facade registration displacement is excessive: ${displacement}`);
  }
  if (physicalRotundaRegistrationError > 1e-6) {
    throw new Error(`Static jetway ${placement.gate} authored Rotunda registration error is ${physicalRotundaRegistrationError}`);
  }
  const wallError = Math.abs(Math.hypot(wallX - rotundaX, wallZ - rotundaZ) - ROTUNDA_CENTER_TO_WALL_METERS);
  const yawChange = Math.abs(wrapYaw(THREE, yaw - sourceYaw));
  return {
    ...placement,
    // Physical Rotunda coordinate. Keep all Rotunda-relative consumers here.
    x: rotundaX,
    z: rotundaZ,
    yaw,
    aircraftDoorDistance: bridgeDistance,
    wallConnectorLength: ROTUNDA_CENTER_TO_WALL_METERS,
    staticModelRootX: modelRootX,
    staticModelRootZ: modelRootZ,
    staticAuthoredRotundaOffsetX: authoredRotundaOffset.x,
    staticAuthoredRotundaOffsetZ: authoredRotundaOffset.z,
    staticPhysicalRotundaRegistrationErrorMeters: physicalRotundaRegistrationError,
    staticFacadeWallX: wallX,
    staticFacadeWallZ: wallZ,
    staticFacadeRegistrationDisplacementMeters: displacement,
    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticFacadeWallErrorMeters: wallError,
    staticFacadeRegistrationAuthority: AUTHORITY,
    staticModelRootOffsetAuthority: ROOT_OFFSET_AUTHORITY,
  };
}

function applyPlacementDeltaToStaticInstances(THREE, staticBatches, originalPlacements, registeredPlacements) {
  const oldPlacementMatrix = new THREE.Matrix4();
  const newPlacementMatrix = new THREE.Matrix4();
  const inverseOldPlacement = new THREE.Matrix4();
  const delta = new THREE.Matrix4();
  const current = new THREE.Matrix4();
  const next = new THREE.Matrix4();
  const oldEuler = new THREE.Euler();
  const newEuler = new THREE.Euler();
  const oldQuaternion = new THREE.Quaternion();
  const newQuaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < registeredPlacements.length; index += 1) {
    const before = originalPlacements[index];
    const after = registeredPlacements[index];
    oldEuler.set(0, Number(before.yaw), 0);
    newEuler.set(0, Number(after.yaw), 0);
    oldQuaternion.setFromEuler(oldEuler);
    newQuaternion.setFromEuler(newEuler);
    position.set(Number(before.x), 0, Number(before.z));
    oldPlacementMatrix.compose(position, oldQuaternion, scale);
    position.set(Number(after.staticModelRootX), 0, Number(after.staticModelRootZ));
    newPlacementMatrix.compose(position, newQuaternion, scale);
    inverseOldPlacement.copy(oldPlacementMatrix).invert();
    delta.multiplyMatrices(newPlacementMatrix, inverseOldPlacement);

    for (const batch of staticBatches) {
      batch.getMatrixAt(index, current);
      next.multiplyMatrices(delta, current);
      batch.setMatrixAt(index, next);
    }
  }
  for (const batch of staticBatches) {
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
  }
}

export function registerStaticJetwayFleetToFacade(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup || !Array.isArray(placements) || placements.length !== 58) {
    throw new Error("Static jetway facade registration requires the complete Terminal 4 exact fleet and 58 placements");
  }
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  if (!a1Anchor) throw new Error("Static fleet registration could not resolve the individual A1 anchor");
  const authoredRotundaOffset = measureAuthoredRotundaOffsetFromModelRoot(THREE, a1Anchor);

  // The exact prototype is normalized to pavement Y=0 before any instances are
  // created. Later A1 ground-contact correction historically moved fleet.y,
  // which also moved all 57 already-grounded static instances. Transfer that
  // vertical correction to A1 alone, then return the shared fleet to pavement.
  const inheritedFleetYOffset = Number(fleet.position.y);
  if (!Number.isFinite(inheritedFleetYOffset) || Math.abs(inheritedFleetYOffset) > 3) {
    throw new Error(`Exact jetway fleet inherited an invalid vertical offset: ${inheritedFleetYOffset}`);
  }
  a1Anchor.position.y += inheritedFleetYOffset;
  fleet.position.y = 0;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);

  const staticOriginalPlacements = placements.filter((placement) => placement.gate !== "A1").map((placement) => ({ ...placement }));
  if (staticOriginalPlacements.length !== 57) {
    throw new Error(`Static facade registration expected 57 non-A1 placements, received ${staticOriginalPlacements.length}`);
  }
  const staticRegisteredPlacements = staticOriginalPlacements.map((placement) => (
    buildRegisteredPlacement(THREE, placement, authoredRotundaOffset)
  ));
  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");
  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) {
    throw new Error(`Static exact jetway instance batches are invalid: batches=${staticBatches.length}, counts=${staticBatches.map((batch) => batch.count).join(",")}`);
  }
  applyPlacementDeltaToStaticInstances(THREE, staticBatches, staticOriginalPlacements, staticRegisteredPlacements);

  const byGate = new Map(staticRegisteredPlacements.map((placement) => [placement.gate, placement]));
  for (const placement of placements) {
    if (placement.gate === "A1") continue;
    const registered = byGate.get(placement.gate);
    if (!registered) throw new Error(`Static facade registration lost gate ${placement.gate}`);
    Object.assign(placement, registered);
    const marker = fleet.getObjectByName(`UploadedAirportJetway_${placement.gate}`);
    if (!marker) throw new Error(`Static facade registration lost marker ${placement.gate}`);
    marker.position.set(registered.staticModelRootX, 0, registered.staticModelRootZ);
    marker.rotation.y = registered.yaw;
    marker.userData.staticFacadeRegistrationAuthority = AUTHORITY;
    marker.userData.staticModelRootOffsetAuthority = ROOT_OFFSET_AUTHORITY;
    marker.userData.staticPhysicalRotundaX = registered.x;
    marker.userData.staticPhysicalRotundaZ = registered.z;
    marker.userData.staticFacadeWallDistanceMeters = ROTUNDA_CENTER_TO_WALL_METERS;
  }

  const oldConnectors = fleet.getObjectByName("UploadedAirportJetwayStaticTerminalConnectorBatches");
  if (oldConnectors) {
    oldConnectors.removeFromParent();
    disposeConnectorGroup(oldConnectors);
  }
  // Connectors consume placement.x/z, which deliberately remain the physical
  // Rotunda centers after model-root correction.
  const rebuiltConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);

  const maximumDisplacement = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationDisplacementMeters));
  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));
  const maximumWallError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeWallErrorMeters));
  const maximumPhysicalRotundaError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticPhysicalRotundaRegistrationErrorMeters));
  if (maximumWallError > 1e-6) throw new Error(`Static Rotunda facade registration wall error is ${maximumWallError}`);
  if (maximumPhysicalRotundaError > 1e-6) throw new Error(`Static authored Rotunda/model-root registration error is ${maximumPhysicalRotundaError}`);

  group.userData.uploadedJetwayStaticFacadeRegistrationAuthority = AUTHORITY;
  group.userData.uploadedJetwayStaticFacadeRegisteredGateCount = 57;
  group.userData.uploadedJetwayStaticFacadeMaximumDisplacementMeters = maximumDisplacement;
  group.userData.uploadedJetwayStaticFacadeMaximumYawChangeRadians = maximumYawChange;
  group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters = maximumWallError;
  group.userData.uploadedJetwayStaticPhysicalRotundaMaximumErrorMeters = maximumPhysicalRotundaError;
  group.userData.uploadedJetwayStaticModelRootOffsetAuthority = ROOT_OFFSET_AUTHORITY;
  group.userData.uploadedJetwayStaticAuthoredRotundaOffsetX = authoredRotundaOffset.x;
  group.userData.uploadedJetwayStaticAuthoredRotundaOffsetZ = authoredRotundaOffset.z;
  group.userData.uploadedJetwayStaticAuthoredRotundaOffsetHorizontalMeters = authoredRotundaOffset.horizontalMagnitude;
  group.userData.uploadedJetwayStaticRotundaCenterToWallMeters = ROTUNDA_CENTER_TO_WALL_METERS;
  group.userData.uploadedJetwayStaticVisibleTerminalLegMeters = VISIBLE_TERMINAL_LEG_METERS;
  group.userData.uploadedJetwayGroundIsolationAuthority = GROUND_AUTHORITY;
  group.userData.uploadedJetwayStaticFleetGroundYOffsetMeters = fleet.position.y;
  group.userData.uploadedJetwayA1AnchorGroundTransferMeters = inheritedFleetYOffset;
  group.userData.uploadedJetwayStaticConnectorGateCount = rebuiltConnectors.staticGateCount;
  group.userData.uploadedJetwayStaticConnectorBatchCount = rebuiltConnectors.batchCount;
  group.userData.uploadedJetwayStaticConnectorInstanceCount = rebuiltConnectors.instanceCount;
  group.userData.uploadedJetwayStaticConnectorBatchAuthority = rebuiltConnectors.authority;

  return Object.freeze({
    authority: AUTHORITY,
    groundAuthority: GROUND_AUTHORITY,
    modelRootOffsetAuthority: ROOT_OFFSET_AUTHORITY,
    gateCount: 57,
    rotundaCenterToWallMeters: ROTUNDA_CENTER_TO_WALL_METERS,
    visibleTerminalLegMeters: VISIBLE_TERMINAL_LEG_METERS,
    authoredRotundaOffsetX: authoredRotundaOffset.x,
    authoredRotundaOffsetZ: authoredRotundaOffset.z,
    authoredRotundaOffsetHorizontalMeters: authoredRotundaOffset.horizontalMagnitude,
    maximumPhysicalRotundaErrorMeters: maximumPhysicalRotundaError,
    inheritedFleetYOffset,
    staticFleetYOffset: fleet.position.y,
    maximumDisplacementMeters: maximumDisplacement,
    maximumYawChangeRadians: maximumYawChange,
    maximumWallErrorMeters: maximumWallError,
    connectorGateCount: rebuiltConnectors.staticGateCount,
    connectorBatchCount: rebuiltConnectors.batchCount,
  });
}

export {
  AUTHORITY as STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  GROUND_AUTHORITY as STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  ROOT_OFFSET_AUTHORITY as STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
};
