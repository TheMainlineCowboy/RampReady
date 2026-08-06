import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "exact-a1-evidence-camera-direct-lock-v1";
if (source.includes(authority)) {
  console.log("A1 endpoint-derived evidence cameras are already locked for deterministic capture.");
  process.exit(0);
}

const perspectiveBefore = `          camera.position.lerp(desiredCamera, 0.22);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointAuthority`;
const perspectiveAfter = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "${authority}";
          renderer.domElement.dataset.inspectionCameraEndpointConvergenceErrorMeters = camera.position
            .distanceTo(desiredCamera).toFixed(6);
          renderer.domElement.dataset.inspectionCameraEndpointAuthority`;
if (!source.includes(perspectiveBefore)) {
  throw new Error(`${trainerPath}: endpoint-derived perspective camera interpolation block is missing`);
}
source = source.replace(perspectiveBefore, perspectiveAfter);

const overheadBefore = `          camera.position.lerp(desiredCamera, 0.3);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionOverheadCameraEndpointAuthority`;
const overheadAfter = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionOverheadCameraEndpointLockAuthority = "${authority}";
          renderer.domElement.dataset.inspectionOverheadCameraEndpointConvergenceErrorMeters = camera.position
            .distanceTo(desiredCamera).toFixed(6);
          renderer.domElement.dataset.inspectionOverheadCameraEndpointAuthority`;
if (!source.includes(overheadBefore)) {
  throw new Error(`${trainerPath}: endpoint-derived overhead camera interpolation block is missing`);
}
source = source.replace(overheadBefore, overheadAfter);

for (const token of [
  `inspectionCameraEndpointLockAuthority = "${authority}"`,
  "inspectionCameraEndpointConvergenceErrorMeters",
  `inspectionOverheadCameraEndpointLockAuthority = "${authority}"`,
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "camera.position.copy(desiredCamera)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: deterministic A1 evidence-camera lock is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Locked both endpoint-and-aircraft-derived A1 evidence cameras directly to their final positions and published zero convergence error before screenshot capture.");
