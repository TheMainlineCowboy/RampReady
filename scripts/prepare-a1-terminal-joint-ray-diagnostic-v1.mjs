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
          // The v3 endpoint camera is regenerated on the terminal-side angle
          // bisector every frame. That mathematically valid side puts the real
          // authored T4_WALK in the foreground of the A1 close-up. For visual
          // acceptance, always use the horizontally opposite bisector: the
          // Rotunda remains the same target, camera height is unchanged, and no
          // airport geometry/material/visibility is touched. Then reject the
          // frame if T4_WALK still occupies the near field around the joint.
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

            // Keep one-shot object rays from this corrected view for human
            // review. T4_WALK may legitimately appear far behind the joint; the
            // acceptance gate above only forbids it at or in front of the joint.
            if (renderer.domElement.dataset.inspectionA1TerminalJointRayAuthority !== "${marker}") {
              const diagnosticRays = [
                [-0.306, 0.444],
                [-0.028, 0.444],
                [0.250, 0.444],
                [-0.028, 0.300],
              ];
              const raycaster = new THREE.Raycaster();
              const rayHits = diagnosticRays.map(([x, y]) => {
                raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
                const intersections = raycaster.intersectObjects(scene.children, true)
                  .filter((hit) => hit?.object?.visible !== false)
                  .slice(0, 6);
                return intersections.map((hit) => {
                  const materialList = Array.isArray(hit.object?.material)
                    ? hit.object.material
                    : [hit.object?.material];
                  const ancestry = [];
                  let cursor = hit.object;
                  for (let depth = 0; cursor && depth < 7; depth += 1, cursor = cursor.parent) {
                    ancestry.push(cursor.name || cursor.type || "unnamed");
                  }
                  return {
                    name: hit.object?.name || "unnamed",
                    type: hit.object?.type || "unknown",
                    materials: materialList.filter(Boolean).map((material) => material.name || "unnamed"),
                    ancestry,
                    distance: Number(hit.distance.toFixed(4)),
                    point: hit.point.toArray().map((value) => Number(value.toFixed(4))),
                  };
                });
              });
              const serializedRayHits = JSON.stringify(rayHits);
              renderer.domElement.dataset.inspectionA1TerminalJointRayAuthority = "${marker}";
              renderer.domElement.dataset.inspectionA1TerminalJointRayHits = serializedRayHits;
              console.error(\`SLABRAY64:\${btoa(serializedRayHits)}\`);
            }
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
  "const diagnosticRays = [",
  "raycaster.setFromCamera(new THREE.Vector2(x, y), camera)",
  "inspectionA1TerminalJointRayHits = serializedRayHits",
  "SLABRAY64:",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: A1 clear-side terminal-joint evidence is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("A1 terminal-joint evidence now always uses the opposite/open bisector side and fails closed if six frame probes find authored T4_WALK at or in front of the Rotunda; no airport geometry is hidden or moved.");
