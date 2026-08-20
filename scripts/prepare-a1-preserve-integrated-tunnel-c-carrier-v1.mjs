import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-preserve-integrated-tunnel-c-carrier-v1";
const pitchMarker = "a1-photo-attached-state-pitch-envelope-v3";
const modelTargetMarker = "a1-final-pitch-target-in-model-space-v2";
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

if (!source.includes(modelTargetMarker)) {
  const staleTarget = `  const targetYInAnchor = targetInParent.y - anchor.position.y;\n  const pitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInAnchor,\n  });`;
  const priorModelTarget = `  // a1-final-pitch-target-in-model-space-v1\n  // Pitch is solved in model-local coordinates, so the door target must be transformed\n  // into that same frame. Subtracting only anchor.position.y ignores the final model\n  // registration offset and created the visibly false 6.78-degree downhill bridge.\n  model.updateWorldMatrix(true, true);\n  const targetYInModel = model.worldToLocal(targetWorld.clone()).y;\n  const pitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const modelTarget = `  // ${modelTargetMarker}\n  // Solve the door-implied pitch in the same model-local frame, but do NOT let that\n  // one-point solution drag the entire supplied Tunnel A/B/C mass down toward a CRJ.\n  // The Aug. 17 attached-state photos show a near-level main bridge with the Cab/hood\n  // doing the final door-height work. Preserve that visual/physical hierarchy here.\n  model.updateWorldMatrix(true, true);\n  const targetYInModel = model.worldToLocal(targetWorld.clone()).y;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });\n  const maximumPhotoAttachedPitchRadians = THREE.MathUtils.degToRad(3.5);\n  const pitchRadians = Math.min(requestedDoorPitchRadians, maximumPhotoAttachedPitchRadians);`;
  if (source.includes(priorModelTarget)) source = source.replace(priorModelTarget, modelTarget);
  else if (source.includes(staleTarget)) source = source.replace(staleTarget, modelTarget);
  else throw new Error(`${doorFitPath}: A1 pitch-target block is missing`);
  source = source.replace(
    `  const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;`,
    `  const cabVerticalAdjustment = targetYInModel - cabAssembly.front.floorY;`,
  );
}

const pitchGuardPattern = /  \/\/ a1-(?:rendered-door-measured-pitch-envelope-v1|photo-attached-state-pitch-envelope-v2)[\s\S]*?  if \(!\(pitchRadians > 0\.018 && pitchRadians < [^)]+\)\) \{\n    throw new Error\(`Supplied A1 corrected pitch[^`]*`\);\n  \}/;
const oldPitchGuard = `  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {\n    throw new Error(\`Supplied A1 corrected pitch is outside the physical range: \${pitchRadians}\`);\n  }`;
const newPitchGuard = `  // ${pitchMarker}\n  // Fail closed on the ACTUAL applied main-bridge pitch. The larger one-point door\n  // solution is diagnostic only because using it to rotate all three tunnel sections\n  // produced the visibly steep, pavement-buried assembly rejected by the user.\n  if (!(pitchRadians > 0.018 && pitchRadians <= maximumPhotoAttachedPitchRadians + 1e-6)) {\n    throw new Error(\`Supplied A1 applied pitch contradicts attached-state reference: \${THREE.MathUtils.radToDeg(pitchRadians)} deg\`);\n  }`;
if (pitchGuardPattern.test(source)) source = source.replace(pitchGuardPattern, newPitchGuard);
else if (source.includes(oldPitchGuard)) source = source.replace(oldPitchGuard, newPitchGuard);
else if (!source.includes(pitchMarker)) throw new Error(`${doorFitPath}: final pitch guard is not recognizable`);

const telemetryNeedle = `    pitchDegrees: THREE.MathUtils.radToDeg(pitchRadians),`;
if (source.includes(telemetryNeedle) && !source.includes("requestedDoorPitchDegrees")) {
  source = source.replace(telemetryNeedle, `${telemetryNeedle}\n    requestedDoorPitchDegrees: THREE.MathUtils.radToDeg(requestedDoorPitchRadians),`);
}

for (const required of [marker, pitchMarker, modelTargetMarker, 'object.name === "Tunnel_C_Jetway_0"', "maximumPhotoAttachedPitchRadians", "degToRad(3.5)", "targetYInModel", "requestedDoorPitchRadians"]) {
  if (!source.includes(required)) throw new Error(`${doorFitPath}: final A1 carrier/pitch preservation is missing ${required}`);
}
for (const forbidden of ["pitchRadians < 0.14", "a1-rendered-door-measured-pitch-envelope-v1", "targetYInAnchor"]) {
  if (source.includes(forbidden)) throw new Error(`${doorFitPath}: stale A1 pitch target/guard survived: ${forbidden}`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker} + ${modelTargetMarker} + ${pitchMarker}: preserved the integrated Tunnel-C carrier, kept the applied A1 main-bridge pitch within 3.5 degrees, and left the live Cab/hood fit to close the CRJ door-height residual.`);
