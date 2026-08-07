import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-a1-terminal-joint-and-bogie-contact-subviews-v1";
if (source.includes(`inspectionCameraEndpointSubviewAuthority = "${authority}"`)) {
  console.log("Exact A1 terminal-joint and bogie-contact evidence subviews are already prepared.");
  process.exit(0);
}

const fullFrameBlock = `          const exactA1CameraPositionX = exactA1CameraFrameCenter.x
            + exactA1CameraApronX * exactA1CameraHorizontalExtent * 0.62
            + exactA1CameraSideX * exactA1CameraSideSign * exactA1CameraHorizontalExtent * 1.18;
          const exactA1CameraPositionZ = exactA1CameraFrameCenter.z
            + exactA1CameraApronZ * exactA1CameraHorizontalExtent * 0.62
            + exactA1CameraSideZ * exactA1CameraSideSign * exactA1CameraHorizontalExtent * 1.18;
          const exactA1CameraPositionY = Math.max(
            17,
            exactA1CameraFrameCenter.y + exactA1CameraHorizontalExtent * 0.48,
          );
          const exactA1CameraTargetX = exactA1CameraFrameCenter.x;
          const exactA1CameraTargetZ = exactA1CameraFrameCenter.z;
          const exactA1CameraTargetY = Math.max(2.8, exactA1CameraFrameCenter.y);`;

const subviewBlock = `          let exactA1CameraPositionX = exactA1CameraFrameCenter.x
            + exactA1CameraApronX * exactA1CameraHorizontalExtent * 0.62
            + exactA1CameraSideX * exactA1CameraSideSign * exactA1CameraHorizontalExtent * 1.18;
          let exactA1CameraPositionZ = exactA1CameraFrameCenter.z
            + exactA1CameraApronZ * exactA1CameraHorizontalExtent * 0.62
            + exactA1CameraSideZ * exactA1CameraSideSign * exactA1CameraHorizontalExtent * 1.18;
          let exactA1CameraPositionY = Math.max(
            17,
            exactA1CameraFrameCenter.y + exactA1CameraHorizontalExtent * 0.48,
          );
          let exactA1CameraTargetX = exactA1CameraFrameCenter.x;
          let exactA1CameraTargetZ = exactA1CameraFrameCenter.z;
          let exactA1CameraTargetY = Math.max(2.8, exactA1CameraFrameCenter.y);
          const exactA1EvidenceSubview = renderer.domElement.dataset.a1EvidenceSubview || "full-assembly";
          const exactA1BogieContactX = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterX,
          );
          const exactA1BogieContactY = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterY,
          );
          const exactA1BogieContactZ = Number(
            exactA1CameraFleet?.userData?.uploadedJetwayBogieGroundContactCenterZ,
          );
          const exactA1BogieContactReady = [
            exactA1BogieContactX,
            exactA1BogieContactY,
            exactA1BogieContactZ,
          ].every(Number.isFinite);
          if (exactA1EvidenceSubview === "terminal-joint") {
            // Frame the exact measured wall and Rotunda collar side-on. The old
            // wide view did not visibly prove the attachment even when its
            // telemetry was correct.
            const exactA1JointCenterX = (exactA1CameraWallX + exactA1CameraRotundaX) * 0.5;
            const exactA1JointCenterY = (exactA1CameraWallY + exactA1CameraRotundaY) * 0.5;
            const exactA1JointCenterZ = (exactA1CameraWallZ + exactA1CameraRotundaZ) * 0.5;
            const exactA1JointSpan = Math.hypot(
              exactA1CameraRotundaX - exactA1CameraWallX,
              exactA1CameraRotundaZ - exactA1CameraWallZ,
            );
            if (!(exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8)) {
              throw new Error(\`A1 terminal-joint close camera received invalid exact span: \${exactA1JointSpan}\`);
            }
            const exactA1JointSideDistance = Math.max(6.4, exactA1JointSpan * 1.7);
            exactA1CameraPositionX = exactA1JointCenterX
              + exactA1CameraApronX * 1.15
              + exactA1CameraSideX * exactA1CameraSideSign * exactA1JointSideDistance;
            exactA1CameraPositionY = exactA1JointCenterY + 2.9;
            exactA1CameraPositionZ = exactA1JointCenterZ
              + exactA1CameraApronZ * 1.15
              + exactA1CameraSideZ * exactA1CameraSideSign * exactA1JointSideDistance;
            exactA1CameraTargetX = exactA1JointCenterX;
            exactA1CameraTargetY = exactA1JointCenterY - 0.15;
            exactA1CameraTargetZ = exactA1JointCenterZ;
            renderer.domElement.dataset.inspectionCameraEndpointJointCenter = [
              exactA1JointCenterX, exactA1JointCenterY, exactA1JointCenterZ,
            ].map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointJointSpanMeters = exactA1JointSpan.toFixed(6);
          } else if (exactA1EvidenceSubview === "bogie-contact") {
            if (!exactA1BogieContactReady) {
              throw new Error("A1 bogie-contact close camera is missing the exact authored low-contact centroid");
            }
            // Frame the actual measured low-contact footprint instead of using
            // any Cab or aircraft-position offset.
            const exactA1BogieSideDistance = 5.4;
            exactA1CameraPositionX = exactA1BogieContactX
              - exactA1CameraApronX * 1.35
              + exactA1CameraSideX * exactA1CameraSideSign * exactA1BogieSideDistance;
            exactA1CameraPositionY = exactA1BogieContactY + 2.35;
            exactA1CameraPositionZ = exactA1BogieContactZ
              - exactA1CameraApronZ * 1.35
              + exactA1CameraSideZ * exactA1CameraSideSign * exactA1BogieSideDistance;
            exactA1CameraTargetX = exactA1BogieContactX;
            exactA1CameraTargetY = exactA1BogieContactY + 0.72;
            exactA1CameraTargetZ = exactA1BogieContactZ;
            renderer.domElement.dataset.inspectionCameraEndpointBogieContactCenter = [
              exactA1BogieContactX, exactA1BogieContactY, exactA1BogieContactZ,
            ].map((value) => value.toFixed(6)).join(",");
          }
          renderer.domElement.dataset.inspectionCameraEndpointSubview = exactA1EvidenceSubview;
          renderer.domElement.dataset.inspectionCameraEndpointSubviewAuthority = "${authority}";`;

if (!source.includes(fullFrameBlock)) {
  throw new Error(`${trainerPath}: complete-scene A1 camera position block is missing`);
}
source = source.replace(fullFrameBlock, subviewBlock);

for (const token of [
  `inspectionCameraEndpointSubviewAuthority = "${authority}"`,
  "a1EvidenceSubview",
  'exactA1EvidenceSubview === "terminal-joint"',
  'exactA1EvidenceSubview === "bogie-contact"',
  "const exactA1JointCenterX",
  "const exactA1JointSpan",
  "exactA1CameraApronX * 1.15",
  "const exactA1BogieContactX",
  "uploadedJetwayBogieGroundContactCenterX",
  "inspectionCameraEndpointBogieContactCenter",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointJointSpanMeters",
  "inspectionCameraEndpointSubview = exactA1EvidenceSubview",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: exact A1 evidence subview is missing ${token}`);
  }
}
const forbiddenGuessedCabTarget = "exactA1CameraCabX - exactA1CameraApronX * " + "6";
const forbiddenWideApronOffset = "exactA1CameraApronX * " + "8";
const forbiddenWideSideOffset = "exactA1CameraSideSign * " + "12";
for (const forbidden of [
  forbiddenGuessedCabTarget,
  forbiddenWideApronOffset,
  forbiddenWideSideOffset,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete guessed A1 close-camera targeting remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared a tight side-on exact wall/Rotunda joint view and a low close-up derived from the authored bogie contact centroid, with fail-closed checks that do not self-match their migration vocabulary.");
