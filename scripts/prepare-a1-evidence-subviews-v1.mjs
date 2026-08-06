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
          if (exactA1EvidenceSubview === "terminal-joint") {
            const exactA1JointCenterX = (exactA1CameraWallX + exactA1CameraRotundaX) * 0.5;
            const exactA1JointCenterY = (exactA1CameraWallY + exactA1CameraRotundaY) * 0.5;
            const exactA1JointCenterZ = (exactA1CameraWallZ + exactA1CameraRotundaZ) * 0.5;
            exactA1CameraPositionX = exactA1JointCenterX
              + exactA1CameraApronX * 8
              + exactA1CameraSideX * exactA1CameraSideSign * 12;
            exactA1CameraPositionY = Math.max(8, exactA1JointCenterY + 5.5);
            exactA1CameraPositionZ = exactA1JointCenterZ
              + exactA1CameraApronZ * 8
              + exactA1CameraSideZ * exactA1CameraSideSign * 12;
            exactA1CameraTargetX = exactA1JointCenterX;
            exactA1CameraTargetY = exactA1JointCenterY;
            exactA1CameraTargetZ = exactA1JointCenterZ;
          } else if (exactA1EvidenceSubview === "bogie-contact") {
            const exactA1BogieTargetX = exactA1CameraCabX - exactA1CameraApronX * 6;
            const exactA1BogieTargetZ = exactA1CameraCabZ - exactA1CameraApronZ * 6;
            exactA1CameraPositionX = exactA1BogieTargetX
              + exactA1CameraApronX * 7
              + exactA1CameraSideX * exactA1CameraSideSign * 10;
            exactA1CameraPositionY = 3.6;
            exactA1CameraPositionZ = exactA1BogieTargetZ
              + exactA1CameraApronZ * 7
              + exactA1CameraSideZ * exactA1CameraSideSign * 10;
            exactA1CameraTargetX = exactA1BogieTargetX;
            exactA1CameraTargetY = 1.1;
            exactA1CameraTargetZ = exactA1BogieTargetZ;
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
  "const exactA1BogieTargetX",
  "exactA1CameraCabX - exactA1CameraApronX * 6",
  "inspectionCameraEndpointSubview = exactA1EvidenceSubview",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: exact A1 evidence subview is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared deterministic full-assembly, terminal-joint, and low bogie-contact A1 evidence subviews from the exact final wall, Rotunda, Cab, and rendered-aircraft frame.");
