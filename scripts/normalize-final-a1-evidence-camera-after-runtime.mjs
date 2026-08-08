import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const MIN_JOINT_SPAN_METERS = 0.5;
const MAX_JOINT_SPAN_METERS = 44;
const CAMERA_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";

let source = fs.readFileSync(trainerPath, "utf8");

// Later runtime preparation does not always emit a dedicated joint-span guard.
// Normalize it when present, but do not fail merely because the current camera
// implementation derives framing directly from the measured endpoints.
const spanPattern = /if \(!\(exactA1JointSpan\s*(?:>|>=)\s*[0-9.]+\s*&&\s*exactA1JointSpan\s*(?:<|<=)\s*[0-9.]+\)\) \{/g;
const spanMatches = source.match(spanPattern) || [];
if (spanMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 terminal-joint span guard, found ${spanMatches.length}`);
}
if (spanMatches.length === 1) {
  source = source.replace(
    spanPattern,
    `if (!(exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS})) {`,
  );
}

const apronPattern = /const exactA1JointApronDistance = Math\.max\([^;]+\);/g;
const apronMatches = source.match(apronPattern) || [];
if (apronMatches.length === 1) {
  source = source.replace(
    apronPattern,
    "const exactA1JointApronDistance = Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35));",
  );
} else if (apronMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 terminal-joint apron-distance expression, found ${apronMatches.length}`);
}

const sidePattern = /const exactA1JointSideDistance = Math\.max\([^;]+\);/g;
const sideMatches = source.match(sidePattern) || [];
if (sideMatches.length === 1) {
  source = source.replace(
    sidePattern,
    "const exactA1JointSideDistance = Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30));",
  );
} else if (sideMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 terminal-joint side-distance expression, found ${sideMatches.length}`);
}

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

if (spanMatches.length === 1 && !source.includes(`exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS}`)) {
  throw new Error(`${trainerPath}: normalized A1 terminal-joint span guard is missing`);
}
if (apronMatches.length === 1 && !source.includes("Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35))")) {
  throw new Error(`${trainerPath}: normalized A1 apron framing is missing`);
}
if (sideMatches.length === 1 && !source.includes("Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30))")) {
  throw new Error(`${trainerPath}: normalized A1 side framing is missing`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Normalized final A1 evidence camera opportunistically from current measured-endpoint expressions (spanGuard=${spanMatches.length}, apron=${apronMatches.length}, side=${sideMatches.length}); no compact-camera geometry was reintroduced.`);
