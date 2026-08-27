import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "a1-final-cab-door-normal-fit-v2-nearest-face-residual";
const currentCabProof = "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(currentCabProof)) {
  throw new Error(`${path}: current fixed-aircraft Cab proof is missing before door-normal fit`);
}

if (!source.includes(authority)) {
  const anchor = `            if (Math.abs(finalCabLateralCorrectionMeters) > 0.002) {\n              moveCabWorld(physical.side.clone().multiplyScalar(finalCabLateralCorrectionMeters));\n              physical = measurePhysicalCab();\n            }\n\n            let finalCabVerticalCorrectionMeters = 0;`;
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final Cab lateral-to-vertical articulation anchor is missing`);
  }

  const replacement = `            if (Math.abs(finalCabLateralCorrectionMeters) > 0.002) {\n              moveCabWorld(physical.side.clone().multiplyScalar(finalCabLateralCorrectionMeters));\n              physical = measurePhysicalCab();\n            }\n\n            // ${authority}\n            // The coarse normal/lateral envelopes can each bracket the door while no\n            // single rendered Cab-face vertex is actually close enough to the fixed CRJ\n            // doorway. Resolve only that small final horizontal residual from the real\n            // nearest door-facing vertex, then remeasure the actual rendered geometry.\n            // The aircraft and Tunnel-C carrier remain fixed and this correction is\n            // bounded so a bad connected-bridge placement cannot be hidden here.\n            let finalCabDoorNormalCorrectionMeters = 0;\n            let nearestFacePoint = null;\n            let nearestFaceDistance = Number.POSITIVE_INFINITY;\n            for (const point of physical.face) {\n              const dx = point.x - renderedDoorAtSourceGate.x;\n              const dz = point.z - renderedDoorAtSourceGate.z;\n              const distance = Math.hypot(dx, dz);\n              if (Number.isFinite(distance) && distance < nearestFaceDistance) {\n                nearestFaceDistance = distance;\n                nearestFacePoint = point.clone();\n              }\n            }\n            if (!nearestFacePoint || !Number.isFinite(nearestFaceDistance)) {\n              throw new Error("A1 final Cab nearest physical face point is unavailable");\n            }\n            if (nearestFaceDistance > 0.055) {\n              const finalCabResidualWorld = renderedDoorAtSourceGate.clone().sub(nearestFacePoint).setY(0);\n              finalCabDoorNormalCorrectionMeters = finalCabResidualWorld.length();\n              if (!Number.isFinite(finalCabDoorNormalCorrectionMeters)\n                || finalCabDoorNormalCorrectionMeters > 0.10) {\n                throw new Error(\`A1 final Cab nearest-face residual is too large for bounded hood articulation: \${finalCabDoorNormalCorrectionMeters} m; solve connected bridge yaw/telescope instead\`);\n              }\n              if (finalCabDoorNormalCorrectionMeters > 0.002) {\n                moveCabWorld(finalCabResidualWorld);\n                physical = measurePhysicalCab();\n              }\n            }\n\n            let finalCabVerticalCorrectionMeters = 0;`;
  source = source.replace(anchor, replacement);

  const telemetryAnchor = `            renderer.domElement.dataset.inspectionAircraftCabLateralCorrectionMeters = finalCabLateralCorrectionMeters.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabVerticalCorrectionMeters = finalCabVerticalCorrectionMeters.toFixed(6);`;
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${path}: final Cab correction telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `            renderer.domElement.dataset.inspectionAircraftCabLateralCorrectionMeters = finalCabLateralCorrectionMeters.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorNormalCorrectionMeters = finalCabDoorNormalCorrectionMeters.toFixed(6);\n            renderer.domElement.dataset.inspectionAircraftCabDoorNormalCorrectionAuthority = "${authority}";\n            renderer.domElement.dataset.inspectionAircraftCabVerticalCorrectionMeters = finalCabVerticalCorrectionMeters.toFixed(6);`,
  );
}

for (const required of [
  authority,
  "nearestFacePoint",
  "nearestFaceDistance",
  "finalCabDoorNormalCorrectionMeters > 0.10",
  "inspectionAircraftCabDoorNormalCorrectionMeters",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab nearest-face fit is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${authority}: a <=10 cm final horizontal residual from the actual nearest supplied Cab face vertex may be closed before the strict <=6 cm fixed-door proof, with aircraft and Tunnel-C fixed.`);
