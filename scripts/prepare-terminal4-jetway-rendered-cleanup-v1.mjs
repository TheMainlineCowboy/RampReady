import fs from "node:fs";

const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const a1ElbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";

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

let a1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
a1Elbow = a1Elbow.replace(
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.75;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
);
a1Elbow = a1Elbow.replace(
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;",
);
if (!a1Elbow.includes("const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")) {
  throw new Error(`${a1ElbowPath}: compact terminal hidden-overlap correction was not applied`);
}
if (!a1Elbow.includes("const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;")) {
  throw new Error(`${a1ElbowPath}: compact Rotunda overlap correction was not applied`);
}
fs.writeFileSync(a1ElbowPath, a1Elbow, "utf8");

console.log("Prepared rendered Terminal 4 cleanup: all 57 static gates use short solid white 2.4 m terminal vestibules that stop at the authored Rotunda instead of generated long glass corridors, legacy closure instances remain co-registered if present, and A1 keeps only minimal hidden wall/Rotunda shell overlap.");
