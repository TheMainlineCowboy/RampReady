import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CAMERA_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";
const PROFILE_AUTHORITY = "rotunda-terminal-and-tunnel-a-through-axis-normal-profile-v5-midheight";
const CAMERA_DISTANCE_METERS = 14.0;
const CAMERA_HEIGHT_OFFSET_METERS = 0.15;
const MAX_BRANCH_VIEW_COSINE = 0.82;
const MAX_BRANCH_VIEW_IMBALANCE = 0.20;
const MINIMUM_THROUGH_AXIS_LENGTH = 0.5;

let source = fs.readFileSync(trainerPath, "utf8");

// This normalizer is called before the endpoint-derived evidence camera exists
// during plain verification, then again after that camera is generated inside
// the simulator-quality production wrapper. Early verification must not invent
// a camera. The later stage must replace the old elbow-specific framing with a
// source-geometry camera that remains valid when the real terminal leg and the
// supplied bridge are nearly collinear through the Rotunda.
const terminalStartToken = '          if (exactA1EvidenceSubview === "terminal-joint") {';
const bogieElseToken = '          } else if (exactA1EvidenceSubview === "bogie-contact") {';
const terminalStart = source.indexOf(terminalStartToken);
const bogieElse = source.indexOf(bogieElseToken, terminalStart + terminalStartToken.length);

if (terminalStart < 0 || bogieElse < 0) {
  console.log("A1 source-through-axis side-on normalization deferred: endpoint-derived terminal-joint camera is not generated in this verification phase yet.");
  process.exit(0);
}

// The physical A1 now preserves decoded KPHX source heading and Rotunda
// through-continuity. For a near-straight joint, the interior angle bisector
// collapses and is the wrong camera authority. Build a stable through-axis from
// (Cab unit - wall unit): because the wall branch points toward the terminal and
// the Cab branch points toward the aircraft, their difference follows the
// passenger path through the Rotunda. Looking perpendicular to that axis shows
// both branches side-on without requiring or manufacturing a cosmetic elbow.
const terminalBlock = `          if (exactA1EvidenceSubview === "terminal-joint") {
            const exactA1JointCenterX = exactA1CameraRotundaX;
            const exactA1JointCenterY = exactA1CameraRotundaY;
            const exactA1JointCenterZ = exactA1CameraRotundaZ;

            const exactA1JointWallVectorX = exactA1CameraWallX - exactA1JointCenterX;
            const exactA1JointWallVectorZ = exactA1CameraWallZ - exactA1JointCenterZ;
            const exactA1JointWallSpan = Math.hypot(exactA1JointWallVectorX, exactA1JointWallVectorZ);
            const exactA1JointCabVectorX = exactA1CameraCabX - exactA1JointCenterX;
            const exactA1JointCabVectorZ = exactA1CameraCabZ - exactA1JointCenterZ;
            const exactA1JointCabSpan = Math.hypot(exactA1JointCabVectorX, exactA1JointCabVectorZ);
            const exactA1JointSpan = exactA1JointCabSpan;
            if (!(exactA1JointWallSpan > 0.5 && exactA1JointWallSpan < 44)) {
              throw new Error(\`A1 passenger-joint camera received invalid Rotunda-to-wall span: \${exactA1JointWallSpan}\`);
            }
            if (!(exactA1JointCabSpan > 8 && exactA1JointCabSpan < 44)) {
              throw new Error(\`A1 passenger-joint camera received invalid Rotunda-to-Cab span: \${exactA1JointCabSpan}\`);
            }

            const exactA1JointWallUnitX = exactA1JointWallVectorX / exactA1JointWallSpan;
            const exactA1JointWallUnitZ = exactA1JointWallVectorZ / exactA1JointWallSpan;
            const exactA1JointCabUnitX = exactA1JointCabVectorX / exactA1JointCabSpan;
            const exactA1JointCabUnitZ = exactA1JointCabVectorZ / exactA1JointCabSpan;
            const exactA1JointBranchAngleCosine = exactA1JointWallUnitX * exactA1JointCabUnitX
              + exactA1JointWallUnitZ * exactA1JointCabUnitZ;
            if (!Number.isFinite(exactA1JointBranchAngleCosine)
              || exactA1JointBranchAngleCosine < -1.000001
              || exactA1JointBranchAngleCosine > 1.000001) {
              throw new Error(\`A1 passenger-joint branch diagnostic is invalid: \${exactA1JointBranchAngleCosine}\`);
            }

            const exactA1JointThroughAxisX = exactA1JointCabUnitX - exactA1JointWallUnitX;
            const exactA1JointThroughAxisZ = exactA1JointCabUnitZ - exactA1JointWallUnitZ;
            const exactA1JointThroughAxisLength = Math.hypot(exactA1JointThroughAxisX, exactA1JointThroughAxisZ);
            if (!(exactA1JointThroughAxisLength > ${MINIMUM_THROUGH_AXIS_LENGTH.toFixed(2)})) {
              throw new Error(\`A1 passenger-joint through-axis collapsed: \${exactA1JointThroughAxisLength}\`);
            }
            const exactA1JointThroughUnitX = exactA1JointThroughAxisX / exactA1JointThroughAxisLength;
            const exactA1JointThroughUnitZ = exactA1JointThroughAxisZ / exactA1JointThroughAxisLength;
            const exactA1JointViewUnitX = -exactA1JointThroughUnitZ;
            const exactA1JointViewUnitZ = exactA1JointThroughUnitX;
            const exactA1JointCameraOutX = -exactA1JointViewUnitX;
            const exactA1JointCameraOutZ = -exactA1JointViewUnitZ;
            const exactA1JointCameraDistance = ${CAMERA_DISTANCE_METERS.toFixed(1)};

            exactA1CameraPositionX = exactA1JointCenterX + exactA1JointCameraOutX * exactA1JointCameraDistance;
            exactA1CameraPositionY = exactA1JointCenterY + ${CAMERA_HEIGHT_OFFSET_METERS.toFixed(2)};
            exactA1CameraPositionZ = exactA1JointCenterZ + exactA1JointCameraOutZ * exactA1JointCameraDistance;
            exactA1CameraTargetX = exactA1JointCenterX;
            exactA1CameraTargetY = exactA1JointCenterY;
            exactA1CameraTargetZ = exactA1JointCenterZ;

            const exactA1JointWallViewCosine = Math.abs(
              exactA1JointViewUnitX * exactA1JointWallUnitX
                + exactA1JointViewUnitZ * exactA1JointWallUnitZ,
            );
            const exactA1JointTunnelAViewCosine = Math.abs(
              exactA1JointViewUnitX * exactA1JointCabUnitX
                + exactA1JointViewUnitZ * exactA1JointCabUnitZ,
            );
            const exactA1JointBranchViewImbalance = Math.abs(
              exactA1JointWallViewCosine - exactA1JointTunnelAViewCosine,
            );
            if (!(exactA1JointWallViewCosine < ${MAX_BRANCH_VIEW_COSINE.toFixed(2)}
              && exactA1JointTunnelAViewCosine < ${MAX_BRANCH_VIEW_COSINE.toFixed(2)}
              && exactA1JointBranchViewImbalance < ${MAX_BRANCH_VIEW_IMBALANCE.toFixed(2)})) {
              throw new Error(\`A1 passenger-joint camera can hide a branch: wall=\${exactA1JointWallViewCosine} tunnelA=\${exactA1JointTunnelAViewCosine} imbalance=\${exactA1JointBranchViewImbalance}\`);
            }

            const exactA1JointApronDistance = 0;
            const exactA1JointSideDistance = exactA1JointCameraDistance;
            const exactA1JointSideOnCosine = Math.max(
              exactA1JointWallViewCosine,
              exactA1JointTunnelAViewCosine,
            );
            renderer.domElement.dataset.inspectionCameraEndpointJointCenter = [
              exactA1JointCenterX, exactA1JointCenterY, exactA1JointCenterZ,
            ].map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointJointSpanMeters = exactA1JointSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointWallSpanMeters = exactA1JointWallSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointCabSpanMeters = exactA1JointCabSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointApronDistanceMeters = exactA1JointApronDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointSideDistanceMeters = exactA1JointSideDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointSideOnCosine = exactA1JointSideOnCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointBranchAngleCosine = exactA1JointBranchAngleCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointThroughAxisLength = exactA1JointThroughAxisLength.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointWallViewCosine = exactA1JointWallViewCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointTunnelAViewCosine = exactA1JointTunnelAViewCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointBranchViewImbalance = exactA1JointBranchViewImbalance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointCameraHeightOffsetMeters = "${CAMERA_HEIGHT_OFFSET_METERS.toFixed(2)}";
            renderer.domElement.dataset.inspectionCameraEndpointJointProfileAuthority = "${PROFILE_AUTHORITY}";
`;

source = `${source.slice(0, terminalStart)}${terminalBlock}${source.slice(bogieElse)}`;
source = source.replace(
  /renderer\.domElement\.dataset\.inspectionCameraEndpointSubviewAuthority = "[^"]+";/,
  `renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${CAMERA_AUTHORITY}";`,
);

for (const forbidden of [
  "const exactA1JointVectorX = exactA1CameraRotundaX - exactA1CameraWallX",
  "const exactA1JointVectorX = exactA1CameraCabX - exactA1CameraRotundaX",
  "exactA1JointSideX * exactA1JointSideDistance",
  "Math.max(4.2, exactA1JointSpan * 1.05)",
  "Math.max(13.0, Math.min(16.0, exactA1JointSpan * 0.52))",
  "rotunda-to-tunnel-a-passenger-profile-v1",
  "rotunda-terminal-and-tunnel-a-bisector-profile-v2",
  "rotunda-terminal-and-tunnel-a-bisector-profile-v3-midheight",
  "rotunda-terminal-and-tunnel-a-bisector-normal-profile-v4-midheight",
  "const exactA1JointBisectorX = exactA1JointWallUnitX + exactA1JointCabUnitX;",
  "exactA1JointBranchAngleCosine > -0.95",
  "const exactA1JointViewUnitX = exactA1JointBisectorX / exactA1JointBisectorLength;",
  "exactA1CameraPositionY = exactA1JointCenterY + 1.40;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: retired elbow-specific/end-on A1 evidence framing survived final normalization: ${forbidden}`);
  }
}

for (const required of [
  "const exactA1JointCenterX = exactA1CameraRotundaX;",
  "const exactA1JointWallVectorX = exactA1CameraWallX - exactA1JointCenterX;",
  "const exactA1JointCabVectorX = exactA1CameraCabX - exactA1JointCenterX;",
  "const exactA1JointThroughAxisX = exactA1JointCabUnitX - exactA1JointWallUnitX;",
  "const exactA1JointThroughUnitX = exactA1JointThroughAxisX / exactA1JointThroughAxisLength;",
  "const exactA1JointViewUnitX = -exactA1JointThroughUnitZ;",
  "const exactA1JointViewUnitZ = exactA1JointThroughUnitX;",
  `const exactA1JointCameraDistance = ${CAMERA_DISTANCE_METERS.toFixed(1)};`,
  `exactA1CameraPositionY = exactA1JointCenterY + ${CAMERA_HEIGHT_OFFSET_METERS.toFixed(2)};`,
  "exactA1CameraTargetY = exactA1JointCenterY;",
  `inspectionCameraEndpointJointCameraHeightOffsetMeters = "${CAMERA_HEIGHT_OFFSET_METERS.toFixed(2)}"`,
  "inspectionCameraEndpointJointThroughAxisLength",
  "inspectionCameraEndpointJointWallViewCosine",
  "inspectionCameraEndpointJointTunnelAViewCosine",
  "inspectionCameraEndpointJointBranchViewImbalance",
  `inspectionCameraEndpointJointProfileAuthority = "${PROFILE_AUTHORITY}"`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: normalized A1 source-through-axis evidence camera is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Normalized final A1 evidence camera to a passenger-midheight view perpendicular to the source-owned wall/Rotunda/Cab through-axis; near-straight physical continuity no longer collapses the camera while both branches remain side-on and visible.");
