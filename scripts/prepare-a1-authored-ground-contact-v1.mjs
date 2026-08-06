import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "authored-crj-lowest-geometry-contact-clusters-v2";
if (source.includes(marker)) {
  console.log("Authored CRJ landing-gear ground contact is already prepared.");
  process.exit(0);
}

const namedWheelBlock = /          \/\/ Ground from actual landing-gear wheel meshes\.[\s\S]*?          sim\.aircraft\.position\.z \+= aircraftRelocationZ;/;
if (!namedWheelBlock.test(source)) {
  throw new Error(`${trainerPath}: name-based landing-gear grounding block is missing`);
}

const authoredContactBlock = `          // ${marker}
          // The authored CRJ GLB is one node with material-partitioned primitives,
          // so its Three.js children are not guaranteed to be named wheel/tire.
          // Measure the exact lowest authored geometry instead, then require at
          // least three separated X/Z contact clusters (nose plus main gear).
          const measureAuthoredLandingGearContact = () => {
            renderedAircraft.updateMatrixWorld(true);
            let minimumY = Number.POSITIVE_INFINITY;
            let authoredVertexCount = 0;
            const point = new THREE.Vector3();
            renderedAircraft.traverse((object) => {
              if (!object?.isMesh || object.visible === false) return;
              const position = object.geometry?.getAttribute?.("position");
              if (!position) return;
              for (let index = 0; index < position.count; index += 1) {
                point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                minimumY = Math.min(minimumY, point.y);
                authoredVertexCount += 1;
              }
            });
            if (!Number.isFinite(minimumY) || authoredVertexCount < 1000) {
              throw new Error(\`A1 authored CRJ ground-contact scan is invalid: minimum=\${minimumY}, vertices=\${authoredVertexCount}\`);
            }

            const contactBandMeters = 0.08;
            const contactBounds = new THREE.Box3();
            const occupiedCells = new Set();
            let contactPointCount = 0;
            const cellSizeMeters = 0.45;
            renderedAircraft.traverse((object) => {
              if (!object?.isMesh || object.visible === false) return;
              const position = object.geometry?.getAttribute?.("position");
              if (!position) return;
              for (let index = 0; index < position.count; index += 1) {
                point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
                if (point.y > minimumY + contactBandMeters) continue;
                contactBounds.expandByPoint(point);
                occupiedCells.add([
                  Math.floor(point.x / cellSizeMeters),
                  Math.floor(point.z / cellSizeMeters),
                ].join(","));
                contactPointCount += 1;
              }
            });

            const remaining = new Set(occupiedCells);
            let contactClusterCount = 0;
            while (remaining.size) {
              contactClusterCount += 1;
              const first = remaining.values().next().value;
              remaining.delete(first);
              const stack = [first];
              while (stack.length) {
                const [cellX, cellZ] = stack.pop().split(",").map(Number);
                for (let dx = -1; dx <= 1; dx += 1) {
                  for (let dz = -1; dz <= 1; dz += 1) {
                    const neighbor = [cellX + dx, cellZ + dz].join(",");
                    if (!remaining.delete(neighbor)) continue;
                    stack.push(neighbor);
                  }
                }
              }
            }

            const contactSpan = contactBounds.getSize(new THREE.Vector3());
            if (contactBounds.isEmpty()
              || contactPointCount < 6
              || contactClusterCount < 3
              || contactSpan.x < 1
              || contactSpan.z < 4) {
              throw new Error(\`A1 authored CRJ does not expose a credible three-point landing-gear footprint: points=\${contactPointCount}, clusters=\${contactClusterCount}, span=\${contactSpan.x}x\${contactSpan.z}\`);
            }
            return Object.freeze({
              minimumY,
              contactPointCount,
              contactClusterCount,
              authoredVertexCount,
              spanX: contactSpan.x,
              spanZ: contactSpan.z,
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
  `          renderer.domElement.dataset.inspectionAircraftLandingGearWheelMeshCount = String(landingGearContactAfter.contactClusterCount);
          renderer.domElement.dataset.inspectionAircraftLandingGearContactPointCount = String(landingGearContactAfter.contactPointCount);
          renderer.domElement.dataset.inspectionAircraftLandingGearContactClusterCount = String(landingGearContactAfter.contactClusterCount);
          renderer.domElement.dataset.inspectionAircraftLandingGearContactSpanX = landingGearContactAfter.spanX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftLandingGearContactSpanZ = landingGearContactAfter.spanZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftGroundingAuthority = "${marker}";`,
);

for (const token of [
  marker,
  "const measureAuthoredLandingGearContact = () =>",
  "contactClusterCount < 3",
  "contactSpan.x < 1",
  "contactSpan.z < 4",
  "const aircraftRelocationY = -landingGearContactBefore.minimumY",
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "inspectionAircraftLandingGearContactClusterCount",
  `inspectionAircraftGroundingAuthority = "${marker}"`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: authored ground-contact output is missing ${token}`);
  }
}
for (const forbidden of [
  "landingGearWheelBoundsBefore",
  "landingGearWheelBoundsAfter",
  "landingGearWheelMeshCount < 3",
  "named-landing-gear-wheel-bounds-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete name-based wheel grounding remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Grounded the authored CRJ from exact lowest-geometry contact clusters, requiring a separated nose/main-gear footprint without relying on exporter node names.");
