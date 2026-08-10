import fs from "node:fs";

const path = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const AUTHORITY = "57-static-real-wall-own-gate-post-registration-inward-length-v1";
const MINIMUM_EXTENSION_METERS = -14.5;
const MAXIMUM_EXTENSION_METERS = 0;
const PART_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});

let source = fs.readFileSync(path, "utf8");

const helperAnchor = "\nexport function registerStaticJetwayFleetToFacade(THREE, group, fleet, placements) {";
const helper = `
const STATIC_POST_REGISTRATION_LENGTH_AUTHORITY = "${AUTHORITY}";
const STATIC_POST_REGISTRATION_MINIMUM_EXTENSION_METERS = ${MINIMUM_EXTENSION_METERS};
const STATIC_POST_REGISTRATION_MAXIMUM_EXTENSION_METERS = ${MAXIMUM_EXTENSION_METERS};
const STATIC_POST_REGISTRATION_PART_WEIGHTS = Object.freeze({
  Rotunda: 0,
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});

function clampStaticPostRegistrationExtension(value) {
  return Math.max(
    STATIC_POST_REGISTRATION_MINIMUM_EXTENSION_METERS,
    Math.min(STATIC_POST_REGISTRATION_MAXIMUM_EXTENSION_METERS, value),
  );
}

function applyPostRegistrationLengthToStaticInstances(
  THREE,
  staticBatches,
  originalPlacements,
  registeredPlacements,
  sourceContactDistance,
) {
  if (!(Number.isFinite(sourceContactDistance) && sourceContactDistance > 20 && sourceContactDistance < 32)) {
    throw new Error(\`Static post-registration length pass has invalid supplied source reach: \${sourceContactDistance}\`);
  }
  if (!Array.isArray(staticBatches) || staticBatches.length !== 7) {
    throw new Error(\`Static post-registration length pass expected seven exact primitive batches, received \${staticBatches?.length ?? 0}\`);
  }

  const placementMatrix = new THREE.Matrix4();
  const inversePlacement = new THREE.Matrix4();
  const correctionMatrix = new THREE.Matrix4();
  const current = new THREE.Matrix4();
  const localCurrent = new THREE.Matrix4();
  const correctedLocal = new THREE.Matrix4();
  const next = new THREE.Matrix4();
  const euler = new THREE.Euler();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (let index = 0; index < registeredPlacements.length; index += 1) {
    const before = originalPlacements[index];
    const after = registeredPlacements[index];
    const clearance = Math.max(0, Number(before.aircraftContactClearanceMeters) || 0);
    const originalTargetDistance = Number(before.bridgeEnd) + clearance;
    const registeredTargetDistance = Number(after.aircraftDoorDistance);
    if (![originalTargetDistance, registeredTargetDistance].every(Number.isFinite)) {
      throw new Error(\`Static jetway \${after.gate} is missing pre/post registration target distance evidence\`);
    }

    const existingExtension = clampStaticPostRegistrationExtension(originalTargetDistance - sourceContactDistance);
    const desiredExtension = clampStaticPostRegistrationExtension(registeredTargetDistance - sourceContactDistance);
    const correction = desiredExtension - existingExtension;
    const predictedContactDistance = sourceContactDistance + desiredExtension;
    const outwardReachShortfallMeters = Math.max(0, registeredTargetDistance - sourceContactDistance);
    const targetErrorMeters = Math.abs(predictedContactDistance - registeredTargetDistance);

    after.staticPreRegistrationTargetDistanceMeters = originalTargetDistance;
    after.staticRegisteredOwnGateTargetDistanceMeters = registeredTargetDistance;
    after.staticPreRegistrationExtensionMeters = existingExtension;
    after.staticPostRegistrationExtensionMeters = desiredExtension;
    after.staticPostRegistrationLengthCorrectionMeters = correction;
    after.staticPostRegistrationPredictedContactDistanceMeters = predictedContactDistance;
    after.staticPostRegistrationOutwardReachShortfallMeters = outwardReachShortfallMeters;
    after.staticPostRegistrationTargetErrorMeters = targetErrorMeters;
    after.staticPostRegistrationLengthAuthority = STATIC_POST_REGISTRATION_LENGTH_AUTHORITY;

    euler.set(0, Number(after.yaw), 0);
    quaternion.setFromEuler(euler);
    position.set(Number(after.staticModelRootX), 0, Number(after.staticModelRootZ));
    placementMatrix.compose(position, quaternion, scale);
    inversePlacement.copy(placementMatrix).invert();

    for (const batch of staticBatches) {
      const sourcePartName = batch.userData?.sourcePartName;
      const weight = STATIC_POST_REGISTRATION_PART_WEIGHTS[sourcePartName];
      if (!Number.isFinite(weight)) {
        throw new Error(\`Static exact primitive batch \${batch.name} lost authored source-part identity\`);
      }
      batch.getMatrixAt(index, current);
      localCurrent.multiplyMatrices(inversePlacement, current);
      correctionMatrix.makeTranslation(0, 0, correction * weight);
      correctedLocal.multiplyMatrices(correctionMatrix, localCurrent);
      next.multiplyMatrices(placementMatrix, correctedLocal);
      batch.setMatrixAt(index, next);
    }
  }

  for (const batch of staticBatches) {
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
  }
}

export function registerStaticJetwayFleetToFacade(THREE, group, fleet, placements) {`;
if (!source.includes("STATIC_POST_REGISTRATION_LENGTH_AUTHORITY")) {
  if (!source.includes(helperAnchor)) throw new Error(`${path}: post-registration length helper anchor is missing`);
  source = source.replace(helperAnchor, `\n${helper}`);
}

const oldCall = "  applyPlacementDeltaToStaticInstances(THREE, [...staticBatches, ...staticClosureBatches], staticOriginalPlacements, staticRegisteredPlacements);";
const newCall = `${oldCall}
  const staticSourceContactDistance = Number(group.userData.uploadedJetwaySourceContactDistanceMeters);
  applyPostRegistrationLengthToStaticInstances(
    THREE,
    staticBatches,
    staticOriginalPlacements,
    staticRegisteredPlacements,
    staticSourceContactDistance,
  );`;
if (!source.includes("applyPostRegistrationLengthToStaticInstances(\n    THREE,")) {
  if (!source.includes(oldCall)) throw new Error(`${path}: static placement-delta call anchor is missing`);
  source = source.replace(oldCall, newCall);
}

const markerAnchor = "    marker.userData.staticTerminalWallOverlapMeters = registered.staticTerminalWallOverlapMeters;";
const markerPatch = `${markerAnchor}
    marker.userData.staticPostRegistrationLengthAuthority = registered.staticPostRegistrationLengthAuthority;
    marker.userData.staticRegisteredOwnGateTargetDistanceMeters = registered.staticRegisteredOwnGateTargetDistanceMeters;
    marker.userData.staticPostRegistrationExtensionMeters = registered.staticPostRegistrationExtensionMeters;
    marker.userData.staticPostRegistrationOutwardReachShortfallMeters = registered.staticPostRegistrationOutwardReachShortfallMeters;
    marker.userData.staticPostRegistrationTargetErrorMeters = registered.staticPostRegistrationTargetErrorMeters;`;
if (!source.includes("marker.userData.staticPostRegistrationLengthAuthority")) {
  if (!source.includes(markerAnchor)) throw new Error(`${path}: static marker post-registration length anchor is missing`);
  source = source.replace(markerAnchor, markerPatch);
}

const aggregateAnchor = "  const maximumTerminalWallOverlap = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticTerminalWallOverlapMeters));";
const aggregatePatch = `${aggregateAnchor}
  const retractedPostRegistrationGateCount = staticRegisteredPlacements.filter((placement) => Number(placement.staticPostRegistrationExtensionMeters) < -0.001).length;
  const fullReachPostRegistrationGateCount = staticRegisteredPlacements.length - retractedPostRegistrationGateCount;
  const maximumPostRegistrationRetractionMeters = Math.max(...staticRegisteredPlacements.map((placement) => Math.max(0, -Number(placement.staticPostRegistrationExtensionMeters))));
  const maximumPostRegistrationOutwardReachShortfallMeters = Math.max(...staticRegisteredPlacements.map((placement) => Number(placement.staticPostRegistrationOutwardReachShortfallMeters)));
  const maximumPostRegistrationTargetErrorMeters = Math.max(...staticRegisteredPlacements.map((placement) => Number(placement.staticPostRegistrationTargetErrorMeters)));
  const minimumRegisteredOwnGateTargetDistanceMeters = Math.min(...staticRegisteredPlacements.map((placement) => Number(placement.staticRegisteredOwnGateTargetDistanceMeters)));
  const maximumRegisteredOwnGateTargetDistanceMeters = Math.max(...staticRegisteredPlacements.map((placement) => Number(placement.staticRegisteredOwnGateTargetDistanceMeters)));`;
if (!source.includes("retractedPostRegistrationGateCount")) {
  if (!source.includes(aggregateAnchor)) throw new Error(`${path}: post-registration aggregate anchor is missing`);
  source = source.replace(aggregateAnchor, aggregatePatch);
}

const telemetryAnchor = "  group.userData.uploadedJetwayStaticMaximumMeasuredWallDistanceMeters = maximumSourceWallDistance;";
const telemetryPatch = `${telemetryAnchor}
  group.userData.uploadedJetwayStaticPostRegistrationLengthAuthority = STATIC_POST_REGISTRATION_LENGTH_AUTHORITY;
  group.userData.uploadedJetwayStaticPostRegistrationLengthGateCount = 57;
  group.userData.uploadedJetwayStaticPostRegistrationRetractedGateCount = retractedPostRegistrationGateCount;
  group.userData.uploadedJetwayStaticPostRegistrationFullReachGateCount = fullReachPostRegistrationGateCount;
  group.userData.uploadedJetwayStaticPostRegistrationMaximumRetractionMeters = maximumPostRegistrationRetractionMeters;
  group.userData.uploadedJetwayStaticPostRegistrationMaximumOutwardReachShortfallMeters = maximumPostRegistrationOutwardReachShortfallMeters;
  group.userData.uploadedJetwayStaticPostRegistrationMaximumTargetErrorMeters = maximumPostRegistrationTargetErrorMeters;
  group.userData.uploadedJetwayStaticMinimumRegisteredOwnGateTargetDistanceMeters = minimumRegisteredOwnGateTargetDistanceMeters;
  group.userData.uploadedJetwayStaticMaximumRegisteredOwnGateTargetDistanceMeters = maximumRegisteredOwnGateTargetDistanceMeters;`;
if (!source.includes("uploadedJetwayStaticPostRegistrationLengthAuthority")) {
  if (!source.includes(telemetryAnchor)) throw new Error(`${path}: post-registration browser telemetry anchor is missing`);
  source = source.replace(telemetryAnchor, telemetryPatch);
}

const logAnchor = "    maximumYawChangeRadians: maximumYawChange,";
const logPatch = `${logAnchor}
    postRegistrationLengthAuthority: STATIC_POST_REGISTRATION_LENGTH_AUTHORITY,
    retractedPostRegistrationGateCount,
    fullReachPostRegistrationGateCount,
    maximumPostRegistrationRetractionMeters,
    maximumPostRegistrationOutwardReachShortfallMeters,
    minimumRegisteredOwnGateTargetDistanceMeters,
    maximumRegisteredOwnGateTargetDistanceMeters,`;
if (!source.includes("postRegistrationLengthAuthority: STATIC_POST_REGISTRATION_LENGTH_AUTHORITY")) {
  if (!source.includes(logAnchor)) throw new Error(`${path}: post-registration length log anchor is missing`);
  source = source.replace(logAnchor, logPatch);
}

for (const token of [
  `STATIC_POST_REGISTRATION_LENGTH_AUTHORITY = "${AUTHORITY}"`,
  "batch.userData?.sourcePartName",
  "registeredTargetDistance - sourceContactDistance",
  "staticPostRegistrationExtensionMeters",
  "applyPostRegistrationLengthToStaticInstances(",
  "uploadedJetwayStaticPostRegistrationLengthGateCount = 57",
  "uploadedJetwayStaticPostRegistrationRetractedGateCount",
  "uploadedJetwayStaticPostRegistrationMaximumOutwardReachShortfallMeters",
]) {
  if (!source.includes(token)) throw new Error(`${path}: post-registration static length contract is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Applied static exact-GLB length only after real-wall Rotunda registration (${AUTHORITY}): each of 57 gates now uses its registered Rotunda-to-own-gate distance, telescopes Tunnel B/C/Cab inward only, and never stretches the supplied hierarchy outward.`);
