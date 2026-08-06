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

const legacyEvidence = `      group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
      group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;
      group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;
      group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = 0;`;
const completeEvidence = `      group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
      group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;
      group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;
      group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount;
      group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount;
      group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount;
      group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters;
      group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters;`;

if (source.includes(legacyEvidence)) {
  source = source.replace(legacyEvidence, completeEvidence);
} else if (!source.includes("uploadedJetwayStaticCabClosureSurroundPieceCount")) {
  const evidenceAnchor = "      group.userData.uploadedJetwayStaticConnectorBatchAuthority = staticConnectors.authority;";
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${fleetPath}: static connector evidence anchor is missing`);
  }
  source = source.replace(evidenceAnchor, `${evidenceAnchor}\n${completeEvidence}`);
}

for (const token of [
  importBlock,
  "const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements)",
  "group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority",
  "group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority",
  "group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount",
  "group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount",
  "group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount",
  "group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters",
  "group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters",
  "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
]) {
  if (!source.includes(token)) {
    throw new Error(`${fleetPath}: static portal closure preparation is missing ${token}`);
  }
}

fs.writeFileSync(fleetPath, source, "utf8");
await import(`./prepare-static-jetway-closure-evidence-v1.mjs?static-closure=${Date.now()}`);
console.log("Installed and published exact opaque aircraft-facing closure panels on all 57 parked Terminal 4 jetways without changing any supplied GLB node transform.");
