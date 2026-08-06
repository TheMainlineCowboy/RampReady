import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const currentMarker = "final-a1-acceptance-authority-after-all-preparers-v2";
const workflowMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
source = source.replaceAll(currentMarker, workflowMarker);

for (const token of [
  workflowMarker,
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
if (source.includes(currentMarker)) {
  throw new Error(`${trainerPath}: superseded v2 marker remains after workflow compatibility migration`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Published the established exact-head final acceptance marker only after compact-wall, multi-point jetway contact, and closed-vestibule evidence survived finalization.");
