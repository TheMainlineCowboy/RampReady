import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(trainerPath, "utf8");

const currentMarkers = [
  "final-a1-acceptance-authority-after-all-preparers-v6-own-gate-real-wall-static",
  "final-a1-acceptance-authority-after-all-preparers-v5-source-heading-real-wall-static",
  "final-a1-acceptance-authority-after-all-preparers-v4-source-static-integrity",
  "final-a1-acceptance-authority-after-all-preparers-v3-three-tire-contact",
  "final-a1-acceptance-authority-after-all-preparers-v2",
];
const workflowMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
for (const currentMarker of currentMarkers) {
  source = source.replaceAll(currentMarker, workflowMarker);
}

for (const token of [
  workflowMarker,
  "inspectionAircraftLandingGearContactPatchCount",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: final compatible A1 marker is missing acceptance evidence ${token}`);
  }
}
for (const currentMarker of currentMarkers) {
  if (source.includes(currentMarker)) {
    throw new Error(`${trainerPath}: superseded final acceptance marker remains after workflow compatibility migration: ${currentMarker}`);
  }
}
fs.writeFileSync(trainerPath, source, "utf8");

const sourcePlaced = fs.readFileSync(sourcePlacedPath, "utf8");
if (sourcePlaced.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${sourcePlacedPath}: obsolete elevated T4_WALK A1 portal survived final marker compatibility`);
}
if (!sourcePlaced.includes("structural-A1-terminal-building-")) {
  throw new Error(`${sourcePlacedPath}: structural Terminal 4 A1 wall authority is missing`);
}

// Marker compatibility is not geometry authority. The former implementation
// broadened A1 to a 44 m wall/connector envelope and required the raw decoded BGL
// coordinate to be treated as the Rotunda center. That is the exact regression
// that produced the 19.97 m wall span and 18.56 m second white tunnel in the live
// phone view. Re-assert the already measured/photo-verified real terminal wall
// geometry here instead, after every other late preparer has run.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?final-marker-real-wall=${Date.now()}`);

const readiness = fs.readFileSync(readinessPath, "utf8");
const elbow = fs.readFileSync(elbowPath, "utf8");
for (const required of [
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "connectorVisibleLength > 1.2 && connectorVisibleLength < 3.6",
]) {
  if (!readiness.includes(required)) {
    throw new Error(`${readinessPath}: final real-wall A1 readiness is missing ${required}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44",
  "connectorVisibleLength > 0.15 && connectorVisibleLength < 44",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: long-corridor A1 readiness survived final marker compatibility: ${forbidden}`);
  }
}
for (const required of [
  "terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8",
  "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;",
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;",
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: final real-wall A1 elbow is missing ${required}`);
  }
}
for (const forbidden of [
  "terminalWallDistance > 0.5 && terminalWallDistance < 44",
  "terminalWallDistance >= 0.5 && terminalWallDistance <= 44",
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
  "A1 source wall-to-Rotunda fixed leg is invalid",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: raw-BGL/long-corridor A1 geometry survived final marker compatibility: ${forbidden}`);
  }
}

console.log("Published the established exact-head acceptance marker while preserving A1's verified real Terminal 4 wall registration: 2.9-5.8 m Rotunda-to-wall, 1.2-3.6 m visible fixed leg, no T4_WALK target, and no raw-BGL Rotunda reset. Static fleet own-gate target alignment remains authoritative before this compatibility-only marker step.");
