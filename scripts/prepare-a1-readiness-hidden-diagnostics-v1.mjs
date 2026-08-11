import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const marker = "hiddenA1=${sourceLockedA1Authority}";
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
  "Exact jetway readiness mismatch:",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final A1 readiness diagnostic prerequisite is missing ${required}`);
  }
}

if (!source.includes(marker)) {
  const sourceTail = 'source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`';
  if (!source.includes(sourceTail)) {
    throw new Error(`${readinessPath}: exact mismatch source telemetry tail is missing`);
  }
  const hiddenTelemetry = 'source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}, hiddenA1=${sourceLockedA1Authority}/${RENDERED_DOOR_A1_ELBOW_AUTHORITY}/${group.userData.uploadedJetwayA1TelescopingAuthority || "missing"}/${SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY}/${cabTargetHorizontalError}/${targetDirectionAuthority}/${RENDERED_DOOR_A1_TARGET_AUTHORITY}/${targetAlignmentCosine}/${sourceDoorTargetDistance}/${rotundaPreservationError}/${sourceLockedA1CornerAngle}/${sourceLockedA1VisibleLeg}/${sourceLockedA1WallDistance}/${sourceLockedA1Rotunda}/${terminalSideIndependent}/${passengerPassageBlocked}/${apronFacingOpenAreaMeters}`';
  source = source.replace(sourceTail, hiddenTelemetry);
}

if (!source.includes(marker)) {
  throw new Error(`${readinessPath}: hidden A1 readiness diagnostics were not attached`);
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Attached telemetry-only hidden A1 readiness diagnostics to the exact mismatch error; no readiness condition or geometry was changed.");
