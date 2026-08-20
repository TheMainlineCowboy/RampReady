import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-exact-cab-footprint-door-contact-v3-hood-envelope";
const fixedAircraftMarker = "a1-fixed-aircraft-exact-authored-door-runtime-v1";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(fixedAircraftMarker)) {
  throw new Error(`${path}: exact Cab-footprint proof must run after fixed-aircraft exact-door runtime`);
}

const staleEarlyGuard = `          if (cabContactErrorMeters > 0.01) {\n            throw new Error(\`A1 visible rendered forward-left door missed the measured final Cab by \${cabContactErrorMeters} m\`);\n          }`;
const v1EarlyGuard = `          // a1-final-exact-cab-footprint-door-contact-v1\n          // This earlier value is an averaged representative Cab point. The exact\n          // rounded/angled hood contact is proved later from the FINAL live Cab\n          // endpoint-band vertices; do not move the aircraft to satisfy a centroid.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
const v2EarlyGuard = `          // a1-final-exact-cab-footprint-door-contact-v2\n          // This earlier value is an averaged representative Cab point. The exact\n          // rounded/angled hood contact is proved later from FINAL live Cab vertices\n          // oriented toward the fixed authored CRJ door; never move the aircraft to\n          // satisfy a centroid.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
const earlyMarker = `${marker}-representative-diagnostic`;
const finiteEarlyGuard = `          // ${earlyMarker}\n          // Representative Cab centroid is diagnostics only. Final acceptance uses\n          // the tight door-facing contact band plus the deeper physical hood envelope.\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
if (source.includes(staleEarlyGuard)) source = source.replace(staleEarlyGuard, finiteEarlyGuard);
else if (source.includes(v1EarlyGuard)) source = source.replace(v1EarlyGuard, finiteEarlyGuard);
else if (source.includes(v2EarlyGuard)) source = source.replace(v2EarlyGuard, finiteEarlyGuard);
else if (!source.includes(earlyMarker)) throw new Error(`${path}: averaged-Cab early guard anchor is missing`);

const staleFixedFinalGuard = `          if (!Number.isFinite(fixedFinalDoorHorizontalErrorMeters) || fixedFinalDoorHorizontalErrorMeters > 0.08) {\n            throw new Error(\`A1 FINAL live Cab missed the fixed exact authored CRJ door by \${fixedFinalDoorHorizontalErrorMeters} m\`);\n          }`;
const finiteFixedFinalGuard = `          if (!Number.isFinite(fixedFinalDoorHorizontalErrorMeters)) {\n            throw new Error("A1 FINAL live Cab representative-point error is not finite");\n          }`;
if (source.includes(staleFixedFinalGuard)) source = source.replace(staleFixedFinalGuard, finiteFixedFinalGuard);

const exactFootprintProof = `          const sourceGateDoorTargetErrorMeters = Math.hypot(\n            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,\n            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,\n          );\n          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(\n            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),\n          );\n\n          // ${marker}\n          // The rounded supplied Cab hood slopes back/down from its foremost contact\n          // edge. Use a tight 0.20 m band for normal/lateral contact-plane proof, but\n          // use the deeper 1.25 m physical hood envelope for vertical door coverage.\n          // This prevents an upper-shell front edge from falsely claiming the whole\n          // Cab sits above the CRJ door, without moving the aircraft or any geometry.\n          const finalCabBoundsCenter = new THREE.Box3().setFromObject(finalA1Cab)\n            .getCenter(new THREE.Vector3());\n          const finalCabDoorwardDirectionWorld = renderedDoorAtSourceGate.clone()\n            .sub(finalCabBoundsCenter).setY(0);\n          if (finalCabDoorwardDirectionWorld.lengthSq() < 0.25) {\n            throw new Error("A1 final Cab center-to-fixed-door direction is degenerate");\n          }\n          finalCabDoorwardDirectionWorld.normalize();\n          let finalCabDoorwardMaximumProjection = Number.NEGATIVE_INFINITY;\n          for (const point of finalCabVerticesWorld) {\n            finalCabDoorwardMaximumProjection = Math.max(\n              finalCabDoorwardMaximumProjection,\n              point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld),\n            );\n          }\n          const finalCabDoorFacingBand = finalCabVerticesWorld.filter((point) => (\n            finalCabDoorwardMaximumProjection\n              - point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld)\n          ) <= 0.20);\n          const finalCabDoorFacingHoodBand = finalCabVerticesWorld.filter((point) => (\n            finalCabDoorwardMaximumProjection\n              - point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld)\n          ) <= 1.25);\n          if (finalCabDoorFacingBand.length < 3 || finalCabDoorFacingHoodBand.length < 3) {\n            throw new Error("A1 final supplied Cab exposes no measurable door-facing hood envelope");\n          }\n          const finalCabSideWorld = new THREE.Vector3(\n            -finalCabDoorwardDirectionWorld.z, 0, finalCabDoorwardDirectionWorld.x,\n          ).normalize();\n          let cabDoorMinimumNormalMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumNormalMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumLateralMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumLateralMeters = Number.NEGATIVE_INFINITY;\n          let cabDoorMinimumHorizontalVertexDistanceMeters = Number.POSITIVE_INFINITY;\n          for (const point of finalCabDoorFacingBand) {\n            const fromDoor = point.clone().sub(renderedDoorAtSourceGate);\n            const normalOffset = fromDoor.dot(finalCabDoorwardDirectionWorld);\n            const lateralOffset = fromDoor.dot(finalCabSideWorld);\n            if (!(Number.isFinite(normalOffset) && Number.isFinite(lateralOffset))) continue;\n            cabDoorMinimumNormalMeters = Math.min(cabDoorMinimumNormalMeters, normalOffset);\n            cabDoorMaximumNormalMeters = Math.max(cabDoorMaximumNormalMeters, normalOffset);\n            cabDoorMinimumLateralMeters = Math.min(cabDoorMinimumLateralMeters, lateralOffset);\n            cabDoorMaximumLateralMeters = Math.max(cabDoorMaximumLateralMeters, lateralOffset);\n            cabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n              cabDoorMinimumHorizontalVertexDistanceMeters,\n              Math.hypot(fromDoor.x, fromDoor.z),\n            );\n          }\n          let cabDoorMinimumHeightMeters = Number.POSITIVE_INFINITY;\n          let cabDoorMaximumHeightMeters = Number.NEGATIVE_INFINITY;\n          for (const point of finalCabDoorFacingHoodBand) {\n            const heightOffset = point.y - renderedDoorAtSourceGate.y;\n            if (!Number.isFinite(heightOffset)) continue;\n            cabDoorMinimumHeightMeters = Math.min(cabDoorMinimumHeightMeters, heightOffset);\n            cabDoorMaximumHeightMeters = Math.max(cabDoorMaximumHeightMeters, heightOffset);\n          }\n          const cabDoorContactPlaneCovered = cabDoorMinimumNormalMeters <= 0.04\n            && cabDoorMaximumNormalMeters >= -0.04;\n          const cabDoorLaterallyCovered = cabDoorMinimumLateralMeters <= 0.05\n            && cabDoorMaximumLateralMeters >= -0.05;\n          const cabDoorVerticallyCovered = cabDoorMinimumHeightMeters <= 0.08\n            && cabDoorMaximumHeightMeters >= -0.08;\n          if (!(\n            Number.isFinite(cabDoorMinimumHorizontalVertexDistanceMeters)\n            && Number.isFinite(cabDoorMinimumHeightMeters)\n            && cabDoorContactPlaneCovered\n            && cabDoorLaterallyCovered\n            && cabDoorVerticallyCovered\n          )) {\n            throw new Error(\`A1 exact fixed CRJ door is outside the FINAL supplied Cab hood: legacyMidpoint=\${sourceGateDoorTargetErrorMeters}, nearestVertex=\${cabDoorMinimumHorizontalVertexDistanceMeters}, normal=[\${cabDoorMinimumNormalMeters},\${cabDoorMaximumNormalMeters}], lateral=[\${cabDoorMinimumLateralMeters},\${cabDoorMaximumLateralMeters}], hoodHeight=[\${cabDoorMinimumHeightMeters},\${cabDoorMaximumHeightMeters}]\`);\n          }\n          renderer.domElement.dataset.inspectionAircraftCabDoorContactAuthority = "${marker}";\n          renderer.domElement.dataset.inspectionAircraftCabDoorContactPlaneCovered = String(cabDoorContactPlaneCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorLaterallyCovered = String(cabDoorLaterallyCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorVerticallyCovered = String(cabDoorVerticallyCovered);\n          renderer.domElement.dataset.inspectionAircraftCabDoorFacingVertexCount = String(finalCabDoorFacingBand.length);\n          renderer.domElement.dataset.inspectionAircraftCabDoorHoodVertexCount = String(finalCabDoorFacingHoodBand.length);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters = cabDoorMinimumHorizontalVertexDistanceMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumNormalMeters = cabDoorMinimumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumNormalMeters = cabDoorMaximumNormalMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumLateralMeters = cabDoorMinimumLateralMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = cabDoorMaximumLateralMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHeightMeters = cabDoorMinimumHeightMeters.toFixed(6);\n          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumHeightMeters = cabDoorMaximumHeightMeters.toFixed(6);`;

// Build-order-safe replacement: late preparers can rewrite the prior marker text,
// but the sourceGateDoorTargetErrorMeters block and its final telemetry are stable
// semantic anchors. Replace that entire prior proof regardless of whether it was v1,
// v2, or another generated compatibility spelling.
if (!source.includes("finalCabDoorFacingBand")) {
  const startToken = "          const sourceGateDoorTargetErrorMeters = Math.hypot(";
  const start = source.indexOf(startToken);
  if (start < 0) throw new Error(`${path}: source-gate Cab proof start is missing`);

  const endCandidates = [
    "          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumHeightMeters = cabDoorMaximumHeightMeters.toFixed(6);",
    "          renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = cabDoorMaximumLateralMeters.toFixed(6);",
    "          renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters = cabDoorMinimumHorizontalVertexDistanceMeters.toFixed(6);",
  ];
  let end = -1;
  for (const endToken of endCandidates) {
    const candidate = source.indexOf(endToken, start);
    if (candidate >= 0) {
      end = candidate + endToken.length;
      break;
    }
  }
  if (end < 0) {
    // Older generated proofs may end immediately before the final source-gate pose
    // publication. Use that stable boundary rather than depending on old marker text.
    const boundaryCandidates = [
      "          const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point;",
      "          renderer.domElement.dataset.inspectionAircraftDoorRegistrationAuthority",
      "          renderer.domElement.dataset.inspectionAircraftDoorContact",
    ];
    for (const boundary of boundaryCandidates) {
      const candidate = source.indexOf(boundary, start + startToken.length);
      if (candidate > start) {
        end = candidate;
        break;
      }
    }
  }
  if (end < 0 || end <= start) throw new Error(`${path}: final live-Cab proof end is missing`);
  source = source.slice(0, start) + exactFootprintProof + source.slice(end);
}

for (const required of [
  marker,
  "finalCabDoorFacingBand",
  "finalCabDoorFacingHoodBand",
  "cabDoorContactPlaneCovered",
  "cabDoorLaterallyCovered",
  "cabDoorVerticallyCovered",
  "inspectionAircraftCabDoorHoodVertexCount",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact Cab hood proof is missing ${required}`);
}
for (const forbidden of [
  "if (cabContactErrorMeters > 0.01)",
  "fixedFinalDoorHorizontalErrorMeters > 0.08",
  "sourceGateDoorTargetErrorMeters <= 0.02",
  "sourceGateCabSeparationMeters <= 0.03",
  "sim.aircraft.position.x += aircraftRelocationX",
  "sim.aircraft.position.z += aircraftRelocationZ",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale centroid/aircraft-motion Cab proof survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: tight Cab face owns plane/lateral contact while the supplied rounded hood envelope owns vertical CRJ-door coverage; no geometry moved.`);
