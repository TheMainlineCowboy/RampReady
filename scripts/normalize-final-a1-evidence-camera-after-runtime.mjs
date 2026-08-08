import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const MIN_JOINT_SPAN_METERS = 0.5;
const MAX_JOINT_SPAN_METERS = 44;
const CAMERA_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";

let source = fs.readFileSync(trainerPath, "utf8");

// prepare:terminal4-runtime can regenerate the terminal-joint evidence camera
// with several slightly different compact-range spellings. Normalize the
// physical variable itself rather than one literal formatting variant. The real
// structural wall -> exact Rotunda span is about 20 m on A1.
const spanPattern = /if \(!\(exactA1JointSpan\s*(?:>|>=)\s*[0-9.]+\s*&&\s*exactA1JointSpan\s*(?:<|<=)\s*[0-9.]+\)\) \{/g;
const spanMatches = source.match(spanPattern) || [];
if (spanMatches.length !== 1) {
  throw new Error(`${trainerPath}: expected one A1 terminal-joint span guard, found ${spanMatches.length}`);
}
source = source.replace(
  spanPattern,
  `if (!(exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS})) {`,
);

const apronPattern = /const exactA1JointApronDistance = Math\.max\([^;]+\);/g;
const apronMatches = source.match(apronPattern) || [];
if (apronMatches.length !== 1) {
  throw new Error(`${trainerPath}: expected one A1 terminal-joint apron-distance expression, found ${apronMatches.length}`);
}
source = source.replace(
  apronPattern,
  "const exactA1JointApronDistance = Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35));",
);

const sidePattern = /const exactA1JointSideDistance = Math\.max\([^;]+\);/g;
const sideMatches = source.match(sidePattern) || [];
if (sideMatches.length !== 1) {
  throw new Error(`${trainerPath}: expected one A1 terminal-joint side-distance expression, found ${sideMatches.length}`);
}
source = source.replace(
  sidePattern,
  "const exactA1JointSideDistance = Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30));",
);

source = source.replace(
  /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/,
  `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${CAMERA_AUTHORITY}";`,
);
source = source.replaceAll(
  "This basis forces the compact vestibule to run",
  "This basis forces the source-measured fixed terminal leg to run",
);

for (const forbidden of [
  "exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8",
  "exactA1JointSpan >= 2.9 && exactA1JointSpan <= 5.8",
  "Math.max(4.2, exactA1JointSpan * 1.05)",
  "Math.max(10.4, exactA1JointSpan * 2.62)",
  "This basis forces the compact vestibule to run",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: retired compact A1 camera assumption survived final runtime normalization: ${forbidden}`);
  }
}

for (const required of [
  `exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS}`,
  "Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35))",
  "Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30))",
  CAMERA_AUTHORITY,
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: source-measured A1 evidence camera is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Normalized the final A1 terminal-joint evidence camera by variable-specific guards: source-measured 0.5-44 m wall/Rotunda span and bounded side/apron framing replace every compact-camera spelling before Vite.");
