import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-world-wall-rotunda-cab-derived-camera-v1";
const marker = `inspectionCameraEndpointAuthority = "${authority}"`;
if (source.includes(marker)) {
  console.log("Exact endpoint-derived A1 evidence camera is already prepared.");
  process.exit(0);
}

const fixedPerspectiveBlock = `        if (inspectionPresetConfig?.cameraPosition && inspectionPresetConfig?.cameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.cameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.cameraTarget);
          camera.position.lerp(desiredCamera, 0.16);
          camera.lookAt(cameraTarget);
        } else {`;

const dynamicPerspectiveBlock = `        const exactA1CameraFleet = inspectionPresetConfig?.id === "a1Connection"
          ? environment.userData.authoredTerminal4Jetways
          : null;
        const exactA1CameraWallX = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldX);
        const exactA1CameraWallY = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldY);
        const exactA1CameraWallZ = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldZ);
        const exactA1CameraRotundaX = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalRotundaWorldX);
        const exactA1CameraRotundaY = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalRotundaWorldY);
        const exactA1CameraRotundaZ = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1FinalRotundaWorldZ);
        const exactA1CameraCabX = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1CameraCabY = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1CabContactWorldY);
        const exactA1CameraCabZ = Number(exactA1CameraFleet?.userData?.uploadedJetwayA1CabContactWorldZ);
        const exactA1CameraEndpointsReady = [
          exactA1CameraWallX, exactA1CameraWallY, exactA1CameraWallZ,
          exactA1CameraRotundaX, exactA1CameraRotundaY, exactA1CameraRotundaZ,
          exactA1CameraCabX, exactA1CameraCabY, exactA1CameraCabZ,
        ].every(Number.isFinite);
        if (exactA1CameraEndpointsReady) {
          const exactA1CameraAxisX = exactA1CameraCabX - exactA1CameraWallX;
          const exactA1CameraAxisZ = exactA1CameraCabZ - exactA1CameraWallZ;
          const exactA1CameraAxisLength = Math.hypot(exactA1CameraAxisX, exactA1CameraAxisZ);
          if (!(exactA1CameraAxisLength > 8 && exactA1CameraAxisLength < 70)) {
            throw new Error(\`A1 endpoint-derived camera received an invalid wall-to-Cab span: \${exactA1CameraAxisLength}\`);
          }
          const exactA1CameraApronX = exactA1CameraAxisX / exactA1CameraAxisLength;
          const exactA1CameraApronZ = exactA1CameraAxisZ / exactA1CameraAxisLength;
          const exactA1CameraSideX = exactA1CameraApronZ;
          const exactA1CameraSideZ = -exactA1CameraApronX;
          const exactA1CameraMidX = (exactA1CameraWallX + exactA1CameraCabX) * 0.5;
          const exactA1CameraMidZ = (exactA1CameraWallZ + exactA1CameraCabZ) * 0.5;
          const exactA1CameraPositiveScore = exactA1CameraMidX + exactA1CameraSideX * 36
            + exactA1CameraMidZ + exactA1CameraSideZ * 36;
          const exactA1CameraNegativeScore = exactA1CameraMidX - exactA1CameraSideX * 36
            + exactA1CameraMidZ - exactA1CameraSideZ * 36;
          const exactA1CameraSideSign = exactA1CameraPositiveScore >= exactA1CameraNegativeScore ? 1 : -1;
          const exactA1CameraPositionX = exactA1CameraMidX
            + exactA1CameraApronX * 18
            + exactA1CameraSideX * exactA1CameraSideSign * 38;
          const exactA1CameraPositionZ = exactA1CameraMidZ
            + exactA1CameraApronZ * 18
            + exactA1CameraSideZ * exactA1CameraSideSign * 38;
          const exactA1CameraPositionY = Math.max(16, exactA1CameraRotundaY + 13);
          const exactA1CameraTargetX = exactA1CameraMidX + exactA1CameraApronX * 8;
          const exactA1CameraTargetZ = exactA1CameraMidZ + exactA1CameraApronZ * 8;
          const exactA1CameraTargetY = Math.max(2.8, (exactA1CameraWallY + exactA1CameraCabY) * 0.5);
          desiredCamera.set(exactA1CameraPositionX, exactA1CameraPositionY, exactA1CameraPositionZ);
          cameraTarget.set(exactA1CameraTargetX, exactA1CameraTargetY, exactA1CameraTargetZ);
          camera.position.lerp(desiredCamera, 0.22);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointAuthority = "${authority}";
          renderer.domElement.dataset.inspectionCameraEndpointPosition = [
            exactA1CameraPositionX, exactA1CameraPositionY, exactA1CameraPositionZ,
          ].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointTarget = [
            exactA1CameraTargetX, exactA1CameraTargetY, exactA1CameraTargetZ,
          ].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointWall = [
            exactA1CameraWallX, exactA1CameraWallY, exactA1CameraWallZ,
          ].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointRotunda = [
            exactA1CameraRotundaX, exactA1CameraRotundaY, exactA1CameraRotundaZ,
          ].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointCab = [
            exactA1CameraCabX, exactA1CameraCabY, exactA1CameraCabZ,
          ].map((value) => value.toFixed(6)).join(",");
        } else if (inspectionPresetConfig?.cameraPosition && inspectionPresetConfig?.cameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.cameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.cameraTarget);
          camera.position.lerp(desiredCamera, 0.16);
          camera.lookAt(cameraTarget);
        } else {`;

if (!source.includes(fixedPerspectiveBlock)) {
  throw new Error(`${trainerPath}: fixed inspection camera runtime block is missing`);
}
source = source.replace(fixedPerspectiveBlock, dynamicPerspectiveBlock);

const fixedOverheadBlock = `        if (inspectionPresetConfig?.overheadCameraPosition && inspectionPresetConfig?.overheadCameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.overheadCameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.overheadCameraTarget);
          camera.position.lerp(desiredCamera, 0.22);
          camera.lookAt(cameraTarget);
        } else {`;
const dynamicOverheadBlock = `        const exactA1OverheadFleet = inspectionPresetConfig?.id === "a1Connection"
          ? environment.userData.authoredTerminal4Jetways
          : null;
        const exactA1OverheadWallX = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldX);
        const exactA1OverheadWallZ = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldZ);
        const exactA1OverheadCabX = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1OverheadCabZ = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1CabContactWorldZ);
        const exactA1OverheadReady = [
          exactA1OverheadWallX, exactA1OverheadWallZ, exactA1OverheadCabX, exactA1OverheadCabZ,
        ].every(Number.isFinite);
        if (exactA1OverheadReady) {
          const exactA1OverheadAxisX = exactA1OverheadCabX - exactA1OverheadWallX;
          const exactA1OverheadAxisZ = exactA1OverheadCabZ - exactA1OverheadWallZ;
          const exactA1OverheadAxisLength = Math.hypot(exactA1OverheadAxisX, exactA1OverheadAxisZ);
          if (!(exactA1OverheadAxisLength > 8 && exactA1OverheadAxisLength < 70)) {
            throw new Error(\`A1 endpoint-derived overhead camera received an invalid wall-to-Cab span: \${exactA1OverheadAxisLength}\`);
          }
          const exactA1OverheadApronX = exactA1OverheadAxisX / exactA1OverheadAxisLength;
          const exactA1OverheadApronZ = exactA1OverheadAxisZ / exactA1OverheadAxisLength;
          const exactA1OverheadTargetX = (exactA1OverheadWallX + exactA1OverheadCabX) * 0.5
            + exactA1OverheadApronX * 8;
          const exactA1OverheadTargetZ = (exactA1OverheadWallZ + exactA1OverheadCabZ) * 0.5
            + exactA1OverheadApronZ * 8;
          desiredCamera.set(exactA1OverheadTargetX, 78, exactA1OverheadTargetZ);
          cameraTarget.set(exactA1OverheadTargetX, 0, exactA1OverheadTargetZ);
          camera.position.lerp(desiredCamera, 0.3);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionOverheadCameraEndpointAuthority = "${authority}";
          renderer.domElement.dataset.inspectionOverheadCameraEndpointTarget = [
            exactA1OverheadTargetX, 0, exactA1OverheadTargetZ,
          ].map((value) => value.toFixed(6)).join(",");
        } else if (inspectionPresetConfig?.overheadCameraPosition && inspectionPresetConfig?.overheadCameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.overheadCameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.overheadCameraTarget);
          camera.position.lerp(desiredCamera, 0.22);
          camera.lookAt(cameraTarget);
        } else {`;
if (!source.includes(fixedOverheadBlock)) {
  throw new Error(`${trainerPath}: fixed overhead inspection camera runtime block is missing`);
}
source = source.replace(fixedOverheadBlock, dynamicOverheadBlock);

for (const token of [
  marker,
  `inspectionOverheadCameraEndpointAuthority = "${authority}"`,
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1CabContactWorldX",
  "exactA1CameraAxisLength > 8",
  "exactA1OverheadAxisLength > 8",
  "inspectionCameraEndpointPosition",
  "inspectionCameraEndpointTarget",
  "inspectionCameraEndpointWall",
  "inspectionCameraEndpointRotunda",
  "inspectionCameraEndpointCab",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: endpoint-derived A1 evidence camera is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Derived the A1 perspective and overhead evidence cameras from the exact final terminal wall, Rotunda and Cab endpoints, with fixed coordinates retained only as a fallback.");
