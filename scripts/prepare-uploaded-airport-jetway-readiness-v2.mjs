import fs from "node:fs";

const CONNECTED_A1_ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-source-connected-attached-v12-a1-retracts-inward-only";
const RETIRED_STRETCHED_A1_ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetwaySource = fs.readFileSync(jetwayPath, "utf8");
const oldImport = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleet.js";';
const readyImport = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js";';
const importAnchor = 'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";';
jetwaySource = jetwaySource
  .split("\n")
  .filter((line) => line !== oldImport && line !== readyImport)
  .join("\n");
if (!jetwaySource.includes(importAnchor)) {
  throw new Error(`${jetwayPath}: uploaded jetway readiness import anchor is missing`);
}
jetwaySource = jetwaySource.replace(importAnchor, `${importAnchor}\n${readyImport}`);
if ((jetwaySource.match(/uploadedAirportJetwayFleetReadyV2\.js/g) || []).length !== 1) {
  throw new Error(`${jetwayPath}: uploaded jetway readiness import is not unique`);
}
fs.writeFileSync(jetwayPath, jetwaySource, "utf8");

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let readinessSource = fs.readFileSync(readinessPath, "utf8");
const baseFleetImport = 'import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";';
const legacyStaticRegistrationImport = 'import { registerStaticJetwayFleetToFacade } from "./registerStaticJetwayFleetToFacadeV1.js";';
const staticRegistrationImport = `import {
  registerStaticJetwayFleetToFacade,
  STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
} from "./registerStaticJetwayFleetToFacadeV1.js";`;
if (readinessSource.includes(legacyStaticRegistrationImport)) {
  readinessSource = readinessSource.replace(legacyStaticRegistrationImport, staticRegistrationImport);
}
if (!readinessSource.includes(staticRegistrationImport)) {
  if (!readinessSource.includes(baseFleetImport)) {
    throw new Error(`${readinessPath}: base fleet import anchor is missing`);
  }
  readinessSource = readinessSource.replace(baseFleetImport, `${baseFleetImport}\n${staticRegistrationImport}`);
}
const installationCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const registrationCall = "          const staticFleetRegistration = registerStaticJetwayFleetToFacade(THREE, group, fleet, placements);";
if (!readinessSource.includes(registrationCall)) {
  if (!readinessSource.includes(installationCall)) {
    throw new Error(`${readinessPath}: installation-correction anchor is missing`);
  }
  readinessSource = readinessSource.replace(installationCall, `${installationCall}\n${registrationCall}`);
}

// The attached A1 hierarchy must remain exactly at the supplied GLB spacing.
// The retired gate-fitting path required +3..7 m of attached extension, which
// pulled the sibling Tunnel B/C/Cab roots apart in thirds. Readiness now fails
// unless the attached extension is effectively zero; the aircraft conforms to
// the connected Cab endpoint later in the airport-owned pose stage.
const stretchedExtensionGuard = "            || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)";
const connectedExtensionGuard = "            || Math.abs(a1AttachedExtension) > 0.001";
if (readinessSource.includes(stretchedExtensionGuard)) {
  readinessSource = readinessSource.replace(stretchedExtensionGuard, connectedExtensionGuard);
} else if (!readinessSource.includes(connectedExtensionGuard)) {
  throw new Error(`${readinessPath}: A1 attached-extension readiness guard is missing`);
}

for (const token of [
  staticRegistrationImport,
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  registrationCall,
  connectedExtensionGuard,
]) {
  if (!readinessSource.includes(token)) {
    throw new Error(`${readinessPath}: static wall/Rotunda registration or connected A1 guard is missing ${token}`);
  }
}
if (readinessSource.includes(stretchedExtensionGuard)) {
  throw new Error(`${readinessPath}: retired stretched-A1 readiness guard remains`);
}
fs.writeFileSync(readinessPath, readinessSource, "utf8");

const terminalPath = "src/environment/authoredTerminal4Visual.js";
let terminalSource = fs.readFileSync(terminalPath, "utf8");
const buildAnchor = `  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);
  environment.add(authored, sourcePlacedJetways);`;
const awaitedBuild = `  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);
  if (!sourcePlacedJetways.userData.uploadedJetwayReady) {
    throw new Error("Terminal 4 uploaded jetway fleet did not expose a readiness promise");
  }
  await sourcePlacedJetways.userData.uploadedJetwayReady;
  if (
    sourcePlacedJetways.userData.uploadedJetwayLoadState !== "ready"
    || Number(sourcePlacedJetways.userData.uploadedJetwayCount) !== 58
    || Number(sourcePlacedJetways.userData.uploadedJetwayMeasuredTerminalConnectorCount) !== 58
    || Number(sourcePlacedJetways.userData.uploadedJetwayVerifiedModelCount) !== 58
    || sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "${CONNECTED_A1_ARTICULATION_AUTHORITY}"
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount) !== 57
    || Math.abs(Number(sourcePlacedJetways.userData.uploadedJetwayA1AttachedExtensionMeters)) > 0.001
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid !== true
  ) {
    throw new Error("Terminal 4 uploaded jetway fleet did not complete all 58 source placements with connected A1 source spacing");
  }
  environment.add(authored, sourcePlacedJetways);`;
if (!terminalSource.includes("await sourcePlacedJetways.userData.uploadedJetwayReady")) {
  if (!terminalSource.includes(buildAnchor)) throw new Error(`${terminalPath}: source-placed jetway build anchor is missing`);
  terminalSource = terminalSource.replace(buildAnchor, awaitedBuild);
} else {
  terminalSource = terminalSource
    .replaceAll(RETIRED_STRETCHED_A1_ARTICULATION_AUTHORITY, CONNECTED_A1_ARTICULATION_AUTHORITY)
    .replaceAll(
      'sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "user-supplied-airport-jetway-per-gate-telescoping-v10"',
      `sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "${CONNECTED_A1_ARTICULATION_AUTHORITY}"`,
    );
  const readyGapAnchor = "    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05";
  const attachedGuard = "    || Math.abs(Number(sourcePlacedJetways.userData.uploadedJetwayA1AttachedExtensionMeters)) > 0.001";
  if (!terminalSource.includes(attachedGuard)) {
    if (!terminalSource.includes(readyGapAnchor)) throw new Error(`${terminalPath}: A1 readiness gap anchor is missing`);
    terminalSource = terminalSource.replace(readyGapAnchor, `${attachedGuard}\n${readyGapAnchor}`);
  }
}

const evidenceAnchor = "  environment.userData.authoredTerminal4JetwaySourceGeometryMode = sourcePlacedJetways.userData.sourceGeometryMode;";
const evidenceBlock = `${evidenceAnchor}
  environment.userData.authoredTerminal4UploadedJetwayLoadState = sourcePlacedJetways.userData.uploadedJetwayLoadState;
  environment.userData.authoredTerminal4UploadedJetwayCount = sourcePlacedJetways.userData.uploadedJetwayCount;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = sourcePlacedJetways.userData.uploadedJetwayMeasuredTerminalConnectorCount;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = sourcePlacedJetways.userData.uploadedJetwayVerifiedModelCount;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = sourcePlacedJetways.userData.uploadedJetwayReadyAuthority;
  environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority = sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority;
  environment.userData.authoredTerminal4UploadedJetwaySourceContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwaySourceContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount = sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumContactErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1TargetDoorDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters = sourcePlacedJetways.userData.uploadedJetwayA1AttachedExtensionMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1PredictedContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid = sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid;\n  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
if (!terminalSource.includes("authoredTerminal4UploadedJetwayLoadState")) {
  if (!terminalSource.includes(evidenceAnchor)) throw new Error(`${terminalPath}: jetway geometry evidence anchor is missing`);
  terminalSource = terminalSource.replace(evidenceAnchor, evidenceBlock);
}

for (const token of [
  "await sourcePlacedJetways.userData.uploadedJetwayReady",
  'uploadedJetwayLoadState !== "ready"',
  "uploadedJetwayVerifiedModelCount) !== 58",
  CONNECTED_A1_ARTICULATION_AUTHORITY,
  "authoredTerminal4UploadedJetwayLoadState",
  "authoredTerminal4UploadedJetwayCount",
  "authoredTerminal4UploadedJetwayConnectorCount",
  "authoredTerminal4UploadedJetwayVerifiedModelCount",
  "authoredTerminal4UploadedJetwayReadyAuthority",
  "authoredTerminal4UploadedJetwayArticulationAuthority",
  "authoredTerminal4UploadedJetwayA1AttachedExtensionMeters",
  "authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters",
  "authoredTerminal4UploadedJetwayA1ActualDoorGapMeters",
  "authoredTerminal4UploadedJetwayA1PartOrderValid",
]) {
  if (!terminalSource.includes(token)) throw new Error(`${terminalPath}: uploaded jetway readiness wiring is missing ${token}`);
}
if (terminalSource.includes(RETIRED_STRETCHED_A1_ARTICULATION_AUTHORITY)) {
  throw new Error(`${terminalPath}: retired stretched A1 articulation authority remains`);
}
fs.writeFileSync(terminalPath, terminalSource, "utf8");

console.log("Prepared awaited uploaded-airport jetway readiness: A1 attached state preserves the exact connected supplied GLB hierarchy and may only telescope inward during retraction; all 57 static exact-GLB gates remain source-registered before readiness.");
