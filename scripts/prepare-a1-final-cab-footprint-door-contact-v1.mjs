import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-exact-cab-footprint-door-contact-v2";
const fixedAircraftMarker = "a1-fixed-aircraft-exact-authored-door-runtime-v1";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(fixedAircraftMarker)) {
  throw new Error(`${path}: exact Cab-footprint proof must run after fixed-aircraft exact-door runtime`);
}

// Remove the old representative-point guard. The final exact Cab proof below is
// geometric and fail-closed; the aircraft remains fixed throughout.
const staleEarlyGuard = `          if (cabContactErrorMeters > 0.01) {\n            throw new Error(\`A1 visible rendered forward-left door missed the measured final Cab by \${cabContactErrorMeters} m\`);\n          }`;
const v1EarlyGuard = `          // a1-final-exact-cab-footprint-door-contact-v1\n          // This earlier value is an averaged representative Cab point. The exact\n          // rounded/angled hood contact is proved later from the FINAL live Cab\n          // endpoint-band vertices; do not move the aircraft to satisfy a centroid.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
const finiteEarlyGuard = `          // ${marker}\n          // This earlier value is an averaged representative Cab point. The exact\n          // rounded/angled hood contact is proved later from FINAL live Cab vertices\n          // oriented toward the fixed authored CRJ door; never move the aircraft to\n          // satisfy a centroid.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
if (source.includes(staleEarlyGuard)) source = source.replace(staleEarlyGuard, finiteEarlyGuard);
else if (source.includes(v1EarlyGuard)) source = source.replace(v1EarlyGuard, finiteEarlyGuard);
else if (!source.includes(marker)) throw new Error(`${path}: averaged-Cab early guard anchor is missing`);

// The fixed-aircraft stage intentionally publishes the midpoint displacement but
// must not fail before the true Cab-surface test. A 4+ m value here can simply mean
// the old Tunnel-A-axis endpoint picker selected a rotated Cab side rather than its
// aircraft-facing hood. Keep it as diagnostics only; the door-facing surface test
// below is the physical authority.
const staleFixedFinalGuard = `          if (!Number.isFinite(fixedFinalDoorHorizontalErrorMeters) || fixedFinalDoorHorizontalErrorMeters > 0.08) {\n            throw new Error(\`A1 FINAL live Cab missed the fixed exact authored CRJ door by \${fixedFinalDoorHorizontalErrorMeters} m\`);\n          }`;
const finiteFixedFinalGuard = `          if (!Number.isFinite(fixedFinalDoorHorizontalErrorMeters)) {\n            throw new Error("A1 FINAL live Cab representative-point error is not finite");\n          }`;
if (source.includes(staleFixedFinalGuard)) source = source.replace(staleFixedFinalGuard, finiteFixedFinalGuard);

const staleFinalProof = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n          if (!(sourceGateDoorTargetErrorMeters <= 0.02)) {\n            throw new Error(\`A1 visible rendered door missed the FINAL live Cab target by \${sourceGateDoorTargetErrorMeters} m\`);\n          }\n          if (!(sourceGateCabSeparationMeters <= 0.03)) {\n            throw new Error(\`A1 visible rendered door missed the FINAL visible Cab by \${sourceGateCabSeparationMeters} m\`);\n          }`;
const v1FinalProofStart = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n\n          // a1-final-exact-cab-footprint-door-contact-v1`;

const exactFootprintProof = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n\n          // ${marker}\n          // Cab can yaw relative to Tunnel A. Therefore Tunnel-A-axis maximum\n          // projection is not a reliable way to identify the aircraft-facing hood.\n          // Point from the FINAL Cab's own bounds center toward the immovable exact\n          // authored CRJ door, select the supplied Cab vertices on that door-facing\n          // side, then require the door to lie within that physical surface footprint.\n          const finalCabBoundsCenter = new THREE.Box3().setFromObject(finalA1Cab)\n            .getCenter(new THREE.Vector3());\n          const finalCabDoorwardDirectionWorld = renderedDoorAtSourceGate.clone()\n            .sub(finalCabBoundsCenter).setY(0);\n          if (finalCabDoorwardDirectionWorld.lengthSq() < 0.25) {\n            throw new Error("A1 final Cab center-to-fixed-door direction is degenerate");\n          }\n          finalCabDoorwardDirectionWorld.normalize();\n          let finalCabDoorwardMaximumProjection = Number.NEGATIVE_INFINITY;\n          for (const point of finalCabVerticesWorld) {\n            finalCabDoorwardMaximumProjection = Math.max(\n              finalCabDoorwardMaximumProjection,\n              point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld),\n            );\n          }\n          const finalCabDoorFacingBand = finalCabVerticesWorld.filter((point) => (\n            finalCabDoorwardMaximumProjection\n              - point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld)\n          ) <= 0.20);\n          if (finalCabDoorFacingBand.length < 3) {\n            throw new Error("A1 final supplied Cab exposes no door-facing vertex band");\n          }\n          const finalCabSideWorld = new THREE.Vector3(\n            -finalCabDoorwardDirectionWorld.z, 0, finalCabDoorwardDirectionWorld.x,\n          ).normalize();\n          let cabDoorMinimumNormalMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumNormalMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumLateralMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumLateralMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumHeightMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumHeightMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumHorizontalVertexDistanceMeters = Number.POSITIVE_INFINITY;\n          for (const point of finalCabDoorFacingBand) {\n            const fromDoor = point.clone().sub(renderedDoorAtSourceGate);\n            const normalOffset = fromDoor.dot(finalCabDoorwardDirectionWorld);\n            const lateralOffset = fromDoor.dot(finalCabSideWorld);\n            if (!(Number.isFinite(normalOffset) && Number.isFinite(lateralOffset))) continue;\n            cabDoorMinimumNormalMeters = Math.min(cabDoorMinimumNormalMeters, normalOffset);\n            cabDoorMaximumNormalMeters = Math.max(cabDoorMaximumNormalMeters, normalOffset);\n            cabDoorMinimumLateralMeters = Math.min(cabDoorMinimumLateralMeters, lateralOffset);\n            cabDoorMaximumLateralMeters = Math.max(cabDoorMaximumLateralMeters, lateralOffset);\n            cabDoorMinimumHeightMeters = Math.min(cabDoorMinimumHeightMeters, point.y - renderedDoorAtSourceGate.y);\n            cabDoorMaximumHeightMeters = Math.max(cabDoorMaximumHeightMeters, point.y - renderedDoorAtSourceGate.y);\n            cabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n              cabDoorMinimumHorizontalVertexDistanceMeters,\n              Math.hypot(fromDoor.x, fromDoor.z),\n            );\n          }\n          const cabDoorContactPlaneCovered = cabDoorMinimumNormalMeters <= 0.04\n            && cabDoorMaximumNormalMeters >= -0.04;\n          const cabDoorLaterallyCovered = cabDoorMinimumLateralMeters <= 0.05\n            && cabDoorMaximumLateralMeters >= -0.05;\n          const cabDoorVerticallyCovered = cabDoorMinimumHeightMeters <= 0.08\n            && cabDoorMaximumHeightMeters >= -0.08;\n          if (!(\n            Number.isFinite(cabDoorMinimumHorizontalVertexDistanceMeters)\n            && cabDoorContactPlaneCovered\n            && cabDoorLaterallyCovered\n            && cabDoorVerticallyCovered\n          )) {\n            throw new Error(\`A1 exact fixed CRJ door is outside the FINAL supplied Cab surface: legacyMidpoint=\${sourceGateDoorTargetErrorMeters}, nearestVertex=\${cabDoorMinimumHorizontalVertexDistanceMeters}, normal=[\${cabDoorMinimumNormalMeters},\${cabDoorMaximumNormalMeters}], lateral=[\${cabDoorMinimumLateralMeters},\${cabDoorMaximumLateralMeters}], height=[\${cabDoorMinimumHeightMeters},\${cabDoorMaximumHeightMeters}]\`);\n          }\n          renderer.domElement.dataset.inspectionAircraftCabDoorContactPlaneCovered = String(cabDoorContactPlaneCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorLaterallyCovered = String(cabDoorLaterallyCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorVerticallyCovered = String(cabDoorVerticallyCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorFacingVertexCount = String(finalCabDoorFacingBand.length);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters = cabDoorMinimumHorizontalVertexDistanceMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumNormalMeters = cabDoorMinimumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumNormalMeters = cabDoorMaximumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumLateralMeters = cabDoorMinimumLateralMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = cabDoorMaximumLateralMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHeightMeters = cabDoorMinimumHeightMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumHeightMeters = cabDoorMaximumHeightMeters.toFixed(6);`;

if (source.includes(staleFinalProof)) {
  source = source.replace(staleFinalProof, exactFootprintProof);
} else if (source.includes(v1FinalProofStart)) {
  const start = source.indexOf(v1FinalProofStart);
  const endNeedle = `          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = cabDoorMaximumLateralMeters.toFixed(6);`;
  const endStart = source.indexOf(endNeedle, start);
  if (endStart < 0) throw new Error(`${path}: v1 Cab footprint proof end is missing`);
  source = source.slice(0, start) + exactFootprintProof + source.slice(endStart + endNeedle.length);
} else if (!source.includes(marker)) {
  throw new Error(`${path}: final live-Cab proof anchor is missing`);
}

for (const required of [
  marker,
  "finalCabDoorwardDirectionWorld",
  "finalCabDoorFacingBand",
  "cabDoorContactPlaneCovered",
  "cabDoorLaterallyCovered",
  "cabDoorVerticallyCovered",
  "inspectionAircraftCabDoorContactPlaneCovered",
  "inspectionAircraftCabDoorVerticallyCovered",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact Cab surface proof is missing ${required}`);
}
for (const forbidden of [
  "if (cabContactErrorMeters > 0.01)",
  "fixedFinalDoorHorizontalErrorMeters > 0.08",
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
console.log(`Prepared ${marker}: the CRJ remains fixed and the exact final supplied Cab is evaluated on the physical hood surface facing the authored forward-left door, independent of Tunnel-A-axis centroid selection.`);
