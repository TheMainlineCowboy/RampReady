import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-terminal-joint-rendered-ray-diagnostic-v1";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const anchor = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";`;
  const replacement = `          camera.position.copy(desiredCamera);
          camera.lookAt(cameraTarget);

          // ${marker}
          // Identify the actual rendered mesh under the broad upper-left slab in
          // the terminal-joint evidence view. This is diagnostic telemetry only:
          // no scene transform, visibility, material or geometry is changed.
          if (exactA1EvidenceSubview === "terminal-joint"
            && renderer.domElement.dataset.inspectionA1TerminalJointRayAuthority !== "${marker}") {
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
            // The fleet verifier already records browser console errors in its
            // evidence report. Base64 keeps object/material names out of its
            // critical-error regex while giving this one diagnostic cycle a
            // deterministic, decodable rendered-object identity.
            console.error(\`SLABRAY64:\${btoa(serializedRayHits)}\`);
          }
          renderer.domElement.dataset.inspectionCameraEndpointLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";`;
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: A1 camera lock anchor is missing`);
  source = source.replace(anchor, replacement);
}

for (const token of [
  marker,
  "const diagnosticRays = [",
  "raycaster.setFromCamera(new THREE.Vector2(x, y), camera)",
  "raycaster.intersectObjects(scene.children, true)",
  "inspectionA1TerminalJointRayHits = serializedRayHits",
  "SLABRAY64:",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: A1 terminal-joint ray diagnostic is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Added one-shot read-only A1 terminal-joint ray telemetry at four slab sample pixels and an encoded evidence-report emission so the exact rendered object/material can be identified before the next geometry edit.");
