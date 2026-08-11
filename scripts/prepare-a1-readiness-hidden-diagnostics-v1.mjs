import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const a1Marker = "hiddenA1=${sourceLockedA1Authority}";
const staticMarker = "hiddenStatic=${staticFacadeRegistrationAuthority}";
let source = fs.readFileSync(readinessPath, "utf8");

for (const required of [
  "const sourceLockedA1Authority =",
  "const targetDirectionAuthority =",
  "const targetAlignmentCosine =",
  "const sourceDoorTargetDistance =",
  "const rotundaPreservationError =",
  "const sourceLockedA1CornerAngle =",
  "const sourceLockedA1VisibleLeg =",
  "const sourceLockedA1WallDistance =",
  "const sourceLockedA1Rotunda =",
  "const terminalSideIndependent =",
  "const passengerPassageBlocked =",
  "const apronFacingOpenAreaMeters =",
  "const cabTargetHorizontalError =",
  "const staticFacadeRegistrationAuthority =",
  "const staticFacadeRegisteredGateCount =",
  "const staticFacadeMaximumWallError =",
  "const staticPhysicalRotundaMaximumError =",
  "const staticModelRootOffsetAuthority =",
  "const staticAuthoredRotundaOffsetHorizontal =",
  "const staticGroundIsolationAuthority =",
  "const staticFleetGroundYOffset =",
  "const staticConnectorInstanceCount =",
  "const staticConnectorAuthority =",
  "Exact jetway readiness mismatch:",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final readiness diagnostic prerequisite is missing ${required}`);
  }
}

if (!source.includes(a1Marker)) {
  const sourceTail = 'source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`';
  if (!source.includes(sourceTail)) {
    throw new Error(`${readinessPath}: exact mismatch source telemetry tail is missing`);
  }
  const hiddenTelemetry = 'source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}, hiddenA1=${sourceLockedA1Authority}/${RENDERED_DOOR_A1_ELBOW_AUTHORITY}/${group.userData.uploadedJetwayA1TelescopingAuthority || "missing"}/${SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY}/${cabTargetHorizontalError}/${targetDirectionAuthority}/${RENDERED_DOOR_A1_TARGET_AUTHORITY}/${targetAlignmentCosine}/${sourceDoorTargetDistance}/${rotundaPreservationError}/${sourceLockedA1CornerAngle}/${sourceLockedA1VisibleLeg}/${sourceLockedA1WallDistance}/${sourceLockedA1Rotunda}/${terminalSideIndependent}/${passengerPassageBlocked}/${apronFacingOpenAreaMeters}`';
  source = source.replace(sourceTail, hiddenTelemetry);
}

if (!source.includes(staticMarker)) {
  const a1Tail = 'hiddenA1=${sourceLockedA1Authority}/${RENDERED_DOOR_A1_ELBOW_AUTHORITY}/${group.userData.uploadedJetwayA1TelescopingAuthority || "missing"}/${SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY}/${cabTargetHorizontalError}/${targetDirectionAuthority}/${RENDERED_DOOR_A1_TARGET_AUTHORITY}/${targetAlignmentCosine}/${sourceDoorTargetDistance}/${rotundaPreservationError}/${sourceLockedA1CornerAngle}/${sourceLockedA1VisibleLeg}/${sourceLockedA1WallDistance}/${sourceLockedA1Rotunda}/${terminalSideIndependent}/${passengerPassageBlocked}/${apronFacingOpenAreaMeters}`';
  if (!source.includes(a1Tail)) {
    throw new Error(`${readinessPath}: hidden A1 telemetry tail is missing before static/global diagnostics`);
  }
  const hiddenStaticTelemetry = 'hiddenA1=${sourceLockedA1Authority}/${RENDERED_DOOR_A1_ELBOW_AUTHORITY}/${group.userData.uploadedJetwayA1TelescopingAuthority || "missing"}/${SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY}/${cabTargetHorizontalError}/${targetDirectionAuthority}/${RENDERED_DOOR_A1_TARGET_AUTHORITY}/${targetAlignmentCosine}/${sourceDoorTargetDistance}/${rotundaPreservationError}/${sourceLockedA1CornerAngle}/${sourceLockedA1VisibleLeg}/${sourceLockedA1WallDistance}/${sourceLockedA1Rotunda}/${terminalSideIndependent}/${passengerPassageBlocked}/${apronFacingOpenAreaMeters}, hiddenStatic=${staticFacadeRegistrationAuthority}/${STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY}/${staticFacadeRegisteredGateCount}/${staticFacadeMaximumWallError}/${staticPhysicalRotundaMaximumError}/${staticModelRootOffsetAuthority}/${STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY}/${staticAuthoredRotundaOffsetHorizontal}/${staticGroundIsolationAuthority}/${STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY}/${staticFleetGroundYOffset}/${staticConnectorInstanceCount}/${STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT}/${staticConnectorAuthority}/${STATIC_CONNECTOR_AUTHORITY}/${staticPortalClosures.authority}/${STATIC_PORTAL_AUTHORITY}/${staticPortalClosures.gateCount}`';
  source = source.replace(a1Tail, hiddenStaticTelemetry);
}

for (const marker of [a1Marker, staticMarker]) {
  if (!source.includes(marker)) {
    throw new Error(`${readinessPath}: readiness diagnostics were not attached: ${marker}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Attached telemetry-only hidden A1 plus static/global readiness diagnostics to the exact mismatch error; no readiness condition or geometry was changed.");
