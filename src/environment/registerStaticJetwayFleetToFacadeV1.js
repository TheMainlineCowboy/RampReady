import { addUploadedAirportJetwayStaticTerminalConnectors } from "./uploadedAirportJetwayTerminalConnector.js";

const AUTHORITY = "57-static-rotundas-photo-registered-to-terminal-facade-v1";
const GROUND_AUTHORITY = "a1-anchor-only-grounding-static-fleet-pavement-zero-v1";
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

function buildRegisteredPlacement(THREE, placement) {
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
  const x = wallX - ux * ROTUNDA_CENTER_TO_WALL_METERS;
  const z = wallZ - uz * ROTUNDA_CENTER_TO_WALL_METERS;
  const bridgeDx = targetX - x;
  const bridgeDz = targetZ - z;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const displacement = Math.hypot(x - sourceX, z - sourceZ);
  if (!(displacement <= MAXIMUM_REGISTRATION_DISPLACEMENT_METERS)) {
    throw new Error(`Static jetway ${placement.gate} facade registration displacement is excessive: ${displacement}`);
  }
  const wallError = Math.abs(Math.hypot(wallX - x, wallZ - z) - ROTUNDA_CENTER_TO_WALL_METERS);
  const yawChange = Math.abs(wrapYaw(THREE, yaw - sourceYaw));
  return {
    ...placement,
    x,
    z,
    yaw,
    aircraftDoorDistance: bridgeDistance,
    wallConnectorLength: ROTUNDA_CENTER_TO_WALL_METERS,
    staticFacadeWallX: wallX,
    staticFacadeWallZ: wallZ,
    staticFacadeRegistrationDisplacementMeters: displacement,
    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticFacadeWallErrorMeters: wallError,
    staticFacadeRegistrationAuthority: AUTHORITY,
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
    position.set(Number(after.x), 0, Number(after.z));
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
  const staticRegisteredPlacements = staticOriginalPlacements.map((placement) => buildRegisteredPlacement(THREE, placement));
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
    marker.position.set(registered.x, 0, registered.z);
    marker.rotation.y = registered.yaw;
    marker.userData.staticFacadeRegistrationAuthority = AUTHORITY;
    marker.userData.staticFacadeWallDistanceMeters = ROTUNDA_CENTER_TO_WALL_METERS;
  }

  const oldConnectors = fleet.getObjectByName("UploadedAirportJetwayStaticTerminalConnectorBatches");
  if (oldConnectors) {
    oldConnectors.removeFromParent();
    disposeConnectorGroup(oldConnectors);
  }
  const rebuiltConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);

  const maximumDisplacement = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationDisplacementMeters));
  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));
  const maximumWallError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeWallErrorMeters));
  if (maximumWallError > 1e-6) throw new Error(`Static Rotunda facade registration wall error is ${maximumWallError}`);

  group.userData.uploadedJetwayStaticFacadeRegistrationAuthority = AUTHORITY;
  group.userData.uploadedJetwayStaticFacadeRegisteredGateCount = 57;
  group.userData.uploadedJetwayStaticFacadeMaximumDisplacementMeters = maximumDisplacement;
  group.userData.uploadedJetwayStaticFacadeMaximumYawChangeRadians = maximumYawChange;
  group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters = maximumWallError;
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
    gateCount: 57,
    rotundaCenterToWallMeters: ROTUNDA_CENTER_TO_WALL_METERS,
    visibleTerminalLegMeters: VISIBLE_TERMINAL_LEG_METERS,
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
};
