import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const marker = `inspectionCameraEndpointAuthority = "${authority}"`;
if (source.includes(marker)) {
  console.log("Exact endpoint-and-aircraft-derived A1 evidence camera is already prepared.");
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
        const exactA1CameraAircraft = inspectionPresetConfig?.id === "a1Connection"
          ? sim.aircraft.userData.realAircraftObject
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
        if (exactA1CameraEndpointsReady && exactA1CameraAircraft?.isObject3D) {
          sim.aircraft.updateMatrixWorld(true);
          exactA1CameraAircraft.updateMatrixWorld(true);
          const exactA1CameraAircraftBounds = new THREE.Box3().setFromObject(exactA1CameraAircraft);
          if (exactA1CameraAircraftBounds.isEmpty()) {
            throw new Error("A1 endpoint-derived camera received empty rendered-aircraft bounds");
          }
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
          const exactA1CameraFrameBounds = exactA1CameraAircraftBounds.clone();
          exactA1CameraFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1CameraWallX, exactA1CameraWallY, exactA1CameraWallZ,
          ));
          exactA1CameraFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1CameraRotundaX, exactA1CameraRotundaY, exactA1CameraRotundaZ,
          ));
          exactA1CameraFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1CameraCabX, exactA1CameraCabY, exactA1CameraCabZ,
          ));
          const exactA1CameraFrameCenter = exactA1CameraFrameBounds.getCenter(new THREE.Vector3());
          const exactA1CameraFrameSize = exactA1CameraFrameBounds.getSize(new THREE.Vector3());
          const exactA1CameraHorizontalExtent = Math.max(exactA1CameraFrameSize.x, exactA1CameraFrameSize.z);
          if (!(exactA1CameraHorizontalExtent > 20 && exactA1CameraHorizontalExtent < 90)) {
            throw new Error(\`A1 endpoint-derived camera received an invalid complete-scene extent: \${exactA1CameraHorizontalExtent}\`);
          }
          const exactA1CameraPositiveScore = exactA1CameraFrameCenter.x
            + exactA1CameraSideX * exactA1CameraHorizontalExtent
            + exactA1CameraFrameCenter.z
            + exactA1CameraSideZ * exactA1CameraHorizontalExtent;
          const exactA1CameraNegativeScore = exactA1CameraFrameCenter.x
            - exactA1CameraSideX * exactA1CameraHorizontalExtent
            + exactA1CameraFrameCenter.z
            - exactA1CameraSideZ * exactA1CameraHorizontalExtent;
          const exactA1CameraSideSign = exactA1CameraPositiveScore >= exactA1CameraNegativeScore ? 1 : -1;
          const exactA1CameraPositionX = exactA1CameraFrameCenter.x
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
          const exactA1CameraTargetY = Math.max(2.8, exactA1CameraFrameCenter.y);
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
          renderer.domElement.dataset.inspectionCameraEndpointAircraftBoundsMin = exactA1CameraAircraftBounds.min
            .toArray().map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointAircraftBoundsMax = exactA1CameraAircraftBounds.max
            .toArray().map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionCameraEndpointFrameSize = exactA1CameraFrameSize
            .toArray().map((value) => value.toFixed(6)).join(",");
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
        const exactA1OverheadAircraft = inspectionPresetConfig?.id === "a1Connection"
          ? sim.aircraft.userData.realAircraftObject
          : null;
        const exactA1OverheadWallX = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldX);
        const exactA1OverheadWallY = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldY);
        const exactA1OverheadWallZ = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldZ);
        const exactA1OverheadRotundaX = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalRotundaWorldX);
        const exactA1OverheadRotundaY = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalRotundaWorldY);
        const exactA1OverheadRotundaZ = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1FinalRotundaWorldZ);
        const exactA1OverheadCabX = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1OverheadCabY = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1CabContactWorldY);
        const exactA1OverheadCabZ = Number(exactA1OverheadFleet?.userData?.uploadedJetwayA1CabContactWorldZ);
        const exactA1OverheadReady = [
          exactA1OverheadWallX, exactA1OverheadWallY, exactA1OverheadWallZ,
          exactA1OverheadRotundaX, exactA1OverheadRotundaY, exactA1OverheadRotundaZ,
          exactA1OverheadCabX, exactA1OverheadCabY, exactA1OverheadCabZ,
        ].every(Number.isFinite) && exactA1OverheadAircraft?.isObject3D;
        if (exactA1OverheadReady) {
          sim.aircraft.updateMatrixWorld(true);
          exactA1OverheadAircraft.updateMatrixWorld(true);
          const exactA1OverheadFrameBounds = new THREE.Box3().setFromObject(exactA1OverheadAircraft);
          if (exactA1OverheadFrameBounds.isEmpty()) {
            throw new Error("A1 endpoint-derived overhead camera received empty rendered-aircraft bounds");
          }
          exactA1OverheadFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1OverheadWallX, exactA1OverheadWallY, exactA1OverheadWallZ,
          ));
          exactA1OverheadFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1OverheadRotundaX, exactA1OverheadRotundaY, exactA1OverheadRotundaZ,
          ));
          exactA1OverheadFrameBounds.expandByPoint(new THREE.Vector3(
            exactA1OverheadCabX, exactA1OverheadCabY, exactA1OverheadCabZ,
          ));
          const exactA1OverheadFrameCenter = exactA1OverheadFrameBounds.getCenter(new THREE.Vector3());
          const exactA1OverheadFrameSize = exactA1OverheadFrameBounds.getSize(new THREE.Vector3());
          const exactA1OverheadExtent = Math.max(exactA1OverheadFrameSize.x, exactA1OverheadFrameSize.z);
          if (!(exactA1OverheadExtent > 20 && exactA1OverheadExtent < 90)) {
            throw new Error(\`A1 endpoint-derived overhead camera received an invalid complete-scene extent: \${exactA1OverheadExtent}\`);
          }
          const exactA1OverheadHeight = Math.max(78, exactA1OverheadExtent * 2.15);
          desiredCamera.set(exactA1OverheadFrameCenter.x, exactA1OverheadHeight, exactA1OverheadFrameCenter.z);
          cameraTarget.set(exactA1OverheadFrameCenter.x, 0, exactA1OverheadFrameCenter.z);
          camera.position.lerp(desiredCamera, 0.3);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionOverheadCameraEndpointAuthority = "${authority}";
          renderer.domElement.dataset.inspectionOverheadCameraEndpointTarget = [
            exactA1OverheadFrameCenter.x, 0, exactA1OverheadFrameCenter.z,
          ].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionOverheadCameraEndpointFrameSize = exactA1OverheadFrameSize
            .toArray().map((value) => value.toFixed(6)).join(",");
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
  "sim.aircraft.userData.realAircraftObject",
  "exactA1CameraAircraftBounds",
  "exactA1CameraFrameBounds",
  "exactA1CameraHorizontalExtent > 20",
  "exactA1OverheadFrameBounds",
  "inspectionCameraEndpointPosition",
  "inspectionCameraEndpointTarget",
  "inspectionCameraEndpointWall",
  "inspectionCameraEndpointRotunda",
  "inspectionCameraEndpointCab",
  "inspectionCameraEndpointAircraftBoundsMin",
  "inspectionCameraEndpointAircraftBoundsMax",
  "inspectionCameraEndpointFrameSize",
  "inspectionOverheadCameraEndpointFrameSize",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: endpoint-and-aircraft-derived A1 evidence camera is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Derived the A1 perspective and overhead evidence cameras from the exact final terminal wall, Rotunda, Cab and rendered-aircraft world bounds, with fixed coordinates retained only as a fallback.");
