import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";

const AUTHORITY = "57-static-authored-rotundas-real-wall-surface-registration-v4";
const GROUND_AUTHORITY = "a1-anchor-only-grounding-static-fleet-pavement-zero-v1";
const ROOT_OFFSET_AUTHORITY = "exact-supplied-glb-authored-rotunda-center-to-model-root-v1";
const SOURCE_WALL_LENGTH_PADDING_METERS = 0.35;
const VISIBLE_TERMINAL_LEG_METERS = 2.4;
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
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  if (!model || !rotunda || !tunnelA) {
    throw new Error("Static jetway registration could not measure the exact supplied Rotunda/model-root/bridge-axis evidence");
  }
  a1Anchor.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  rotunda.updateWorldMatrix(true, true);
  tunnelA.updateWorldMatrix(true, true);
  const worldBounds = new THREE.Box3().setFromObject(rotunda);
  const tunnelWorldBounds = new THREE.Box3().setFromObject(tunnelA);
  if (worldBounds.isEmpty() || tunnelWorldBounds.isEmpty()) {
    throw new Error("Exact supplied Rotunda/Tunnel A has empty bounds during static registration");
  }
  const worldCenter = worldBounds.getCenter(new THREE.Vector3());
  const worldSize = worldBounds.getSize(new THREE.Vector3());
  const tunnelWorldCenter = tunnelWorldBounds.getCenter(new THREE.Vector3());
  const localCenter = a1Anchor.worldToLocal(worldCenter.clone());
  const localTunnelCenter = a1Anchor.worldToLocal(tunnelWorldCenter.clone());
  const authoredBridgeAxis = localTunnelCenter.clone().sub(localCenter);
  authoredBridgeAxis.y = 0;
  if (authoredBridgeAxis.lengthSq() < 0.25) throw new Error("Exact supplied Rotunda->Tunnel A bridge axis is degenerate");
  authoredBridgeAxis.normalize();
  const bridgeAxisHeadingRadians = Math.atan2(authoredBridgeAxis.x, authoredBridgeAxis.z);
  if (![localCenter.x, localCenter.y, localCenter.z, bridgeAxisHeadingRadians].every(Number.isFinite)) {
    throw new Error("Exact supplied Rotunda/model-root evidence is invalid");
  }
  const horizontalMagnitude = Math.hypot(localCenter.x, localCenter.z);
  if (horizontalMagnitude > 12) throw new Error(`Exact supplied Rotunda/model-root horizontal offset is excessive: ${horizontalMagnitude}`);
  const radiusMeters = Math.max(worldSize.x, worldSize.z) * 0.5;
  if (!(radiusMeters > 0.7 && radiusMeters < 3.5)) throw new Error(`Exact supplied Rotunda horizontal radius is invalid: ${radiusMeters}`);
  return Object.freeze({ x: localCenter.x, y: localCenter.y, z: localCenter.z, horizontalMagnitude, radiusMeters, bridgeAxisHeadingRadians, authority: ROOT_OFFSET_AUTHORITY });
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
  if (!(magnitude > 0.95 && magnitude < 1.05)) throw new Error(`Static jetway ${placement.gate} terminal direction is not normalized: ${magnitude}`);
  if (!(sourceWallDistance > 0.4 && sourceWallDistance < 44)) throw new Error(`Static jetway ${placement.gate} source-to-wall distance is invalid: ${sourceWallDistance}`);
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;

  // Preserve the measured real-facade wall point from the source evidence, but
  // do not preserve a raw BGL jetway origin when it would create a fabricated
  // corridor. Solve the complete rigid GLB parent backward from that real wall:
  // terminal wall -> 2.4 m solid vestibule -> measured authored Rotunda surface.
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const rotundaCenterToWallMeters = authoredRotundaOffset.radiusMeters + VISIBLE_TERMINAL_LEG_METERS;
  const rotundaX = wallX - ux * rotundaCenterToWallMeters;
  const rotundaZ = wallZ - uz * rotundaCenterToWallMeters;
  const visibleTerminalLegMeters = Math.hypot(wallX - rotundaX, wallZ - rotundaZ) - authoredRotundaOffset.radiusMeters;
  if (Math.abs(visibleTerminalLegMeters - VISIBLE_TERMINAL_LEG_METERS) > 0.02) {
    throw new Error(`Static jetway ${placement.gate} compact terminal vestibule solve failed: ${visibleTerminalLegMeters}`);
  }

  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const sourceBridgeAxisHeading = Number(authoredRotundaOffset.bridgeAxisHeadingRadians);
  if (!Number.isFinite(sourceBridgeAxisHeading)) throw new Error(`Static jetway ${placement.gate} is missing exact supplied bridge-axis heading`);
  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);
  const rotatedRotundaOffset = new THREE.Vector3(authoredRotundaOffset.x, 0, authoredRotundaOffset.z)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const modelRootX = rotundaX - rotatedRotundaOffset.x;
  const modelRootZ = rotundaZ - rotatedRotundaOffset.z;
  const reconstructedRotundaX = modelRootX + rotatedRotundaOffset.x;
  const reconstructedRotundaZ = modelRootZ + rotatedRotundaOffset.z;
  const physicalRotundaRegistrationError = Math.hypot(reconstructedRotundaX - rotundaX, reconstructedRotundaZ - rotundaZ);
  const displacement = Math.hypot(modelRootX - sourceX, modelRootZ - sourceZ);
  if (displacement > MAXIMUM_REGISTRATION_DISPLACEMENT_METERS) throw new Error(`Static jetway ${placement.gate} facade registration displacement is excessive: ${displacement}`);
  if (physicalRotundaRegistrationError > 1e-6) throw new Error(`Static jetway ${placement.gate} authored Rotunda registration error is ${physicalRotundaRegistrationError}`);
  const wallError = Math.abs(Math.hypot(wallX - rotundaX, wallZ - rotundaZ) - rotundaCenterToWallMeters);
  const yawChange = Math.abs(wrapYaw(THREE, yaw - sourceYaw));
  return {
    ...placement,
    x: rotundaX,
    z: rotundaZ,
    yaw,
    aircraftDoorDistance: bridgeDistance,
    wallConnectorLength: rotundaCenterToWallMeters,
    staticModelRootX: modelRootX,
    staticModelRootZ: modelRootZ,
    staticAuthoredRotundaOffsetX: authoredRotundaOffset.x,
    staticAuthoredRotundaOffsetZ: authoredRotundaOffset.z,
    staticAuthoredRotundaRadiusMeters: authoredRotundaOffset.radiusMeters,
    staticVisibleTerminalLegMeters: visibleTerminalLegMeters,
    staticSourceWallDistanceMeters: sourceWallDistance,
    staticResolvedRotundaCenterToWallMeters: rotundaCenterToWallMeters,
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
  if (!group?.isGroup || !fleet?.isGroup || !Array.isArray(placements) || placements.length !== 58) throw new Error("Static jetway facade registration requires the complete Terminal 4 exact fleet and 58 placements");
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  if (!a1Anchor) throw new Error("Static fleet registration could not resolve the individual A1 anchor");
  const authoredRotundaOffset = measureAuthoredRotundaOffsetFromModelRoot(THREE, a1Anchor);
  const inheritedFleetYOffset = Number(fleet.position.y);
  if (!Number.isFinite(inheritedFleetYOffset) || Math.abs(inheritedFleetYOffset) > 3) throw new Error(`Exact jetway fleet inherited an invalid vertical offset: ${inheritedFleetYOffset}`);
  a1Anchor.position.y += inheritedFleetYOffset;
  fleet.position.y = 0;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);

  const staticOriginalPlacements = placements.filter((placement) => placement.gate !== "A1").map((placement) => ({ ...placement }));
  if (staticOriginalPlacements.length !== 57) throw new Error(`Static facade registration expected 57 non-A1 placements, received ${staticOriginalPlacements.length}`);
  const staticRegisteredPlacements = staticOriginalPlacements.map((placement) => buildRegisteredPlacement(THREE, placement, authoredRotundaOffset));
  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");
  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) throw new Error(`Static exact jetway instance batches are invalid: batches=${staticBatches.length}, counts=${staticBatches.map((batch) => batch.count).join(",")}`);
  const staticPortalClosures = fleet.getObjectByName("UploadedAirportJetwayStaticPortalClosures");
  const staticClosureBatches = staticPortalClosures?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticPortalClosures && (staticClosureBatches.length !== 6 || staticClosureBatches.some((batch) => batch.count !== 57 && batch.count !== 114))) throw new Error(`Static portal closure batches are invalid: batches=${staticClosureBatches.length}`);
  applyPlacementDeltaToStaticInstances(THREE, [...staticBatches, ...staticClosureBatches], staticOriginalPlacements, staticRegisteredPlacements);

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
    marker.userData.staticFacadeWallDistanceMeters = registered.staticResolvedRotundaCenterToWallMeters;
    marker.userData.staticAuthoredRotundaRadiusMeters = registered.staticAuthoredRotundaRadiusMeters;
    marker.userData.staticVisibleTerminalLegMeters = registered.staticVisibleTerminalLegMeters;
  }

  const oldConnectors = fleet.getObjectByName("UploadedAirportJetwayStaticTerminalConnectorBatches");
  if (oldConnectors) {
    oldConnectors.removeFromParent();
    disposeConnectorGroup(oldConnectors);
  }
  const rebuiltConnectors = addStaticSolidTerminalVestibules(THREE, fleet, placements);
  const maximumDisplacement = Math.max(...staticRegisteredPlacements.map((p) => p.staticFacadeRegistrationDisplacementMeters));
  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((p) => p.staticFacadeRegistrationYawChangeRadians));
  const maximumWallError = Math.max(...staticRegisteredPlacements.map((p) => p.staticFacadeWallErrorMeters));
  const maximumPhysicalRotundaError = Math.max(...staticRegisteredPlacements.map((p) => p.staticPhysicalRotundaRegistrationErrorMeters));
  const minimumVisibleTerminalLeg = Math.min(...staticRegisteredPlacements.map((p) => p.staticVisibleTerminalLegMeters));
  const maximumVisibleTerminalLeg = Math.max(...staticRegisteredPlacements.map((p) => p.staticVisibleTerminalLegMeters));
  const minimumSourceWallDistance = Math.min(...staticRegisteredPlacements.map((p) => p.staticSourceWallDistanceMeters));
  const maximumSourceWallDistance = Math.max(...staticRegisteredPlacements.map((p) => p.staticSourceWallDistanceMeters));
  const resolvedCenterToWall = authoredRotundaOffset.radiusMeters + VISIBLE_TERMINAL_LEG_METERS;
  if (maximumWallError > 1e-6) throw new Error(`Static Rotunda facade registration wall error is ${maximumWallError}`);
  if (maximumPhysicalRotundaError > 1e-6) throw new Error(`Static authored Rotunda/model-root registration error is ${maximumPhysicalRotundaError}`);

  Object.assign(group.userData, {
    uploadedJetwayStaticFacadeRegistrationAuthority: AUTHORITY,
    uploadedJetwayStaticFacadeRegisteredGateCount: 57,
    uploadedJetwayStaticFacadeMaximumDisplacementMeters: maximumDisplacement,
    uploadedJetwayStaticFacadeMaximumYawChangeRadians: maximumYawChange,
    uploadedJetwayStaticFacadeMaximumWallErrorMeters: maximumWallError,
    uploadedJetwayStaticPhysicalRotundaMaximumErrorMeters: maximumPhysicalRotundaError,
    uploadedJetwayStaticModelRootOffsetAuthority: ROOT_OFFSET_AUTHORITY,
    uploadedJetwayStaticAuthoredRotundaOffsetX: authoredRotundaOffset.x,
    uploadedJetwayStaticAuthoredRotundaOffsetZ: authoredRotundaOffset.z,
    uploadedJetwayStaticAuthoredRotundaOffsetHorizontalMeters: authoredRotundaOffset.horizontalMagnitude,
    uploadedJetwayStaticRotundaCenterToWallMeters: resolvedCenterToWall,
    uploadedJetwayStaticVisibleTerminalLegMeters: VISIBLE_TERMINAL_LEG_METERS,
    uploadedJetwayStaticMinimumMeasuredVisibleTerminalLegMeters: minimumVisibleTerminalLeg,
    uploadedJetwayStaticMaximumMeasuredVisibleTerminalLegMeters: maximumVisibleTerminalLeg,
    uploadedJetwayStaticMinimumMeasuredWallDistanceMeters: minimumSourceWallDistance,
    uploadedJetwayStaticMaximumMeasuredWallDistanceMeters: maximumSourceWallDistance,
    uploadedJetwayStaticAuthoredRotundaRadiusMeters: authoredRotundaOffset.radiusMeters,
    uploadedJetwayGroundIsolationAuthority: GROUND_AUTHORITY,
    uploadedJetwayStaticFleetGroundYOffsetMeters: fleet.position.y,
    uploadedJetwayA1AnchorGroundTransferMeters: inheritedFleetYOffset,
    uploadedJetwayStaticConnectorGateCount: rebuiltConnectors.staticGateCount,
    uploadedJetwayStaticConnectorBatchCount: rebuiltConnectors.batchCount,
    uploadedJetwayStaticConnectorInstanceCount: rebuiltConnectors.instanceCount,
    uploadedJetwayStaticConnectorBatchAuthority: rebuiltConnectors.authority,
  });

  return Object.freeze({ authority: AUTHORITY, groundAuthority: GROUND_AUTHORITY, modelRootOffsetAuthority: ROOT_OFFSET_AUTHORITY, gateCount: 57, rotundaCenterToWallMeters: resolvedCenterToWall, visibleTerminalLegMeters: VISIBLE_TERMINAL_LEG_METERS, authoredRotundaOffsetX: authoredRotundaOffset.x, authoredRotundaOffsetZ: authoredRotundaOffset.z, authoredRotundaOffsetHorizontalMeters: authoredRotundaOffset.horizontalMagnitude, maximumPhysicalRotundaErrorMeters: maximumPhysicalRotundaError, inheritedFleetYOffset, staticFleetYOffset: fleet.position.y, maximumDisplacementMeters: maximumDisplacement, maximumYawChangeRadians: maximumYawChange, maximumWallErrorMeters: maximumWallError, connectorGateCount: rebuiltConnectors.staticGateCount, connectorBatchCount: rebuiltConnectors.batchCount });
}

export {
  AUTHORITY as STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  GROUND_AUTHORITY as STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  ROOT_OFFSET_AUTHORITY as STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
};
