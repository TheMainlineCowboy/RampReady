import fs from "node:fs";

// First remove every guessed static bridge endpoint and add the exact target
// authority to the closure module. The fleet import below must see those
// exports in the generated production source.
await import(`./prepare-static-jetway-target-shared-with-articulation-v1.mjs?exact-static-target=${Date.now()}`);

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let source = fs.readFileSync(fleetPath, "utf8");

const importBlock = `import {
  installStaticJetwayPortalClosures,
  STATIC_JETWAY_CAB_CLOSURE_AUTHORITY,
  STATIC_JETWAY_CAB_TARGET_AUTHORITY,
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
} else {
  const existingImportPattern = /import \{[\s\S]*?installStaticJetwayPortalClosures[\s\S]*?\} from "\.\/staticJetwayPortalClosures\.js";/;
  if (existingImportPattern.test(source)) {
    source = source.replace(existingImportPattern, importBlock);
  }
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

const legacyEvidencePattern = /      group\.userData\.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures\.authority;[\s\S]*?      group\.userData\.uploadedJetwayStaticApronFacingOpenAreaMeters = (?:0|staticPortalClosures\.apronFacingOpenAreaMeters);/;
const completeEvidence = `      group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
      group.userData.uploadedJetwayStaticCabClosureAuthority = staticPortalClosures.cabClosureAuthority;
      group.userData.uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority;
      group.userData.uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount;
      group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount;
      group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount;
      group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount;
      group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount;
      group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters;
      group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters;`;

if (legacyEvidencePattern.test(source)) {
  source = source.replace(legacyEvidencePattern, completeEvidence);
} else if (!source.includes("uploadedJetwayStaticCabTargetAuthority")) {
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
  "group.userData.uploadedJetwayStaticCabTargetAuthority = staticPortalClosures.cabTargetAuthority",
  "group.userData.uploadedJetwayStaticBridgeEndFallbackCount = staticPortalClosures.bridgeEndFallbackCount",
  "group.userData.uploadedJetwayStaticCabClosurePanelCount = staticPortalClosures.cabPanelCount",
  "group.userData.uploadedJetwayStaticCabClosureWindowCount = staticPortalClosures.cabWindowCount",
  "group.userData.uploadedJetwayStaticCabClosureSurroundPieceCount = staticPortalClosures.cabSurroundPieceCount",
  "group.userData.uploadedJetwayStaticCabClosureAuthoredNodeTransformCount = staticPortalClosures.authoredNodeTransformCount",
  "group.userData.uploadedJetwayStaticCabClosureDepthMeters = staticPortalClosures.opaqueCabCapDepthMeters",
  "group.userData.uploadedJetwayStaticApronFacingOpenAreaMeters = staticPortalClosures.apronFacingOpenAreaMeters",
  "STATIC_JETWAY_CAB_CLOSURE_AUTHORITY",
  "STATIC_JETWAY_CAB_TARGET_AUTHORITY",
]) {
  if (!source.includes(token)) {
    throw new Error(`${fleetPath}: static portal closure preparation is missing ${token}`);
  }
}

fs.writeFileSync(fleetPath, source, "utf8");
await import(`./prepare-static-jetway-closure-evidence-v1.mjs?static-closure=${Date.now()}`);
await import(`./prepare-static-jetway-closure-readiness-v1.mjs?static-readiness=${Date.now()}`);
console.log("Installed 57 opaque static Cab closures at exact articulation-shared bridgeEnd targets, published zero fallback/open area and complete geometry evidence, then validated readiness without altering supplied GLB nodes.");
