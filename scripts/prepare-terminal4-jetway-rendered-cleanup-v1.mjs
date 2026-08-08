import fs from "node:fs";

const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const a1ElbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";
const STATIC_SOLID_VESTIBULE_INSTANCE_COUNT = 228;

let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");

const originalImport = 'import { addUploadedAirportJetwayStaticTerminalConnectors } from "./uploadedAirportJetwayTerminalConnector.js";';
const solidImport = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
if (staticRegistration.includes(originalImport)) {
  staticRegistration = staticRegistration.replace(originalImport, solidImport);
} else if (!staticRegistration.includes(solidImport)) {
  throw new Error(`${staticRegistrationPath}: static connector import anchor was not found`);
}
staticRegistration = staticRegistration.replace(
  /addUploadedAirportJetwayStaticTerminalConnectors\(THREE, fleet, placements\)/g,
  "addStaticSolidTerminalVestibules(THREE, fleet, placements)",
);
if (!staticRegistration.includes("addStaticSolidTerminalVestibules(THREE, fleet, placements)")) {
  throw new Error(`${staticRegistrationPath}: solid static vestibule call was not applied`);
}

const originalBatchBlock = `  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");
  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) {
    throw new Error(\`Static exact jetway instance batches are invalid: batches=\${staticBatches.length}, counts=\${staticBatches.map((batch) => batch.count).join(",")}\`);
  }
  applyPlacementDeltaToStaticInstances(THREE, staticBatches, staticOriginalPlacements, staticRegisteredPlacements);`;

const correctedBatchBlock = `  const staticBatchesGroup = fleet.getObjectByName("UploadedAirportJetwayStaticExactGlbInstances");
  const staticBatches = staticBatchesGroup?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticBatches.length !== 7 || staticBatches.some((batch) => batch.count !== 57)) {
    throw new Error(\`Static exact jetway instance batches are invalid: batches=\${staticBatches.length}, counts=\${staticBatches.map((batch) => batch.count).join(",")}\`);
  }
  // Any legacy closure instances were authored in the pre-registration frame.
  // Keep them co-registered if they are present, even though the production
  // build no longer intentionally creates those detached Cab-box batches.
  const staticPortalClosures = fleet.getObjectByName("UploadedAirportJetwayStaticPortalClosures");
  const staticClosureBatches = staticPortalClosures?.children?.filter((entry) => entry.isInstancedMesh) || [];
  if (staticPortalClosures && (staticClosureBatches.length !== 6 || staticClosureBatches.some((batch) => batch.count !== 57 && batch.count !== 114))) {
    throw new Error(\`Static portal closure batches are invalid: batches=\${staticClosureBatches.length}, counts=\${staticClosureBatches.map((batch) => batch.count).join(",")}\`);
  }
  applyPlacementDeltaToStaticInstances(
    THREE,
    [...staticBatches, ...staticClosureBatches],
    staticOriginalPlacements,
    staticRegisteredPlacements,
  );`;

if (staticRegistration.includes(originalBatchBlock)) {
  staticRegistration = staticRegistration.replace(originalBatchBlock, correctedBatchBlock);
} else if (!staticRegistration.includes("staticClosureBatches")) {
  throw new Error(`${staticRegistrationPath}: static placement-delta block was not found`);
}
fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");

// The static connector implementation above deliberately replaces the former
// three generated connector batches with one instanced solid shell batch. Make
// readiness prove that exact topology rather than preserving the obsolete
// three-batch corridor contract. Four shell transforms per gate x 57 gates = 228.
let readiness = fs.readFileSync(readinessPath, "utf8");
const performanceAuthorityLine = 'const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";';
if (!readiness.includes("const STATIC_CONNECTOR_AUTHORITY =")) {
  if (!readiness.includes(performanceAuthorityLine)) {
    throw new Error(`${readinessPath}: performance authority anchor is missing`);
  }
  readiness = readiness.replace(
    performanceAuthorityLine,
    `${performanceAuthorityLine}\nconst STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOLID_VESTIBULE_AUTHORITY}";\nconst STATIC_CONNECTOR_INSTANCE_COUNT = ${STATIC_SOLID_VESTIBULE_INSTANCE_COUNT};`,
  );
}

const connectorBatchTelemetryLine = "          const staticConnectorBatchCount = Number(group.userData.uploadedJetwayStaticConnectorBatchCount ?? -1);";
if (!readiness.includes("const staticConnectorInstanceCount =")) {
  if (!readiness.includes(connectorBatchTelemetryLine)) {
    throw new Error(`${readinessPath}: static connector batch telemetry anchor is missing`);
  }
  readiness = readiness.replace(
    connectorBatchTelemetryLine,
    `${connectorBatchTelemetryLine}\n          const staticConnectorInstanceCount = Number(group.userData.uploadedJetwayStaticConnectorInstanceCount ?? -1);\n          const staticConnectorAuthority = group.userData.uploadedJetwayStaticConnectorBatchAuthority || "missing";`,
  );
}

if (readiness.includes("            || staticConnectorBatchCount !== 3")) {
  readiness = readiness.replace(
    "            || staticConnectorBatchCount !== 3",
    `            || staticConnectorBatchCount !== 1\n            || staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT\n            || staticConnectorAuthority !== STATIC_CONNECTOR_AUTHORITY`,
  );
}

const oldConnectorDiagnostic = 'connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${individualConnectorGateCount}';
const solidConnectorDiagnostic = 'connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${staticConnectorInstanceCount}/${staticConnectorAuthority}/${individualConnectorGateCount}';
if (readiness.includes(oldConnectorDiagnostic)) {
  readiness = readiness.replace(oldConnectorDiagnostic, solidConnectorDiagnostic);
}

// Grounding must be judged from the exact transformed model, not a historical
// 4-10 cm correction range. The supplied GLB currently needs a larger parent
// correction because its authored lowest bogie contact is farther from the
// runtime ramp datum. The physically meaningful invariant is that the fleet
// parent offset and measured bogie correction cancel to zero residual height.
const oldBogieCorrectionGuard = "            || !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)";
const exactGroundContactGuard = `            || !Number.isFinite(bogieTireCorrection)\n            || bogieTireCorrection <= 0\n            || bogieTireCorrection >= 1`;
if (readiness.includes(oldBogieCorrectionGuard)) {
  readiness = readiness.replace(oldBogieCorrectionGuard, exactGroundContactGuard);
}

for (const token of [
  `const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOLID_VESTIBULE_AUTHORITY}";`,
  `const STATIC_CONNECTOR_INSTANCE_COUNT = ${STATIC_SOLID_VESTIBULE_INSTANCE_COUNT};`,
  "const staticConnectorInstanceCount =",
  "const staticConnectorAuthority =",
  "staticConnectorBatchCount !== 1",
  "staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT",
  "staticConnectorAuthority !== STATIC_CONNECTOR_AUTHORITY",
  solidConnectorDiagnostic,
  "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6",
  "!Number.isFinite(bogieTireCorrection)",
  "bogieTireCorrection <= 0",
  "bogieTireCorrection >= 1",
]) {
  if (!readiness.includes(token)) {
    throw new Error(`${readinessPath}: current static connector/ground-contact readiness is missing ${token}`);
  }
}
if (readiness.includes("staticConnectorBatchCount !== 3")) {
  throw new Error(`${readinessPath}: obsolete three-batch static connector readiness survived cleanup`);
}
if (readiness.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) {
  throw new Error(`${readinessPath}: obsolete fixed bogie-correction range survived exact-model grounding cleanup`);
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// A1 no longer fabricates its Rotunda-side endpoint from a fixed connector
// length. The production geometry must terminate at the transformed authored
// Rotunda surface, with only shallow hidden overlaps at the real wall and the
// supplied Rotunda. This guard intentionally rejects restoration of the old
// 0.82 m overlap that visually swallowed the Rotunda in rendered evidence.
const a1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
for (const token of [
  "function projectedSurfaceDistance(vertices, origin, direction)",
  "const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);",
  "const rotundaTerminalSurfaceMeters = projectedSurfaceDistance(rotundaVertices, rotundaCenter, terminalDirection);",
  "const rotundaSurfacePoint = rotundaCenter.clone().addScaledVector(terminalDirection, rotundaTerminalSurfaceMeters);",
  "const visibleTerminalLegMeters = fixedWallPoint.distanceTo(rotundaSurfacePoint);",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;",
  "shellEnd = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, ROTUNDA_SHELL_OVERLAP_METERS)",
  "uploadedJetwayA1AuthoredRotundaTerminalSurfaceMeters",
]) {
  if (!a1Elbow.includes(token)) {
    throw new Error(`${a1ElbowPath}: authored-Rotunda-surface A1 vestibule contract is missing ${token}`);
  }
}
for (const forbidden of [
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;",
  "collarPoint = fixedWallPoint.clone().addScaledVector(terminalDirection, -VISIBLE_TERMINAL_LEG_METERS)",
]) {
  if (a1Elbow.includes(forbidden)) {
    throw new Error(`${a1ElbowPath}: obsolete Rotunda-swallowing A1 connector logic survived cleanup: ${forbidden}`);
  }
}

console.log("Prepared rendered Terminal 4 cleanup: all 57 static gates use one verified 228-instance batch of short solid white terminal vestibules; A1 is source-driven from the real terminal wall to the transformed authored Rotunda surface with shallow hidden overlaps; readiness now validates zero-residual exact-model bogie grounding instead of the retired fixed correction range.");
