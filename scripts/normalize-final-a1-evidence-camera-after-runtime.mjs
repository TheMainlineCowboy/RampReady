import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const MIN_JOINT_SPAN_METERS = 0.5;
const MAX_JOINT_SPAN_METERS = 44;
const CAMERA_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";

let source = fs.readFileSync(trainerPath, "utf8");

// prepare:runtime still regenerates a terminal-joint evidence camera that was
// designed around the retired 2.9-5.8 m compact vestibule. The real structural
// wall -> exact Rotunda span is about 20 m on A1, so that camera was throwing
// before it could publish its endpoint authority or render the terminal at all.
// Normalize the camera AFTER runtime preparation, immediately before Vite.
source = source.replace(
  "if (!(exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8)) {",
  `if (!(exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS})) {`,
);
source = source.replace(
  "const exactA1JointApronDistance = Math.max(4.2, exactA1JointSpan * 1.05);",
  "const exactA1JointApronDistance = Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35));",
);
source = source.replace(
  "const exactA1JointSideDistance = Math.max(10.4, exactA1JointSpan * 2.62);",
  "const exactA1JointSideDistance = Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30));",
);
source = source.replace(
  'renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "exact-a1-terminal-joint-and-bogie-contact-subviews-v2";',
  `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${CAMERA_AUTHORITY}";`,
);

// The comment is evidence-facing too: remove the obsolete claim that the
// terminal-side leg is compact so future repairs do not infer the wrong target.
source = source.replaceAll(
  "This basis forces the compact vestibule to run",
  "This basis forces the source-measured fixed terminal leg to run",
);

for (const forbidden of [
  "exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8",
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
console.log("Normalized the final A1 terminal-joint evidence camera for the source-measured 0.5-44 m wall/Rotunda span and bounded the side/apron framing distances so the real fixed terminal run is visible instead of rejected as non-compact.");
