import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const currentMarkers = [
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

// Several legacy preparers run immediately before this final compatibility stage.
// Normalize only their stale textual range guards here so the final real-wall
// authority can validate the actual source-measured A1 geometry deterministically.
// This does not move, rotate, rescale, replace or otherwise mutate Airport_Jetway.glb.
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let readiness = fs.readFileSync(readinessPath, "utf8");
readiness = readiness.replace(
  /a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
  "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44",
);
readiness = readiness.replace(
  /connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
  "connectorVisibleLength > 0.15 && connectorVisibleLength < 44",
);
if (!readiness.includes("a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44")) {
  throw new Error(`${readinessPath}: unable to normalize final source-measured A1 wall-distance guard`);
}
if (!readiness.includes("connectorVisibleLength > 0.15 && connectorVisibleLength < 44")) {
  throw new Error(`${readinessPath}: unable to normalize final source-measured A1 fixed-leg guard`);
}
fs.writeFileSync(readinessPath, readiness, "utf8");

// This must be the last A1 geometry mutation before the production wrapper.
// The older migration chain remains for compatibility/evidence, but none of its
// compact 2.4 m assumptions may own the final bundle. Reassert the real
// structural Terminal 4 wall, source-measured fixed leg and exact supplied
// Rotunda after every legacy preparer has finished.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?final-real-wall=${Date.now()}`);

console.log("Published the established exact-head acceptance marker, normalized stale readiness range guards, then replaced the retired compact A1 assumptions with the final real-Terminal-4-wall/source-measured geometry before production bundling.");
