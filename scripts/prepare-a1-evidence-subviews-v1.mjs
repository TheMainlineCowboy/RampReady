import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-a1-terminal-joint-and-bogie-contact-subviews-v2";
if (source.includes(`inspectionCameraEndpointSubviewAuthority = "${authority}"`)) {
  console.log("Exact A1 terminal-joint and bogie-contact evidence subviews v2 are already prepared.");
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
            const exactA1JointCenterX = (exactA1CameraWallX + exactA1CameraRotundaX) * 0.5;
            const exactA1JointCenterY = (exactA1CameraWallY + exactA1CameraRotundaY) * 0.5;
            const exactA1JointCenterZ = (exactA1CameraWallZ + exactA1CameraRotundaZ) * 0.5;
            const exactA1JointVectorX = exactA1CameraRotundaX - exactA1CameraWallX;
            const exactA1JointVectorZ = exactA1CameraRotundaZ - exactA1CameraWallZ;
            const exactA1JointSpan = Math.hypot(exactA1JointVectorX, exactA1JointVectorZ);
            if (!(exactA1JointSpan > 2.9 && exactA1JointSpan < 5.8)) {
              throw new Error(\`A1 terminal-joint close camera received invalid exact span: \${exactA1JointSpan}\`);
            }

            // Frame the disputed attachment side-on to the actual wall-to-Rotunda
            // vector. The old bridge-axis camera stacked T4_WALK directly behind
            // the Rotunda and made a real terminal-facade joint look like a
            // walkway attachment. This basis forces the compact vestibule to run
            // across the image while keeping the camera on the apron side.
            const exactA1JointUnitX = exactA1JointVectorX / exactA1JointSpan;
            const exactA1JointUnitZ = exactA1JointVectorZ / exactA1JointSpan;
            let exactA1JointSideX = -exactA1JointUnitZ;
            let exactA1JointSideZ = exactA1JointUnitX;
            const exactA1JointToCabX = exactA1CameraCabX - exactA1JointCenterX;
            const exactA1JointToCabZ = exactA1CameraCabZ - exactA1JointCenterZ;
            const exactA1JointToCabLength = Math.hypot(exactA1JointToCabX, exactA1JointToCabZ);
            if (!(exactA1JointToCabLength > 5)) {
              throw new Error(\`A1 terminal-joint side camera has invalid Cab separation: \${exactA1JointToCabLength}\`);
            }
            const exactA1JointApronX = exactA1JointToCabX / exactA1JointToCabLength;
            const exactA1JointApronZ = exactA1JointToCabZ / exactA1JointToCabLength;
            const sideDotApron = exactA1JointSideX * exactA1JointApronX
              + exactA1JointSideZ * exactA1JointApronZ;
            if (sideDotApron < 0) {
              exactA1JointSideX *= -1;
              exactA1JointSideZ *= -1;
            }
            const exactA1JointApronDistance = Math.max(4.2, exactA1JointSpan * 1.05);
            const exactA1JointSideDistance = Math.max(10.4, exactA1JointSpan * 2.62);
            exactA1CameraPositionX = exactA1JointCenterX
              + exactA1JointSideX * exactA1JointSideDistance
              + exactA1JointApronX * exactA1JointApronDistance;
            exactA1CameraPositionY = exactA1JointCenterY + 3.25;
            exactA1CameraPositionZ = exactA1JointCenterZ
              + exactA1JointSideZ * exactA1JointSideDistance
              + exactA1JointApronZ * exactA1JointApronDistance;
            exactA1CameraTargetX = exactA1JointCenterX;
            exactA1CameraTargetY = exactA1JointCenterY - 0.05;
            exactA1CameraTargetZ = exactA1JointCenterZ;
            const exactA1JointCameraVectorX = exactA1CameraPositionX - exactA1JointCenterX;
            const exactA1JointCameraVectorZ = exactA1CameraPositionZ - exactA1JointCenterZ;
            const exactA1JointCameraHorizontalDistance = Math.hypot(
              exactA1JointCameraVectorX,
              exactA1JointCameraVectorZ,
            );
            const exactA1JointSideOnCosine = Math.abs(
              (exactA1JointCameraVectorX * exactA1JointUnitX
                + exactA1JointCameraVectorZ * exactA1JointUnitZ)
                / exactA1JointCameraHorizontalDistance,
            );
            if (!(exactA1JointSideOnCosine < 0.55)) {
              throw new Error(\`A1 terminal-joint camera is not sufficiently side-on to the wall joint: \${exactA1JointSideOnCosine}\`);
            }
            renderer.domElement.dataset.inspectionCameraEndpointJointCenter = [
              exactA1JointCenterX, exactA1JointCenterY, exactA1JointCenterZ,
            ].map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointJointSpanMeters = exactA1JointSpan.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointApronDistanceMeters = exactA1JointApronDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointSideDistanceMeters = exactA1JointSideDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointSideOnCosine = exactA1JointSideOnCosine.toFixed(6);
          } else if (exactA1EvidenceSubview === "bogie-contact") {
            if (!exactA1BogieContactReady) {
              throw new Error("A1 bogie-contact close camera is missing the exact authored low-contact centroid");
            }
            const exactA1AircraftCenter = exactA1CameraAircraftBounds.getCenter(new THREE.Vector3());
            const exactA1BogieAwayFromAircraftX = exactA1BogieContactX - exactA1AircraftCenter.x;
            const exactA1BogieAwayFromAircraftZ = exactA1BogieContactZ - exactA1AircraftCenter.z;
            const exactA1BogieAwayFromAircraftLength = Math.hypot(
              exactA1BogieAwayFromAircraftX,
              exactA1BogieAwayFromAircraftZ,
            );
            const exactA1BogieAwayX = exactA1BogieAwayFromAircraftLength > 0.5
              ? exactA1BogieAwayFromAircraftX / exactA1BogieAwayFromAircraftLength
              : exactA1CameraSideX * exactA1CameraSideSign;
            const exactA1BogieAwayZ = exactA1BogieAwayFromAircraftLength > 0.5
              ? exactA1BogieAwayFromAircraftZ / exactA1BogieAwayFromAircraftLength
              : exactA1CameraSideZ * exactA1CameraSideSign;
            const exactA1BogieViewDistance = 6.8;
            exactA1CameraPositionX = exactA1BogieContactX
              + exactA1BogieAwayX * exactA1BogieViewDistance
              - exactA1CameraApronX * 0.9;
            exactA1CameraPositionY = exactA1BogieContactY + 2.75;
            exactA1CameraPositionZ = exactA1BogieContactZ
              + exactA1BogieAwayZ * exactA1BogieViewDistance
              - exactA1CameraApronZ * 0.9;
            exactA1CameraTargetX = exactA1BogieContactX;
            exactA1CameraTargetY = exactA1BogieContactY + 0.78;
            exactA1CameraTargetZ = exactA1BogieContactZ;
            const exactA1BogieCameraHorizontalX = exactA1CameraPositionX - exactA1BogieContactX;
            const exactA1BogieCameraHorizontalZ = exactA1CameraPositionZ - exactA1BogieContactZ;
            const exactA1BogieAircraftHorizontalX = exactA1AircraftCenter.x - exactA1BogieContactX;
            const exactA1BogieAircraftHorizontalZ = exactA1AircraftCenter.z - exactA1BogieContactZ;
            const exactA1BogieCameraHorizontalLength = Math.hypot(
              exactA1BogieCameraHorizontalX,
              exactA1BogieCameraHorizontalZ,
            );
            const exactA1BogieAircraftHorizontalLength = Math.hypot(
              exactA1BogieAircraftHorizontalX,
              exactA1BogieAircraftHorizontalZ,
            );
            const exactA1BogieAircraftOppositionCosine = exactA1BogieAircraftHorizontalLength > 0.5
              ? (exactA1BogieCameraHorizontalX * exactA1BogieAircraftHorizontalX
                + exactA1BogieCameraHorizontalZ * exactA1BogieAircraftHorizontalZ)
                / (exactA1BogieCameraHorizontalLength * exactA1BogieAircraftHorizontalLength)
              : -1;
            if (!(exactA1BogieAircraftOppositionCosine < -0.65)) {
              throw new Error(\`A1 bogie close camera is not on the jetway side of the aircraft: \${exactA1BogieAircraftOppositionCosine}\`);
            }
            renderer.domElement.dataset.inspectionCameraEndpointBogieContactCenter = [
              exactA1BogieContactX, exactA1BogieContactY, exactA1BogieContactZ,
            ].map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointBogieAircraftCenter = exactA1AircraftCenter
              .toArray().map((value) => value.toFixed(6)).join(",");
            renderer.domElement.dataset.inspectionCameraEndpointBogieAircraftOppositionCosine = exactA1BogieAircraftOppositionCosine.toFixed(6);
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
  "const exactA1JointUnitX",
  "const exactA1JointSideX",
  "const exactA1JointSideOnCosine",
  "inspectionCameraEndpointJointSideOnCosine",
  "const exactA1JointApronDistance",
  "const exactA1JointSideDistance",
  "const exactA1BogieContactX",
  "const exactA1AircraftCenter",
  "const exactA1BogieAircraftOppositionCosine",
  "uploadedJetwayBogieGroundContactCenterX",
  "inspectionCameraEndpointBogieContactCenter",
  "inspectionCameraEndpointBogieAircraftCenter",
  "inspectionCameraEndpointBogieAircraftOppositionCosine",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointJointSpanMeters",
  "inspectionCameraEndpointJointApronDistanceMeters",
  "inspectionCameraEndpointJointSideDistanceMeters",
  "inspectionCameraEndpointSubview = exactA1EvidenceSubview",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: exact A1 evidence subview v2 is missing ${token}`);
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
console.log("Prepared v2 A1 close evidence with a true wall-to-Rotunda side-on terminal frame and a bogie frame driven by the final transformed authored low-contact centroid.");
