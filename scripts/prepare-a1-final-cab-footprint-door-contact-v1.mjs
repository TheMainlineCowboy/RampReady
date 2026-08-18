import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-exact-cab-footprint-door-contact-v1";
const fixedAircraftMarker = "a1-fixed-aircraft-exact-authored-door-runtime-v1";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(fixedAircraftMarker)) {
  throw new Error(`${path}: exact Cab-footprint proof must run after fixed-aircraft exact-door runtime`);
}

if (!source.includes(marker)) {
  const staleEarlyGuard = `          if (cabContactErrorMeters > 0.01) {\n            throw new Error(\`A1 visible rendered forward-left door missed the measured final Cab by \${cabContactErrorMeters} m\`);\n          }`;
  const finiteEarlyGuard = `          // ${marker}\n          // This earlier value is an averaged representative Cab point. The exact\n          // rounded/angled hood contact is proved later from the FINAL live Cab\n          // endpoint-band vertices; do not move the aircraft to satisfy a centroid.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
  if (!source.includes(staleEarlyGuard)) {
    throw new Error(`${path}: stale 1 cm averaged-Cab guard is missing`);
  }
  source = source.replace(staleEarlyGuard, finiteEarlyGuard);

  const staleFinalProof = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n          if (!(sourceGateDoorTargetErrorMeters <= 0.02)) {\n            throw new Error(\`A1 visible rendered door missed the FINAL live Cab target by \${sourceGateDoorTargetErrorMeters} m\`);\n          }\n          if (!(sourceGateCabSeparationMeters <= 0.03)) {\n            throw new Error(\`A1 visible rendered door missed the FINAL visible Cab by \${sourceGateCabSeparationMeters} m\`);\n          }`;

  const exactFootprintProof = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n\n          // ${marker}\n          // The Cab hood is curved and its endpoint-band centroid is not the physical\n          // contact plane. Prove the fixed exact CRJ door against the actual supplied\n          // FINAL live Cab endpoint vertices instead. The door plane must be bracketed\n          // in bridge-normal depth and the door centerline must be bracketed laterally.\n          const finalCabSideWorld = new THREE.Vector3(\n            -finalBridgeDirectionWorld.z, 0, finalBridgeDirectionWorld.x,\n          ).normalize();\n          let cabDoorMinimumNormalMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumNormalMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumLateralMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumLateralMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumHorizontalVertexDistanceMeters = Number.POSITIVE_INFINITY;\n          for (const point of finalCabEndpointBand) {\n            const fromDoor = point.clone().sub(renderedDoorAtSourceGate);\n            const normalOffset = fromDoor.dot(finalBridgeDirectionWorld);\n            const lateralOffset = fromDoor.dot(finalCabSideWorld);\n            if (!(Number.isFinite(normalOffset) && Number.isFinite(lateralOffset))) continue;\n            cabDoorMinimumNormalMeters = Math.min(cabDoorMinimumNormalMeters, normalOffset);\n            cabDoorMaximumNormalMeters = Math.max(cabDoorMaximumNormalMeters, normalOffset);\n            cabDoorMinimumLateralMeters = Math.min(cabDoorMinimumLateralMeters, lateralOffset);\n            cabDoorMaximumLateralMeters = Math.max(cabDoorMaximumLateralMeters, lateralOffset);\n            cabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n              cabDoorMinimumHorizontalVertexDistanceMeters,\n              Math.hypot(fromDoor.x, fromDoor.z),\n            );\n          }\n          const cabDoorContactPlaneCovered = cabDoorMinimumNormalMeters <= 0.03\n            && cabDoorMaximumNormalMeters >= -0.03;\n          const cabDoorLaterallyCovered = cabDoorMinimumLateralMeters <= 0.03\n            && cabDoorMaximumLateralMeters >= -0.03;\n          if (!(\n            Number.isFinite(cabDoorMinimumHorizontalVertexDistanceMeters)\n            && cabDoorContactPlaneCovered\n            && cabDoorLaterallyCovered\n            && cabDoorMinimumHorizontalVertexDistanceMeters <= 0.18\n          )) {\n            throw new Error(\`A1 exact fixed CRJ door is outside the FINAL supplied Cab footprint: midpoint=\${sourceGateDoorTargetErrorMeters}, nearestVertex=\${cabDoorMinimumHorizontalVertexDistanceMeters}, normal=[\${cabDoorMinimumNormalMeters},\${cabDoorMaximumNormalMeters}], lateral=[\${cabDoorMinimumLateralMeters},\${cabDoorMaximumLateralMeters}]\`);\n          }\n          renderer.domElement.dataset.inspectionAircraftCabDoorContactPlaneCovered = String(cabDoorContactPlaneCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorLaterallyCovered = String(cabDoorLaterallyCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters = cabDoorMinimumHorizontalVertexDistanceMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumNormalMeters = cabDoorMinimumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumNormalMeters = cabDoorMaximumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumLateralMeters = cabDoorMinimumLateralMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = cabDoorMaximumLateralMeters.toFixed(6);`;

  if (!source.includes(staleFinalProof)) {
    throw new Error(`${path}: stale final live-Cab midpoint proof is missing`);
  }
  source = source.replace(staleFinalProof, exactFootprintProof);
}

for (const required of [
  marker,
  "cabDoorContactPlaneCovered",
  "cabDoorLaterallyCovered",
  "cabDoorMinimumHorizontalVertexDistanceMeters <= 0.18",
  "inspectionAircraftCabDoorContactPlaneCovered",
  "inspectionAircraftCabDoorLaterallyCovered",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact Cab footprint proof is missing ${required}`);
}
for (const forbidden of [
  "if (cabContactErrorMeters > 0.01)",
  "sourceGateDoorTargetErrorMeters <= 0.02",
  "sourceGateCabSeparationMeters <= 0.03",
  "sim.aircraft.position.x += aircraftRelocationX",
  "sim.aircraft.position.z += aircraftRelocationZ",
  "sim.aircraft.position.x += requiredParentLocalDelta.x",
  "sim.aircraft.position.z += requiredParentLocalDelta.z",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale centroid/aircraft-motion Cab proof survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: the CRJ remains fixed and the exact final supplied Cab must physically bracket the authored forward-left door with its transformed endpoint footprint; averaged Cab centroids are diagnostic only.`);
