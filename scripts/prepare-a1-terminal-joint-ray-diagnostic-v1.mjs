import fs from "node:fs";

await import(`./prepare-exact-fleet-hide-obsolete-fixed-walkways-v1.mjs?hide-obsolete-fixed-walkways=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-terminal-joint-rendered-ray-diagnostic-v1";
const clearSideAuthority = "a1-terminal-joint-open-wedge-unoccluded-t4-walk-v1";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const anchor = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";`;
  const replacement = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);

          // ${marker}
          // The final passenger-elbow camera can be regenerated later from the
          // exact wall/Rotunda/Cab endpoints. Prove that its line of sight to the
          // Rotunda is not blocked by the real authored T4_WALK. If the selected
          // angle-bisector side is blocked, reflect only the horizontal camera
          // position through the Rotunda target to the opposite/open apron side,
          // then fail closed if that side is also obstructed. No airport object,
          // material, transform or visibility is changed to make evidence pass.
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
            const findT4WalkBlocker = (origin, target) => {
              const sight = target.clone().sub(origin);
              const distance = sight.length();
              if (!(distance > 1)) throw new Error(\`A1 terminal-joint evidence line of sight is degenerate: \${distance}\`);
              const sightRay = new THREE.Raycaster(
                origin,
                sight.normalize(),
                0.05,
                Math.max(0.10, distance - 0.40),
              );
              return sightRay.intersectObjects(scene.children, true)
                .find((hit) => hit?.object?.visible !== false && isAuthoredT4WalkHit(hit)) || null;
            };

            const originalEvidenceCamera = camera.position.clone();
            const originalT4WalkBlocker = findT4WalkBlocker(originalEvidenceCamera, cameraTarget);
            if (originalT4WalkBlocker) {
              const clearSideCandidate = new THREE.Vector3(
                cameraTarget.x * 2 - originalEvidenceCamera.x,
                originalEvidenceCamera.y,
                cameraTarget.z * 2 - originalEvidenceCamera.z,
              );
              const oppositeT4WalkBlocker = findT4WalkBlocker(clearSideCandidate, cameraTarget);
              if (oppositeT4WalkBlocker) {
                throw new Error(\`A1 terminal-joint evidence camera is blocked by authored T4_WALK from both bisector sides: original=\${originalT4WalkBlocker.object?.name || "unnamed"} opposite=\${oppositeT4WalkBlocker.object?.name || "unnamed"}\`);
              }

              exactA1CameraPositionX = clearSideCandidate.x;
              exactA1CameraPositionY = clearSideCandidate.y;
              exactA1CameraPositionZ = clearSideCandidate.z;
              desiredCamera.copy(clearSideCandidate);
              camera.position.copy(clearSideCandidate);
              camera.lookAt(cameraTarget);
              renderer.domElement.dataset.inspectionCameraEndpointJointOriginalT4WalkBlocker = originalT4WalkBlocker.object?.name || "unnamed";
              const blockerMaterials = Array.isArray(originalT4WalkBlocker.object?.material)
                ? originalT4WalkBlocker.object.material
                : [originalT4WalkBlocker.object?.material];
              renderer.domElement.dataset.inspectionCameraEndpointJointOriginalT4WalkMaterial = blockerMaterials
                .filter(Boolean)
                .map((material) => material.name || "unnamed")
                .join(",");
              renderer.domElement.dataset.inspectionCameraEndpointJointClearSideFlipped = "true";
            } else {
              renderer.domElement.dataset.inspectionCameraEndpointJointClearSideFlipped = "false";
            }

            const finalT4WalkBlocker = findT4WalkBlocker(camera.position, cameraTarget);
            if (finalT4WalkBlocker) {
              throw new Error(\`A1 terminal-joint evidence camera still intersects authored T4_WALK after clear-side selection: \${finalT4WalkBlocker.object?.name || "unnamed"}\`);
            }
            renderer.domElement.dataset.inspectionCameraEndpointJointClearSideAuthority = "${clearSideAuthority}";
            renderer.domElement.dataset.inspectionCameraEndpointJointT4WalkOccluded = "false";

            // Retain a one-shot object diagnostic from the corrected camera so
            // fresh evidence records what is actually visible rather than what
            // the old obstructed camera happened to hit.
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
  "const findT4WalkBlocker = (origin, target) =>",
  "const originalT4WalkBlocker = findT4WalkBlocker(originalEvidenceCamera, cameraTarget)",
  "cameraTarget.x * 2 - originalEvidenceCamera.x",
  "exactA1CameraPositionX = clearSideCandidate.x",
  'inspectionCameraEndpointJointT4WalkOccluded = "false"',
  "const diagnosticRays = [",
  "raycaster.setFromCamera(new THREE.Vector2(x, y), camera)",
  "inspectionA1TerminalJointRayHits = serializedRayHits",
  "SLABRAY64:",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: A1 clear-side terminal-joint evidence is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("A1 terminal-joint evidence now fails closed on authored T4_WALK occlusion and automatically selects the unobstructed opposite bisector side without hiding or moving any airport geometry; corrected-camera ray evidence remains published for visual review.");
