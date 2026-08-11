import fs from "node:fs";

await import(`./prepare-exact-fleet-hide-obsolete-fixed-walkways-v1.mjs?hide-obsolete-fixed-walkways=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-terminal-joint-rendered-ray-diagnostic-v1";
const clearSideAuthority = "a1-terminal-joint-open-wedge-unoccluded-t4-walk-v2";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const anchor = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";`;
  const replacement = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);

          // ${marker}
          // Keep the A1 terminal-joint evidence camera on the open apron-side
          // bisector. The Rotunda target and camera height remain unchanged and
          // no airport geometry, material, transform or visibility is modified.
          // Reject the frame if authored T4_WALK still occupies the near field.
          if (exactA1EvidenceSubview === "terminal-joint") {
            const isAuthoredT4WalkHit = (hit) => {
              let cursor = hit?.object || null;
              for (let depth = 0; cursor && depth < 8; depth += 1, cursor = cursor.parent) {
                if (/T4_WALK/i.test(cursor.name || "")) return true;
              }
              const materials = Array.isArray(hit?.object?.material)
                ? hit.object.material
                : [hit?.object?.material];
              return materials.some((material) => /T4_WALK/i.test(material?.name || ""));
            };

            const generatedBisectorCamera = camera.position.clone();
            const clearSideCandidate = new THREE.Vector3(
              cameraTarget.x * 2 - generatedBisectorCamera.x,
              generatedBisectorCamera.y,
              cameraTarget.z * 2 - generatedBisectorCamera.z,
            );
            exactA1CameraPositionX = clearSideCandidate.x;
            exactA1CameraPositionY = clearSideCandidate.y;
            exactA1CameraPositionZ = clearSideCandidate.z;
            desiredCamera.copy(clearSideCandidate);
            camera.position.copy(clearSideCandidate);
            camera.lookAt(cameraTarget);
            camera.updateMatrixWorld(true);

            const exactA1JointTargetDistance = camera.position.distanceTo(cameraTarget);
            if (!(exactA1JointTargetDistance > 8 && exactA1JointTargetDistance < 30)) {
              throw new Error(\`A1 clear-side terminal-joint camera distance is invalid: \${exactA1JointTargetDistance}\`);
            }

            const frameProbeCoordinates = [
              [-0.38, 0.40],
              [-0.19, 0.30],
              [0.00, 0.30],
              [0.19, 0.30],
              [0.38, 0.40],
              [0.00, 0.00],
            ];
            const nearFieldWalkwayHits = [];
            const frameProbeRaycaster = new THREE.Raycaster();
            for (const [x, y] of frameProbeCoordinates) {
              frameProbeRaycaster.setFromCamera(new THREE.Vector2(x, y), camera);
              const blocker = frameProbeRaycaster.intersectObjects(scene.children, true)
                .find((hit) => hit?.object?.visible !== false
                  && hit.distance < exactA1JointTargetDistance + 1.25
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
            if (nearFieldWalkwayHits.length) {
              throw new Error(\`A1 clear-side terminal-joint frame still has near-field T4_WALK coverage: \${JSON.stringify(nearFieldWalkwayHits)}\`);
            }

            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideAuthority = "${clearSideAuthority}";
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideFlipped = "true";
            renderer.domElement.dataset.inspectionCameraEndpointJointT4WalkOccluded = "false";
            renderer.domElement.dataset.inspectionCameraEndpointJointNearFieldProbeCount = String(frameProbeCoordinates.length);
          }
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";`;
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: A1 camera lock anchor is missing`);
  source = source.replace(anchor, replacement);
}

for (const token of [
  marker,
  clearSideAuthority,
  "cameraTarget.x * 2 - generatedBisectorCamera.x",
  "exactA1CameraPositionX = clearSideCandidate.x",
  "camera.updateMatrixWorld(true)",
  "const frameProbeCoordinates = [",
  "hit.distance < exactA1JointTargetDistance + 1.25",
  "near-field T4_WALK coverage",
  'inspectionCameraEndpointJointT4WalkOccluded = "false"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: A1 clear-side terminal-joint evidence is missing ${token}`);
}
if (source.includes("SLABRAY64:")) {
  throw new Error(`${trainerPath}: temporary A1 ray diagnostic console token remains`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("A1 terminal-joint evidence keeps the verified open bisector side and six near-field T4_WALK rejection probes without emitting the temporary diagnostic console token.");
