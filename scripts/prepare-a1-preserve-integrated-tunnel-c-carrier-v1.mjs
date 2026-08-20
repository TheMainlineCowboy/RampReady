import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-preserve-integrated-tunnel-c-carrier-v1";
const pitchMarker = "a1-photo-attached-state-pitch-envelope-v2";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";

let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(runtimeSupportMarker)) {
  throw new Error(`${doorFitPath}: Tunnel-C runtime support resolver must be installed before carrier preservation`);
}
if (!source.includes(finalVisibleMarker)) {
  throw new Error(`${doorFitPath}: final visible geometry normalization must run before carrier preservation`);
}

if (!source.includes(marker)) {
  const oldBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) throw new Error("Supplied A1 Tunnel-C grounding received no support mesh");\n\n  // a1-world-ramp-grounded-tunnel-c-detail-v1\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) > 0.001) {\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(\n      THREE, model, object,\n      translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z),\n    );\n  }\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\`Supplied A1 Tunnel-C detail failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`);\n  }\n  return {\n    corrected: Math.abs(rigidVerticalAdjustmentMeters) > 0.001,\n    minimumY: afterWorld.min.y,\n    maximumY: afterWorld.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;

  const newBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) throw new Error("Supplied A1 Tunnel-C grounding received no support mesh");\n\n  // ${marker}\n  // Never rigidly translate the opaque/integrated Tunnel-C carrier. It contains\n  // the passenger tunnel shell as well as the stair/bogie triangles; moving that\n  // entire mesh tears Tunnel-C away from Tunnel-A/B. Only genuinely separable\n  // support meshes may receive a grounding shift.\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const beforeSize = beforeWorld.getSize(new THREE.Vector3());\n  const maximumHorizontalDimension = Math.max(beforeSize.x, beforeSize.z);\n  const integratedCarrier = object.name === "Tunnel_C_Jetway_0"\n    || maximumHorizontalDimension > 6.5\n    || beforeSize.y > 5.5;\n  if (integratedCarrier) {\n    return { corrected: false, minimumY: beforeWorld.min.y, maximumY: beforeWorld.max.y, rigidVerticalAdjustmentMeters: 0, integratedCarrierPreserved: true };\n  }\n\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) > 0.001) {\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(THREE, model, object, translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z));\n  }\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\`Supplied A1 separable Tunnel-C support failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`);\n  }\n  return { corrected: Math.abs(rigidVerticalAdjustmentMeters) > 0.001, minimumY: afterWorld.min.y, maximumY: afterWorld.max.y, rigidVerticalAdjustmentMeters, integratedCarrierPreserved: false };\n}`;

  if (!source.includes(oldBlock)) throw new Error(`${doorFitPath}: final world-grounding block changed before integrated-carrier preservation`);
  source = source.replace(oldBlock, newBlock);
}

const pitchGuardPattern = /  \/\/ a1-rendered-door-measured-pitch-envelope-v1[\s\S]*?  if \(!\(pitchRadians > 0\.018 && pitchRadians < 0\.14\)\) \{\n    throw new Error\(`Supplied A1 corrected pitch is outside the measured physical range: \$\{pitchRadians\}`\);\n  \}/;
const oldPitchGuard = `  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {\n    throw new Error(\`Supplied A1 corrected pitch is outside the physical range: \${pitchRadians}\`);\n  }`;
const newPitchGuard = `  // ${pitchMarker}\n  // The Aug. 17 attached-state references show a near-level telescoping bridge,\n  // not the visibly steep ramp accepted by the old 8-degree ceiling. Keep the\n  // measured ~1.1-degree solution valid but reject any final attached pitch above\n  // 4 degrees so a bad Rotunda/door geometry cannot hide behind extreme slope.\n  const maximumPhotoAttachedPitchRadians = THREE.MathUtils.degToRad(4);\n  if (!(pitchRadians > 0.018 && pitchRadians < maximumPhotoAttachedPitchRadians)) {\n    throw new Error(\`Supplied A1 corrected pitch contradicts attached-state reference: \${THREE.MathUtils.radToDeg(pitchRadians)} deg\`);\n  }`;
if (pitchGuardPattern.test(source)) source = source.replace(pitchGuardPattern, newPitchGuard);
else if (source.includes(oldPitchGuard)) source = source.replace(oldPitchGuard, newPitchGuard);
else if (!source.includes(pitchMarker)) throw new Error(`${doorFitPath}: final pitch guard is not recognizable`);

for (const required of [marker, pitchMarker, 'object.name === "Tunnel_C_Jetway_0"', "maximumPhotoAttachedPitchRadians", "degToRad(4)"]) {
  if (!source.includes(required)) throw new Error(`${doorFitPath}: final A1 carrier/pitch preservation is missing ${required}`);
}
for (const forbidden of ["pitchRadians < 0.14", "a1-rendered-door-measured-pitch-envelope-v1"]) {
  if (source.includes(forbidden)) throw new Error(`${doorFitPath}: stale steep-pitch guard survived: ${forbidden}`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker} + ${pitchMarker}: preserved the integrated Tunnel-C carrier and limited final attached bridge pitch to the photo-authoritative <=4 degree envelope.`);
