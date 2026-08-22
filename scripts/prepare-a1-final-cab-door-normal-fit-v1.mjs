import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "a1-final-cab-door-normal-fit-v1";
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

  const replacement = `            if (Math.abs(finalCabLateralCorrectionMeters) > 0.002) {\n              moveCabWorld(physical.side.clone().multiplyScalar(finalCabLateralCorrectionMeters));\n              physical = measurePhysicalCab();\n            }\n\n            // ${authority}\n            // Lateral hood articulation can leave the entire door-facing face a few\n            // centimetres behind or beyond the fixed CRJ door plane. Correct only that\n            // remaining door-normal residual on the supplied Cab, remeasure the actual\n            // rendered vertices, and keep the aircraft plus Tunnel-C carrier fixed.\n            let finalCabDoorNormalCorrectionMeters = 0;\n            if (physical.maxNormal < -0.04) {\n              finalCabDoorNormalCorrectionMeters = 0.02 - physical.maxNormal;\n            } else if (physical.minNormal > 0.04) {\n              finalCabDoorNormalCorrectionMeters = -0.02 - physical.minNormal;\n            }\n            if (!Number.isFinite(finalCabDoorNormalCorrectionMeters)\n              || Math.abs(finalCabDoorNormalCorrectionMeters) > 0.22) {\n              throw new Error(\`A1 final Cab requires excessive door-normal hood articulation: \${finalCabDoorNormalCorrectionMeters} m from normal [\${physical.minNormal},\${physical.maxNormal}]; solve connected bridge telescope instead\`);\n            }\n            if (Math.abs(finalCabDoorNormalCorrectionMeters) > 0.002) {\n              const cabBoundsCenter = new THREE.Box3().setFromObject(finalA1Cab).getCenter(new THREE.Vector3());\n              const finalCabDoorward = renderedDoorAtSourceGate.clone().sub(cabBoundsCenter).setY(0);\n              if (finalCabDoorward.lengthSq() < 0.25) {\n                throw new Error("A1 final Cab door-normal correction direction is degenerate");\n              }\n              finalCabDoorward.normalize();\n              moveCabWorld(finalCabDoorward.multiplyScalar(finalCabDoorNormalCorrectionMeters));\n              physical = measurePhysicalCab();\n            }\n\n            let finalCabVerticalCorrectionMeters = 0;`;
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
  "finalCabDoorNormalCorrectionMeters",
  "inspectionAircraftCabDoorNormalCorrectionMeters",
  "Math.abs(finalCabDoorNormalCorrectionMeters) > 0.22",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab door-normal fit is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${authority}: the final supplied Cab may close only a bounded <=22 cm residual in the fixed-door normal axis, then the existing strict physical hood proof remeasures the rendered geometry.`);
