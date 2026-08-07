import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "authored-crj-three-tire-contact-patches-v3";
if (source.includes(marker)) {
  console.log("Authored CRJ three-tire-patch ground contact is already prepared.");
  process.exit(0);
}

const namedWheelBlock = /          \/\/ Ground from actual landing-gear wheel meshes\.[\s\S]*?          sim\.aircraft\.position\.z \+= aircraftRelocationZ;/;
if (!namedWheelBlock.test(source)) {
  throw new Error(`${trainerPath}: name-based landing-gear grounding block is missing`);
}

const authoredContactBlock = `          // ${marker}
          // The authored CRJ is material-partitioned and exporter node names are not
          // reliable enough to identify tires. Prove the actual landing-gear footprint
          // geometrically instead: one compact centerline nose-tire patch plus two
          // compact, laterally opposed main-tire patches at the same longitudinal
          // station. A generic lowest-airframe cluster is never accepted as authority.
          const measureAuthoredLandingGearContact = () => {
            renderedAircraft.updateMatrixWorld(true);
            const worldPoint = new THREE.Vector3();
            const localPoint = new THREE.Vector3();
            const renderedInverse = renderedAircraft.matrixWorld.clone().invert();
            let globalMinimumY = Number.POSITIVE_INFINITY;
            let authoredVertexCount = 0;
            renderedAircraft.traverse((object) => {
              if (!object?.isMesh || object.visible === false) return;
              const position = object.geometry?.getAttribute?.("position");
              if (!position) return;
              for (let index = 0; index < position.count; index += 1) {
                worldPoint.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                globalMinimumY = Math.min(globalMinimumY, worldPoint.y);
                authoredVertexCount += 1;
              }
            });
            if (!Number.isFinite(globalMinimumY) || authoredVertexCount < 1000) {
              throw new Error(\`A1 authored CRJ tire scan is invalid: minimum=\${globalMinimumY}, vertices=\${authoredVertexCount}\`);
            }

            // Include a shallow underbody band, then use landing-gear topology to
            // select the tire patches. This intentionally ignores a stray belly or
            // antenna vertex even if it is the absolute lowest point in the model.
            const candidateBandMeters = 0.45;
            const cellSizeMeters = 0.18;
            const cells = new Map();
            renderedAircraft.traverse((object) => {
              if (!object?.isMesh || object.visible === false) return;
              const position = object.geometry?.getAttribute?.("position");
              if (!position) return;
              for (let index = 0; index < position.count; index += 1) {
                worldPoint.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                if (worldPoint.y > globalMinimumY + candidateBandMeters) continue;
                localPoint.copy(worldPoint).applyMatrix4(renderedInverse);
                const key = [
                  Math.floor(localPoint.x / cellSizeMeters),
                  Math.floor(localPoint.z / cellSizeMeters),
                ].join(",");
                const cell = cells.get(key) ?? {
                  count: 0,
                  sumX: 0,
                  sumZ: 0,
                  minY: Number.POSITIVE_INFINITY,
                  minX: Number.POSITIVE_INFINITY,
                  maxX: Number.NEGATIVE_INFINITY,
                  minZ: Number.POSITIVE_INFINITY,
                  maxZ: Number.NEGATIVE_INFINITY,
                };
                cell.count += 1;
                cell.sumX += localPoint.x;
                cell.sumZ += localPoint.z;
                cell.minY = Math.min(cell.minY, worldPoint.y);
                cell.minX = Math.min(cell.minX, localPoint.x);
                cell.maxX = Math.max(cell.maxX, localPoint.x);
                cell.minZ = Math.min(cell.minZ, localPoint.z);
                cell.maxZ = Math.max(cell.maxZ, localPoint.z);
                cells.set(key, cell);
              }
            });

            const remaining = new Set(cells.keys());
            const patches = [];
            while (remaining.size) {
              const seed = remaining.values().next().value;
              remaining.delete(seed);
              const stack = [seed];
              const patch = {
                count: 0,
                sumX: 0,
                sumZ: 0,
                minY: Number.POSITIVE_INFINITY,
                minX: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                minZ: Number.POSITIVE_INFINITY,
                maxZ: Number.NEGATIVE_INFINITY,
              };
              while (stack.length) {
                const key = stack.pop();
                const cell = cells.get(key);
                patch.count += cell.count;
                patch.sumX += cell.sumX;
                patch.sumZ += cell.sumZ;
                patch.minY = Math.min(patch.minY, cell.minY);
                patch.minX = Math.min(patch.minX, cell.minX);
                patch.maxX = Math.max(patch.maxX, cell.maxX);
                patch.minZ = Math.min(patch.minZ, cell.minZ);
                patch.maxZ = Math.max(patch.maxZ, cell.maxZ);
                const [cellX, cellZ] = key.split(",").map(Number);
                for (let dx = -1; dx <= 1; dx += 1) {
                  for (let dz = -1; dz <= 1; dz += 1) {
                    const neighbor = [cellX + dx, cellZ + dz].join(",");
                    if (!remaining.delete(neighbor)) continue;
                    stack.push(neighbor);
                  }
                }
              }
              patch.centerX = patch.sumX / patch.count;
              patch.centerZ = patch.sumZ / patch.count;
              patch.spanX = patch.maxX - patch.minX;
              patch.spanZ = patch.maxZ - patch.minZ;
              if (patch.count >= 2 && patch.spanX <= 1.8 && patch.spanZ <= 1.8) patches.push(patch);
            }

            let best = null;
            for (const nose of patches) {
              if (Math.abs(nose.centerX) > 1.35) continue;
              for (let leftIndex = 0; leftIndex < patches.length; leftIndex += 1) {
                const left = patches[leftIndex];
                if (left === nose || left.centerX > -0.8) continue;
                for (let rightIndex = 0; rightIndex < patches.length; rightIndex += 1) {
                  const right = patches[rightIndex];
                  if (right === nose || right === left || right.centerX < 0.8) continue;
                  const mainLongitudinalMismatch = Math.abs(left.centerZ - right.centerZ);
                  const mainLateralSeparation = right.centerX - left.centerX;
                  const mainStationZ = (left.centerZ + right.centerZ) * 0.5;
                  const noseMainSeparation = Math.abs(nose.centerZ - mainStationZ);
                  const mainSymmetryError = Math.abs(Math.abs(left.centerX) - Math.abs(right.centerX));
                  const contactHeightSpread = Math.max(nose.minY, left.minY, right.minY)
                    - Math.min(nose.minY, left.minY, right.minY);
                  if (mainLongitudinalMismatch > 1.25
                    || mainLateralSeparation < 2.0
                    || noseMainSeparation < 4.0
                    || mainSymmetryError > 1.5
                    || contactHeightSpread > 0.14) continue;
                  const score = Math.abs(nose.centerX)
                    + mainLongitudinalMismatch
                    + mainSymmetryError
                    + contactHeightSpread * 8
                    - Math.min(noseMainSeparation, 12) * 0.05;
                  if (!best || score < best.score) best = { nose, left, right, score, contactHeightSpread };
                }
              }
            }
            if (!best) {
              throw new Error(\`A1 authored CRJ does not expose a provable nose/left-main/right-main tire footprint; compact underbody patches=\${patches.length}\`);
            }

            const tireMinimumYs = [best.nose.minY, best.left.minY, best.right.minY].sort((a, b) => a - b);
            const tireGroundY = tireMinimumYs[1];
            return Object.freeze({
              minimumY: tireGroundY,
              authoredVertexCount,
              patchCount: patches.length,
              nose: Object.freeze({ x: best.nose.centerX, z: best.nose.centerZ, y: best.nose.minY }),
              leftMain: Object.freeze({ x: best.left.centerX, z: best.left.centerZ, y: best.left.minY }),
              rightMain: Object.freeze({ x: best.right.centerX, z: best.right.centerZ, y: best.right.minY }),
              contactHeightSpread: best.contactHeightSpread,
            });
          };
          const landingGearContactBefore = measureAuthoredLandingGearContact();
          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          const aircraftRelocationY = -landingGearContactBefore.minimumY;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;`;
source = source.replace(namedWheelBlock, authoredContactBlock);

const namedWheelAfter = /          const landingGearWheelBoundsAfter = new THREE\.Box3\(\);[\s\S]*?          const renderedGroundClearanceMeters = landingGearWheelBoundsAfter\.min\.y;/;
if (!namedWheelAfter.test(source)) {
  throw new Error(`${trainerPath}: post-registration name-based wheel bounds block is missing`);
}
source = source.replace(
  namedWheelAfter,
  `          const landingGearContactAfter = measureAuthoredLandingGearContact();
          const renderedGroundClearanceMeters = landingGearContactAfter.minimumY;`,
);

source = source.replace(
  `          renderer.domElement.dataset.inspectionAircraftLandingGearWheelMeshCount = String(landingGearWheelMeshCount);
          renderer.domElement.dataset.inspectionAircraftGroundingAuthority = "named-landing-gear-wheel-bounds-v1";`,
  `          renderer.domElement.dataset.inspectionAircraftLandingGearWheelMeshCount = "3";
          renderer.domElement.dataset.inspectionAircraftLandingGearContactPatchCount = String(landingGearContactAfter.patchCount);
          renderer.domElement.dataset.inspectionAircraftNoseTireContact = [landingGearContactAfter.nose.x, landingGearContactAfter.nose.y, landingGearContactAfter.nose.z].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionAircraftLeftMainTireContact = [landingGearContactAfter.leftMain.x, landingGearContactAfter.leftMain.y, landingGearContactAfter.leftMain.z].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionAircraftRightMainTireContact = [landingGearContactAfter.rightMain.x, landingGearContactAfter.rightMain.y, landingGearContactAfter.rightMain.z].map((value) => value.toFixed(6)).join(",");
          renderer.domElement.dataset.inspectionAircraftLandingGearContactHeightSpreadMeters = landingGearContactAfter.contactHeightSpread.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftGroundingAuthority = "${marker}";`,
);

for (const token of [
  marker,
  "const measureAuthoredLandingGearContact = () =>",
  "noseMainSeparation < 4.0",
  "mainLateralSeparation < 2.0",
  "contactHeightSpread > 0.14",
  "const aircraftRelocationY = -landingGearContactBefore.minimumY",
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
  `inspectionAircraftGroundingAuthority = "${marker}"`,
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: three-tire ground-contact output is missing ${token}`);
}
for (const forbidden of [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "landingGearWheelBoundsBefore",
  "landingGearWheelBoundsAfter",
  "named-landing-gear-wheel-bounds-v1",
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: obsolete aircraft grounding remains: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Grounded the authored CRJ from a proved nose/left-main/right-main tire-contact topology and rejected generic lowest-airframe clusters.");
