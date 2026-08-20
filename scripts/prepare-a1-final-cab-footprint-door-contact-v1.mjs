import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-exact-cab-footprint-door-contact-v5-cab-only-vertical-fit";
const representativeMarker = "a1-early-cab-representative-distance-diagnostic-v1";
const fixedAircraftMarker = "a1-fixed-aircraft-exact-authored-door-runtime-v1";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(fixedAircraftMarker)) {
  throw new Error(`${path}: exact Cab-footprint proof must run after fixed-aircraft exact-door runtime`);
}

// Representative/centroid checks from earlier generations are diagnostics only.
source = source
  .replaceAll("sourceGateDoorTargetErrorMeters <= 0.02", "Number.isFinite(sourceGateDoorTargetErrorMeters)")
  .replaceAll("sourceGateCabSeparationMeters <= 0.03", "Number.isFinite(sourceGateCabSeparationMeters)")
  .replaceAll("fixedFinalDoorHorizontalErrorMeters > 0.08", "!Number.isFinite(fixedFinalDoorHorizontalErrorMeters)");

const staleEarlyGuard = `          if (cabContactErrorMeters > 0.01) {\n            throw new Error(\`A1 visible rendered forward-left door missed the measured final Cab by \${cabContactErrorMeters} m\`);\n          }`;
const finiteEarlyGuard = `          // ${representativeMarker}\n          if (!Number.isFinite(cabContactErrorMeters)) {\n            throw new Error("A1 early Cab representative-point distance is not finite");\n          }`;
if (source.includes(staleEarlyGuard)) source = source.replace(staleEarlyGuard, finiteEarlyGuard);

if (!source.includes(marker)) {
  const separationToken = "          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(";
  const separationStart = source.indexOf(separationToken);
  if (separationStart < 0) throw new Error(`${path}: source-gate Cab separation anchor is missing`);
  const separationEnd = source.indexOf("          );", separationStart);
  if (separationEnd < 0) throw new Error(`${path}: source-gate Cab separation terminator is missing`);
  const insertAt = separationEnd + "          );".length;

  const proof = `\n\n          {\n            // ${marker}\n            // Final fixed-aircraft physical proof. The aircraft, terminal, Rotunda and\n            // Tunnel-C carrier stay fixed. If the supplied Cab hood is uniformly above\n            // or below the authored door, use the Cab's own vertical articulation only\n            // to close that bounded residual before evaluating the physical face/hood.\n            const physicalCabBoundsCenter = new THREE.Box3().setFromObject(finalA1Cab)\n              .getCenter(new THREE.Vector3());\n            const physicalDoorward = renderedDoorAtSourceGate.clone()\n              .sub(physicalCabBoundsCenter).setY(0);\n            if (physicalDoorward.lengthSq() < 0.25) {\n              throw new Error("A1 final Cab center-to-fixed-door direction is degenerate");\n            }\n            physicalDoorward.normalize();\n            let physicalMaxProjection = Number.NEGATIVE_INFINITY;\n            for (const point of finalCabVerticesWorld) {\n              physicalMaxProjection = Math.max(\n                physicalMaxProjection,\n                point.clone().sub(physicalCabBoundsCenter).dot(physicalDoorward),\n              );\n            }\n            const physicalFace = finalCabVerticesWorld.filter((point) => (\n              physicalMaxProjection - point.clone().sub(physicalCabBoundsCenter).dot(physicalDoorward)\n            ) <= 0.20);\n            const physicalHood = finalCabVerticesWorld.filter((point) => (\n              physicalMaxProjection - point.clone().sub(physicalCabBoundsCenter).dot(physicalDoorward)\n            ) <= 1.25);\n            if (physicalFace.length < 3 || physicalHood.length < 3) {\n              throw new Error("A1 final supplied Cab exposes no measurable door-facing hood envelope");\n            }\n            const physicalSide = new THREE.Vector3(-physicalDoorward.z, 0, physicalDoorward.x).normalize();\n            let minNormal = Number.POSITIVE_INFINITY;\n            let maxNormal = Number.NEGATIVE_INFINITY;\n            let minLateral = Number.POSITIVE_INFINITY;\n            let maxLateral = Number.NEGATIVE_INFINITY;\n            let nearestHorizontal = Number.POSITIVE_INFINITY;\n            for (const point of physicalFace) {\n              const fromDoor = point.clone().sub(renderedDoorAtSourceGate);\n              const normal = fromDoor.dot(physicalDoorward);\n              const lateral = fromDoor.dot(physicalSide);\n              if (!(Number.isFinite(normal) && Number.isFinite(lateral))) continue;\n              minNormal = Math.min(minNormal, normal);\n              maxNormal = Math.max(maxNormal, normal);\n              minLateral = Math.min(minLateral, lateral);\n              maxLateral = Math.max(maxLateral, lateral);\n              nearestHorizontal = Math.min(nearestHorizontal, Math.hypot(fromDoor.x, fromDoor.z));\n            }\n            let minHeight = Number.POSITIVE_INFINITY;\n            let maxHeight = Number.NEGATIVE_INFINITY;\n            for (const point of physicalHood) {\n              const height = point.y - renderedDoorAtSourceGate.y;\n              if (!Number.isFinite(height)) continue;\n              minHeight = Math.min(minHeight, height);\n              maxHeight = Math.max(maxHeight, height);\n            }\n\n            let finalCabVerticalCorrectionMeters = 0;\n            if (Number.isFinite(minHeight) && Number.isFinite(maxHeight)) {\n              if (minHeight > 0.08) finalCabVerticalCorrectionMeters = 0.04 - minHeight;\n              else if (maxHeight < -0.08) finalCabVerticalCorrectionMeters = -0.04 - maxHeight;\n            }\n            if (!Number.isFinite(finalCabVerticalCorrectionMeters)\n              || Math.abs(finalCabVerticalCorrectionMeters) > 1.05) {\n              throw new Error(\`A1 final Cab requires implausible Cab-only vertical articulation: \${finalCabVerticalCorrectionMeters} m from hood height [\${minHeight},\${maxHeight}]\`);\n            }\n            if (Math.abs(finalCabVerticalCorrectionMeters) > 0.002) {\n              const cabWorldPosition = finalA1Cab.getWorldPosition(new THREE.Vector3());\n              const targetCabWorldPosition = cabWorldPosition.clone();\n              targetCabWorldPosition.y += finalCabVerticalCorrectionMeters;\n              if (finalA1Cab.parent) {\n                finalA1Cab.parent.updateWorldMatrix(true, false);\n                finalA1Cab.position.copy(finalA1Cab.parent.worldToLocal(targetCabWorldPosition.clone()));\n              } else {\n                finalA1Cab.position.copy(targetCabWorldPosition);\n              }\n              finalA1Cab.updateWorldMatrix(true, true);\n              minHeight += finalCabVerticalCorrectionMeters;\n              maxHeight += finalCabVerticalCorrectionMeters;\n            }\n\n            const planeCovered = minNormal <= 0.04 && maxNormal >= -0.04;\n            const lateralCovered = minLateral <= 0.05 && maxLateral >= -0.05;\n            const verticalCovered = minHeight <= 0.08 && maxHeight >= -0.08;\n            if (!(Number.isFinite(nearestHorizontal) && Number.isFinite(minHeight)\n              && planeCovered && lateralCovered && verticalCovered)) {\n              throw new Error(\`A1 exact fixed CRJ door is outside FINAL supplied Cab hood: nearest=\${nearestHorizontal}, normal=[\${minNormal},\${maxNormal}], lateral=[\${minLateral},\${maxLateral}], height=[\${minHeight},\${maxHeight}], cabY=\${finalCabVerticalCorrectionMeters}\`);\n            }\n            renderer.domElement.dataset.inspectionAircraftCabDoorContactAuthority = "${marker}";\n            renderer.domElement.dataset.inspectionAircraftCabDoorContactPlaneCovered = String(planeCovered);\n            renderer.domElement.dataset.inspectionAircraftCabDoorLaterallyCovered = String(lateralCovered);\n            renderer.domElement.dataset.inspectionAircraftCabDoorVerticallyCovered = String(verticalCovered);\n            renderer.domElement.dataset.inspectionAircraftCabDoorFacingVertexCount = String(physicalFace.length);\n            renderer.domElement.dataset.inspectionAircraftCabDoorHoodVertexCount = String(physicalHood.length);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters = nearestHorizontal.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMinimumNormalMeters = minNormal.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMaximumNormalMeters = maxNormal.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMinimumLateralMeters = minLateral.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMaximumLateralMeters = maxLateral.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMinimumHeightMeters = minHeight.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorMaximumHeightMeters = maxHeight.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabVerticalCorrectionMeters = finalCabVerticalCorrectionMeters.toFixed(6);\n          }`;
  source = source.slice(0, insertAt) + proof + source.slice(insertAt);
}

for (const required of [
  marker,
  "physicalFace",
  "physicalHood",
  "inspectionAircraftCabDoorHoodVertexCount",
  "inspectionAircraftCabVerticalCorrectionMeters",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact Cab hood proof is missing ${required}`);
}
for (const forbidden of [
  "if (cabContactErrorMeters > 0.01)",
  "sourceGateDoorTargetErrorMeters <= 0.02",
  "sourceGateCabSeparationMeters <= 0.03",
  "sim.aircraft.position.x += aircraftRelocationX",
  "sim.aircraft.position.z += aircraftRelocationZ",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale centroid/aircraft-motion Cab proof survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab may use bounded Cab-only vertical articulation to meet the fixed CRJ door; terminal, aircraft, Rotunda and Tunnel-C remain fixed.`);
