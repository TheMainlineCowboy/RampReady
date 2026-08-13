import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-terminal-joint-aircraft-side-unoccluded-search-v1";
let source = fs.readFileSync(trainerPath, "utf8");

const startMarker = "          // a1-terminal-joint-apron-half-plane-rendered-validation-v2";
const endMarker = "          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0) {
  throw new Error(`${trainerPath}: apron-side A1 rendered validation block is missing before aircraft-side visibility search`);
}

const replacement = `          // ${marker}
          if (exactA1EvidenceSubview === "terminal-joint") {
            const exactA1RenderedWallX = exactA1CameraWallX - exactA1CameraRotundaX;
            const exactA1RenderedWallZ = exactA1CameraWallZ - exactA1CameraRotundaZ;
            const exactA1RenderedWallSpan = Math.hypot(exactA1RenderedWallX, exactA1RenderedWallZ);
            const exactA1RenderedWallUnitX = exactA1RenderedWallX / exactA1RenderedWallSpan;
            const exactA1RenderedWallUnitZ = exactA1RenderedWallZ / exactA1RenderedWallSpan;
            const exactA1RenderedCabX = exactA1CameraCabX - exactA1CameraRotundaX;
            const exactA1RenderedCabZ = exactA1CameraCabZ - exactA1CameraRotundaZ;
            const exactA1RenderedCabSpan = Math.hypot(exactA1RenderedCabX, exactA1RenderedCabZ);
            const exactA1RenderedCabUnitX = exactA1RenderedCabX / exactA1RenderedCabSpan;
            const exactA1RenderedCabUnitZ = exactA1RenderedCabZ / exactA1RenderedCabSpan;
            if (!(exactA1RenderedWallSpan > 0.5 && exactA1RenderedCabSpan > 8)) {
              throw new Error(\`A1 unoccluded evidence search received invalid wall/Cab spans: wall=\${exactA1RenderedWallSpan} cab=\${exactA1RenderedCabSpan}\`);
            }

            const isAuthoredT4WalkHit = (hit) => {
              let cursor = hit?.object || null;
              for (let depth = 0; cursor && depth < 8; depth += 1, cursor = cursor.parent) {
                if (/T4_WALK/i.test(cursor.name || "")) return true;
              }
              const materials = Array.isArray(hit?.object?.material) ? hit.object.material : [hit?.object?.material];
              return materials.some((material) => /T4_WALK/i.test(material?.name || ""));
            };
            const frameProbeCoordinates = [[-0.38,0.40],[-0.19,0.30],[0,0.30],[0.19,0.30],[0.38,0.40],[0,0]];
            const forwardShiftCandidatesMeters = [0, 4, 6, 8, 10, 12];
            const exactA1BaseCameraX = exactA1CameraPositionX;
            const exactA1BaseCameraY = exactA1CameraPositionY;
            const exactA1BaseCameraZ = exactA1CameraPositionZ;
            const candidateDiagnostics = [];
            let selectedCandidate = null;

            for (const forwardShiftMeters of forwardShiftCandidatesMeters) {
              const candidateX = exactA1BaseCameraX + exactA1RenderedCabUnitX * forwardShiftMeters;
              const candidateY = exactA1BaseCameraY;
              const candidateZ = exactA1BaseCameraZ + exactA1RenderedCabUnitZ * forwardShiftMeters;
              const cameraOffsetX = candidateX - exactA1CameraRotundaX;
              const cameraOffsetZ = candidateZ - exactA1CameraRotundaZ;
              const cameraOffsetLength = Math.hypot(cameraOffsetX, cameraOffsetZ);
              const cameraOutX = cameraOffsetX / cameraOffsetLength;
              const cameraOutZ = cameraOffsetZ / cameraOffsetLength;
              const apronHalfPlaneOffset = -(
                cameraOffsetX * exactA1RenderedWallUnitX
                  + cameraOffsetZ * exactA1RenderedWallUnitZ
              );
              const wallViewCosine = Math.abs(
                cameraOutX * exactA1RenderedWallUnitX
                  + cameraOutZ * exactA1RenderedWallUnitZ
              );
              const tunnelAViewCosine = Math.abs(
                cameraOutX * exactA1RenderedCabUnitX
                  + cameraOutZ * exactA1RenderedCabUnitZ
              );
              const branchViewImbalance = Math.abs(wallViewCosine - tunnelAViewCosine);
              if (!(apronHalfPlaneOffset > 2.5
                && wallViewCosine < 0.82
                && tunnelAViewCosine < 0.82
                && branchViewImbalance < 0.20)) {
                candidateDiagnostics.push({
                  forwardShiftMeters,
                  apronHalfPlaneOffset: Number(apronHalfPlaneOffset.toFixed(4)),
                  wallViewCosine: Number(wallViewCosine.toFixed(4)),
                  tunnelAViewCosine: Number(tunnelAViewCosine.toFixed(4)),
                  branchViewImbalance: Number(branchViewImbalance.toFixed(4)),
                  rejected: "branch-or-apron-contract",
                });
                continue;
              }

              camera.position.set(candidateX, candidateY, candidateZ);
              camera.lookAt(cameraTarget);
              camera.updateMatrixWorld(true);
              const targetDistance = camera.position.distanceTo(cameraTarget);
              const nearFieldWalkwayHits = [];
              const frameProbeRaycaster = new THREE.Raycaster();
              for (const [x, y] of frameProbeCoordinates) {
                frameProbeRaycaster.setFromCamera(new THREE.Vector2(x, y), camera);
                const blocker = frameProbeRaycaster.intersectObjects(scene.children, true)
                  .find((hit) => hit?.object?.visible !== false
                    && hit.distance < targetDistance - 0.45
                    && isAuthoredT4WalkHit(hit));
                if (blocker) {
                  nearFieldWalkwayHits.push({
                    x,
                    y,
                    name: blocker.object?.name || "unnamed",
                    distance: Number(blocker.distance.toFixed(4)),
                  });
                }
              }
              candidateDiagnostics.push({
                forwardShiftMeters,
                apronHalfPlaneOffset: Number(apronHalfPlaneOffset.toFixed(4)),
                wallViewCosine: Number(wallViewCosine.toFixed(4)),
                tunnelAViewCosine: Number(tunnelAViewCosine.toFixed(4)),
                branchViewImbalance: Number(branchViewImbalance.toFixed(4)),
                t4WalkHitCount: nearFieldWalkwayHits.length,
                t4WalkHits: nearFieldWalkwayHits,
              });
              if (nearFieldWalkwayHits.length === 0) {
                selectedCandidate = {
                  x: candidateX,
                  y: candidateY,
                  z: candidateZ,
                  forwardShiftMeters,
                  apronHalfPlaneOffset,
                  wallViewCosine,
                  tunnelAViewCosine,
                  branchViewImbalance,
                  cameraDistance: cameraOffsetLength,
                };
                break;
              }
            }

            if (!selectedCandidate) {
              throw new Error(\`A1 terminal-joint has no unobstructed aircraft-side apron camera: \${JSON.stringify(candidateDiagnostics)}\`);
            }

            exactA1CameraPositionX = selectedCandidate.x;
            exactA1CameraPositionY = selectedCandidate.y;
            exactA1CameraPositionZ = selectedCandidate.z;
            desiredCamera.set(exactA1CameraPositionX, exactA1CameraPositionY, exactA1CameraPositionZ);
            camera.position.copy(desiredCamera);
            camera.lookAt(cameraTarget);
            camera.updateMatrixWorld(true);

            renderer.domElement.dataset.inspectionCameraEndpointJointWallViewCosine = selectedCandidate.wallViewCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointTunnelAViewCosine = selectedCandidate.tunnelAViewCosine.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointBranchViewImbalance = selectedCandidate.branchViewImbalance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointApronDistanceMeters = selectedCandidate.apronHalfPlaneOffset.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointSideDistanceMeters = selectedCandidate.cameraDistance.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideAuthority = "a1-terminal-joint-apron-half-plane-unoccluded-v3";
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideFlipped = "false";
            renderer.domElement.dataset.inspectionCameraEndpointJointT4WalkOccluded = "false";
            renderer.domElement.dataset.inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters = selectedCandidate.apronHalfPlaneOffset.toFixed(6);
            renderer.domElement.dataset.inspectionCameraEndpointJointNearFieldProbeCount = String(frameProbeCoordinates.length);
            renderer.domElement.dataset.inspectionCameraEndpointJointAircraftSideShiftMeters = selectedCandidate.forwardShiftMeters.toFixed(2);
            renderer.domElement.dataset.inspectionCameraEndpointJointVisibilitySearchAuthority = "${marker}";
          }
`;

source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;

for (const forbidden of [
  "A1 apron-side terminal-joint frame still has near-field T4_WALK coverage",
  "a1-terminal-joint-apron-half-plane-rendered-validation-v2",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: retired single-position A1 visibility guard survived: ${forbidden}`);
  }
}
for (const required of [
  marker,
  "forwardShiftCandidatesMeters = [0, 4, 6, 8, 10, 12]",
  "A1 terminal-joint has no unobstructed aircraft-side apron camera",
  "inspectionCameraEndpointJointAircraftSideShiftMeters",
  "inspectionCameraEndpointJointVisibilitySearchAuthority",
  'inspectionCameraEndpointJointClearSideFlipped = "false"',
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: aircraft-side A1 visibility search is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared A1 terminal-joint evidence to search outward along the actual Cab/aircraft side for a T4_WALK-free apron view while preserving the source-owned wall, Rotunda and exact jetway geometry.");
