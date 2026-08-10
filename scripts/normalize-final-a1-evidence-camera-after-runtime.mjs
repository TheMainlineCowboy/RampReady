import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const MIN_JOINT_SPAN_METERS = 8;
const MAX_JOINT_SPAN_METERS = 44;
const CAMERA_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";
const PROFILE_AUTHORITY = "rotunda-to-tunnel-a-passenger-profile-v1";

let source = fs.readFileSync(trainerPath, "utf8");

// The live phone defect is at the passenger elbow: the terminal-side generated
// passage and the supplied aircraft-side Tunnel A were visibly stacked at the
// Rotunda. A wall-to-Rotunda close-up can hide that defect completely. Make the
// final production camera use Rotunda->Cab as the passenger-bridge axis, target
// the Rotunda itself, and view that axis from the side at near-passenger height.
// The short real wall leg remains visible behind the Rotunda, while Tunnel A is
// forced into the same profile frame.
const oldJointBasis = `            const exactA1JointCenterX = (exactA1CameraWallX + exactA1CameraRotundaX) * 0.5;
            const exactA1JointCenterY = (exactA1CameraWallY + exactA1CameraRotundaY) * 0.5;
            const exactA1JointCenterZ = (exactA1CameraWallZ + exactA1CameraRotundaZ) * 0.5;
            const exactA1JointVectorX = exactA1CameraRotundaX - exactA1CameraWallX;
            const exactA1JointVectorZ = exactA1CameraRotundaZ - exactA1CameraWallZ;`;
const passengerElbowBasis = `            const exactA1JointCenterX = exactA1CameraRotundaX;
            const exactA1JointCenterY = exactA1CameraRotundaY;
            const exactA1JointCenterZ = exactA1CameraRotundaZ;
            const exactA1JointVectorX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1JointVectorZ = exactA1CameraCabZ - exactA1CameraRotundaZ;`;
if (source.includes(oldJointBasis)) {
  source = source.replace(oldJointBasis, passengerElbowBasis);
} else if (!source.includes(passengerElbowBasis)) {
  throw new Error(`${trainerPath}: final A1 passenger-elbow camera basis anchor is missing`);
}

// Later runtime preparation does not always emit a dedicated joint-span guard.
// Normalize it when present. The span now represents Rotunda->Cab/Tunnel-A,
// not the short wall vestibule.
const spanPattern = /if \(!\(exactA1JointSpan\s*(?:>|>=)\s*[0-9.]+\s*&&\s*exactA1JointSpan\s*(?:<|<=)\s*[0-9.]+\)\) \{/g;
const spanMatches = source.match(spanPattern) || [];
if (spanMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 passenger-elbow span guard, found ${spanMatches.length}`);
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
    "const exactA1JointApronDistance = Math.max(2.0, Math.min(3.5, exactA1JointSpan * 0.10));",
  );
} else if (apronMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 passenger-elbow forward-offset expression, found ${apronMatches.length}`);
}

const sidePattern = /const exactA1JointSideDistance = Math\.max\([^;]+\);/g;
const sideMatches = source.match(sidePattern) || [];
if (sideMatches.length === 1) {
  source = source.replace(
    sidePattern,
    "const exactA1JointSideDistance = Math.max(13.0, Math.min(16.0, exactA1JointSpan * 0.52));",
  );
} else if (sideMatches.length > 1) {
  throw new Error(`${trainerPath}: expected at most one A1 passenger-elbow side-distance expression, found ${sideMatches.length}`);
}

source = source.replace(
  "exactA1CameraPositionY = exactA1JointCenterY + 3.25;",
  "exactA1CameraPositionY = exactA1JointCenterY + 1.40;",
);
source = source.replace(
  "exactA1CameraTargetY = exactA1JointCenterY - 0.05;",
  "exactA1CameraTargetY = exactA1JointCenterY;",
);

source = source.replace(
  /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/,
  `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${CAMERA_AUTHORITY}";`,
);
if (!source.includes("inspectionCameraEndpointJointProfileAuthority")) {
  const telemetryAnchor = "            renderer.domElement.dataset.inspectionCameraEndpointJointSideOnCosine = exactA1JointSideOnCosine.toFixed(6);";
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${trainerPath}: A1 passenger-elbow profile telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n            renderer.domElement.dataset.inspectionCameraEndpointJointProfileAuthority = "${PROFILE_AUTHORITY}";`,
  );
}
source = source.replaceAll(
  "Frame the disputed attachment side-on to the actual wall-to-Rotunda",
  "Frame the disputed passenger elbow side-on to the actual Rotunda-to-Cab",
);
source = source.replaceAll(
  "This basis forces the source-measured fixed terminal leg to run",
  "This basis forces the supplied Tunnel A and fixed terminal leg to meet",
);
source = source.replaceAll(
  "This basis forces the compact vestibule to run",
  "This basis forces the supplied Tunnel A and fixed terminal leg to meet",
);
source = source.replaceAll(
  "A1 terminal-joint close camera received invalid exact span",
  "A1 passenger-elbow profile camera received invalid Rotunda-to-Cab span",
);
source = source.replaceAll(
  "A1 terminal-joint side camera has invalid Cab separation",
  "A1 passenger-elbow profile camera has invalid Cab separation",
);
source = source.replaceAll(
  "A1 terminal-joint camera is not sufficiently side-on to the wall joint",
  "A1 passenger-elbow camera is not sufficiently side-on to Tunnel A",
);

for (const forbidden of [
  "exactA1JointCenterX = (exactA1CameraWallX + exactA1CameraRotundaX) * 0.5",
  "exactA1JointVectorX = exactA1CameraRotundaX - exactA1CameraWallX",
  "exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8",
  "exactA1JointSpan >= 2.9 && exactA1JointSpan <= 5.8",
  "Math.max(4.2, exactA1JointSpan * 1.05)",
  "Math.max(10.4, exactA1JointSpan * 2.62)",
  "Math.max(5.0, Math.min(10.0, exactA1JointSpan * 0.35))",
  "Math.max(14.0, Math.min(30.0, exactA1JointSpan * 1.30))",
  "This basis forces the compact vestibule to run",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: retired wall-only A1 camera assumption survived final runtime normalization: ${forbidden}`);
  }
}

for (const required of [
  passengerElbowBasis,
  `exactA1JointSpan > ${MIN_JOINT_SPAN_METERS} && exactA1JointSpan < ${MAX_JOINT_SPAN_METERS}`,
  "Math.max(2.0, Math.min(3.5, exactA1JointSpan * 0.10))",
  "Math.max(13.0, Math.min(16.0, exactA1JointSpan * 0.52))",
  "exactA1CameraPositionY = exactA1JointCenterY + 1.40;",
  "exactA1CameraTargetY = exactA1JointCenterY;",
  `inspectionCameraEndpointJointProfileAuthority = "${PROFILE_AUTHORITY}"`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: normalized A1 passenger-elbow profile camera is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Normalized final A1 evidence camera to the Rotunda->Tunnel-A passenger profile (spanGuard=${spanMatches.length}, forward=${apronMatches.length}, side=${sideMatches.length}); wall-only framing is forbidden.`);
