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

// Marker compatibility is not a geometry authority. Reassert the single final
// A1 geometry owner after every legacy preparer; it normalizes/inserts the real
// wall and fixed-leg readiness guards itself and then writes the final runtime.
await import(`./prepare-a1-real-terminal-final-geometry-v1.mjs?final-real-wall=${Date.now()}`);

console.log("Published the established exact-head acceptance marker, then delegated all final A1 geometry/readiness ownership to the real-Terminal-4-wall source-measured finalizer.");
