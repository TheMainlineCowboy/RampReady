import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let source = fs.readFileSync(fleetPath, "utf8");

const importBlock = `import {
  installStaticJetwayPortalClosures,
  STATIC_JETWAY_CAB_CLOSURE_AUTHORITY,
} from "./staticJetwayPortalClosures.js";`;

if (!source.includes("installStaticJetwayPortalClosures")) {
  const importAnchor = `import {
  createModelSpaceA1Controller,
  A1_MODEL_SPACE_RETRACTION_MODE_V7,
} from "./uploadedAirportJetwayModelSpaceControllerV7.js";`;
  if (!source.includes(importAnchor)) {
    throw new Error(`${fleetPath}: model-space controller import anchor is missing`);
  }
  source = source.replace(importAnchor, `${importAnchor}\n${importBlock}`);
}

if (!source.includes("const staticPortalClosures = installStaticJetwayPortalClosures")) {
  const connectorAnchor = "      const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);";
  if (!source.includes(connectorAnchor)) {
    throw new Error(`${fleetPath}: static connector installation anchor is missing`);
  }
  source = source.replace(
    connectorAnchor,
    `${connectorAnchor}\n      const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements);`,
  );
}

if (!source.includes("uploadedJetwayStaticCabClosureAuthority")) {
  const evidenceAnchor = "      group.userData.uploadedJetwayStaticConnectorBatchAuthority = staticConnectors.authority;";
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${fleetPath}: static connector evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}\n      group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;\n      group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;\n      group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;\n      group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = 0;`,
  );
}

for (const token of [
  importBlock,
  "const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements)",
  "group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority",
  "group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority",
  "group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = 0",
  "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
]) {
  if (!source.includes(token)) {
    throw new Error(`${fleetPath}: static portal closure preparation is missing ${token}`);
  }
}

fs.writeFileSync(fleetPath, source, "utf8");
console.log("Installed opaque aircraft-facing closure panels on all 57 parked Terminal 4 jetways without changing any supplied GLB node transform.");
