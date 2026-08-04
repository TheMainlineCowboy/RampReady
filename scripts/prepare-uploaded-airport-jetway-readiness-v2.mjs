import fs from "node:fs";

const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-full-3d-door-plane-v14";
const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetwaySource = fs.readFileSync(jetwayPath, "utf8");
const oldImport = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleet.js";';
const readyImport = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js";';
const importAnchor = 'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";';
jetwaySource = jetwaySource
  .split("\n")
  .filter((line) => line !== oldImport && line !== readyImport)
  .join("\n");
if (!jetwaySource.includes(importAnchor)) throw new Error(`${jetwayPath}: uploaded jetway readiness import anchor is missing`);
jetwaySource = jetwaySource.replace(importAnchor, `${importAnchor}\n${readyImport}`);
if ((jetwaySource.match(/uploadedAirportJetwayFleetReadyV2\.js/g) || []).length !== 1) {
  throw new Error(`${jetwayPath}: uploaded jetway readiness import is not unique`);
}
fs.writeFileSync(jetwayPath, jetwaySource, "utf8");

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
    || sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "${ARTICULATION_AUTHORITY}"
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount) !== 57
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumContactErrorMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees) > 2
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayStaticPartOrderValid !== true
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabNormalErrorDegrees) > 2
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid !== true
  ) {
    throw new Error("Terminal 4 exact supplied jetway fleet did not complete authored CRJ700 forward-door full-3D verification");
  }
  environment.add(authored, sourcePlacedJetways);`;
if (!terminalSource.includes("await sourcePlacedJetways.userData.uploadedJetwayReady")) {
  if (!terminalSource.includes(buildAnchor)) throw new Error(`${terminalPath}: source-placed jetway build anchor is missing`);
  terminalSource = terminalSource.replace(buildAnchor, awaitedBuild);
} else {
  terminalSource = terminalSource
    .replace(
      'sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "user-supplied-airport-jetway-per-gate-telescoping-v10"',
      `sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "${ARTICULATION_AUTHORITY}"`,
    )
    .replace(
      'sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "user-supplied-airport-jetway-full-3d-door-plane-v11"',
      `sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "${ARTICULATION_AUTHORITY}"`,
    );
  const oldChecks = `    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount) !== 57
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid !== true`;
  const newChecks = `    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount) !== 57
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumContactErrorMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees) > 2
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayStaticPartOrderValid !== true
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabNormalErrorDegrees) > 2
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid !== true`;
  if (terminalSource.includes(oldChecks)) terminalSource = terminalSource.replace(oldChecks, newChecks);
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
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMinimumStairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumStairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMinimumBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticPartOrderValid = sourcePlacedJetways.userData.uploadedJetwayStaticPartOrderValid;
  environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1TargetDoorDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters = sourcePlacedJetways.userData.uploadedJetwayA1AttachedExtensionMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees = sourcePlacedJetways.userData.uploadedJetwayA1CabNormalErrorDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1StairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1StairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1BogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1BogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1AnchorYawDegrees = sourcePlacedJetways.userData.uploadedJetwayA1AnchorYawDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1CabYawOffsetDegrees = sourcePlacedJetways.userData.uploadedJetwayA1CabYawOffsetDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactPoint = sourcePlacedJetways.userData.uploadedJetwayA1ActualContactPoint;
  environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid = sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid;
  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;`;
if (!terminalSource.includes("authoredTerminal4UploadedJetwayLoadState")) {
  if (!terminalSource.includes(evidenceAnchor)) throw new Error(`${terminalPath}: jetway geometry evidence anchor is missing`);
  terminalSource = terminalSource.replace(evidenceAnchor, evidenceBlock);
} else if (!terminalSource.includes("authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees")) {
  const insertionAnchor = "  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters;";
  if (!terminalSource.includes(insertionAnchor)) throw new Error(`${terminalPath}: full-3D evidence insertion anchor is missing`);
  terminalSource = terminalSource.replace(insertionAnchor, `${insertionAnchor}
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumCabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMinimumStairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumStairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMinimumBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumBogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticPartOrderValid = sourcePlacedJetways.userData.uploadedJetwayStaticPartOrderValid;
  environment.userData.authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees = sourcePlacedJetways.userData.uploadedJetwayA1CabNormalErrorDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1CabHeightErrorMeters = sourcePlacedJetways.userData.uploadedJetwayA1CabHeightErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1StairGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1StairGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1BogieGroundClearanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1BogieGroundClearanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1AnchorYawDegrees = sourcePlacedJetways.userData.uploadedJetwayA1AnchorYawDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1CabYawOffsetDegrees = sourcePlacedJetways.userData.uploadedJetwayA1CabYawOffsetDegrees;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactPoint = sourcePlacedJetways.userData.uploadedJetwayA1ActualContactPoint;`);
}

for (const token of [
  "await sourcePlacedJetways.userData.uploadedJetwayReady",
  ARTICULATION_AUTHORITY,
  "authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees",
  "authoredTerminal4UploadedJetwayA1CabHeightErrorMeters",
  "authoredTerminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees",
  "authoredTerminal4UploadedJetwayStaticPartOrderValid",
]) {
  if (!terminalSource.includes(token)) throw new Error(`${terminalPath}: authored CRJ700 forward-door full-3D jetway readiness wiring is missing ${token}`);
}
fs.writeFileSync(terminalPath, terminalSource, "utf8");
console.log(`Prepared awaited ${ARTICULATION_AUTHORITY} supplied jetway readiness for all 58 Terminal 4 gates.`);
