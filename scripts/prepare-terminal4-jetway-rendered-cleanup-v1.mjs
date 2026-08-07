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

for (const token of [
  `const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOLID_VESTIBULE_AUTHORITY}";`,
  `const STATIC_CONNECTOR_INSTANCE_COUNT = ${STATIC_SOLID_VESTIBULE_INSTANCE_COUNT};`,
  "const staticConnectorInstanceCount =",
  "const staticConnectorAuthority =",
  "staticConnectorBatchCount !== 1",
  "staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT",
  "staticConnectorAuthority !== STATIC_CONNECTOR_AUTHORITY",
  solidConnectorDiagnostic,
]) {
  if (!readiness.includes(token)) {
    throw new Error(`${readinessPath}: solid static connector readiness is missing ${token}`);
  }
}
if (readiness.includes("staticConnectorBatchCount !== 3")) {
  throw new Error(`${readinessPath}: obsolete three-batch static connector readiness survived cleanup`);
}
fs.writeFileSync(readinessPath, readiness, "utf8");

let a1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
// Keep the wall penetration shallow so the 2.4 m visible terminal leg stays
// photo-registered, but let the same white shell continue well inside the
// Rotunda recess. The earlier 0.12 m Rotunda overlap exposed the dark bellows
// and read visually as a large hole/broken bridge in the close evidence view.
a1Elbow = a1Elbow.replace(
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.75;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
);
a1Elbow = a1Elbow.replace(
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;",
);
if (!a1Elbow.includes("const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")) {
  throw new Error(`${a1ElbowPath}: compact terminal hidden-overlap correction was not applied`);
}
if (!a1Elbow.includes("const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;")) {
  throw new Error(`${a1ElbowPath}: closed Rotunda shell overlap was not preserved`);
}
fs.writeFileSync(a1ElbowPath, a1Elbow, "utf8");

console.log("Prepared rendered Terminal 4 cleanup: all 57 static gates use one verified 228-instance batch of short solid white 2.4 m terminal vestibules; A1 keeps a shallow hidden wall overlap but restores the deeper hidden Rotunda shell overlap so the exterior remains visually continuous without lengthening the visible terminal leg.");
