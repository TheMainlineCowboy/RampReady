import fs from "node:fs";

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
  ) {
    throw new Error("Terminal 4 uploaded jetway fleet did not complete all 58 source placements");
  }
  environment.add(authored, sourcePlacedJetways);`;
if (!terminalSource.includes("await sourcePlacedJetways.userData.uploadedJetwayReady")) {
  if (!terminalSource.includes(buildAnchor)) throw new Error(`${terminalPath}: source-placed jetway build anchor is missing`);
  terminalSource = terminalSource.replace(buildAnchor, awaitedBuild);
}

const evidenceAnchor = "  environment.userData.authoredTerminal4JetwaySourceGeometryMode = sourcePlacedJetways.userData.sourceGeometryMode;";
const evidenceBlock = `${evidenceAnchor}
  environment.userData.authoredTerminal4UploadedJetwayLoadState = sourcePlacedJetways.userData.uploadedJetwayLoadState;
  environment.userData.authoredTerminal4UploadedJetwayCount = sourcePlacedJetways.userData.uploadedJetwayCount;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = sourcePlacedJetways.userData.uploadedJetwayMeasuredTerminalConnectorCount;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = sourcePlacedJetways.userData.uploadedJetwayVerifiedModelCount;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = sourcePlacedJetways.userData.uploadedJetwayReadyAuthority;`;
if (!terminalSource.includes("authoredTerminal4UploadedJetwayLoadState")) {
  if (!terminalSource.includes(evidenceAnchor)) throw new Error(`${terminalPath}: jetway geometry evidence anchor is missing`);
  terminalSource = terminalSource.replace(evidenceAnchor, evidenceBlock);
}

for (const token of [
  "await sourcePlacedJetways.userData.uploadedJetwayReady",
  'uploadedJetwayLoadState !== "ready"',
  "uploadedJetwayVerifiedModelCount) !== 58",
  "authoredTerminal4UploadedJetwayLoadState",
  "authoredTerminal4UploadedJetwayCount",
  "authoredTerminal4UploadedJetwayConnectorCount",
  "authoredTerminal4UploadedJetwayVerifiedModelCount",
  "authoredTerminal4UploadedJetwayReadyAuthority",
]) {
  if (!terminalSource.includes(token)) throw new Error(`${terminalPath}: uploaded jetway readiness wiring is missing ${token}`);
}
fs.writeFileSync(terminalPath, terminalSource, "utf8");

console.log("Prepared awaited uploaded-airport jetway readiness: one canonical loader import and all 58 source placements, measured terminal connectors and decoded model clones must complete before Terminal 4 becomes ready.");
