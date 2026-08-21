import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-preserve-integrated-tunnel-c-carrier-v1";
const pitchMarker = "a1-photo-attached-state-pitch-envelope-v4-corrected-door-frame";
const modelTargetMarker = "a1-final-pitch-target-in-model-space-v3-corrected-door-frame";
const connectedCabPitchMarker = "a1-connected-cab-follows-bridge-pitch-v1";
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

if (!source.includes(connectedCabPitchMarker)) {
  const oldPitchFunction = `function applyPitchToTunnels(THREE, model, radians, pivotY, pivotZ) {\n  const correction = pitchAround(THREE, pivotY, pivotZ, radians);\n  // The passenger cab remains level while the telescoping tunnels slope to it.\n  // This matches real jetway articulation and avoids pitching the hood across the\n  // aircraft roof.\n  for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C"]) {\n    const part = findSourcePartRoot(model, name);\n    applyModelSpaceMatrix(THREE, model, part, correction);\n    part.userData.uploadedJetwayPitchRadians = radians;\n  }\n}`;
  const newPitchFunction = `function applyPitchToTunnels(THREE, model, radians, pivotY, pivotZ) {\n  // ${connectedCabPitchMarker}\n  // The Cab must travel with the end of Tunnel-C when the connected bridge changes\n  // pitch. The old implementation pitched A/B/C but left the Cab at its original Y,\n  // creating the exact 0.85 m disconnected Cab residual seen in the browser. Move the\n  // Cab rigidly through the same Rotunda-centered pitch arc, then counter-pitch it\n  // around its transformed rear hinge so the passenger hood remains level WITHOUT\n  // changing the Tunnel-C/Cab seam point.\n  const correction = pitchAround(THREE, pivotY, pivotZ, radians);\n  const cab = findSourcePartRoot(model, "Cab");\n  if (!cab) throw new Error("Supplied A1 jetway is missing Cab during connected pitch");\n  const cabBoxBefore = measureBounds(THREE, model, cab).box;\n  const cabCenterBefore = cabBoxBefore.getCenter(new THREE.Vector3());\n  const rotundaToCab = cabCenterBefore.clone().sub(new THREE.Vector3(0, pivotY, pivotZ)).setY(0);\n  if (rotundaToCab.lengthSq() < 0.25) throw new Error("Supplied A1 Cab direction is degenerate during connected pitch");\n  const cabBefore = measureCabAssembly(THREE, model, rotundaToCab.normalize());\n  const transformedRearHinge = cabBefore.rear.point.clone().applyMatrix4(correction);\n\n  for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]) {\n    const part = findSourcePartRoot(model, name);\n    applyModelSpaceMatrix(THREE, model, part, correction);\n    part.userData.uploadedJetwayPitchRadians = radians;\n  }\n\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    cab,\n    pitchAround(THREE, transformedRearHinge.y, transformedRearHinge.z, -radians),\n  );\n  cab.userData.uploadedJetwayCabLevelAfterPitch = true;\n}`;
  if (!source.includes(oldPitchFunction)) throw new Error(`${doorFitPath}: connected Cab pitch function anchor is missing`);
  source = source.replace(oldPitchFunction, newPitchFunction);
}

if (!source.includes(modelTargetMarker)) {
  const staleTarget = `  const targetYInAnchor = targetInParent.y - anchor.position.y;\n  const pitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInAnchor,\n  });`;
  const priorModelTarget = `  // a1-final-pitch-target-in-model-space-v1\n  // Pitch is solved in model-local coordinates, so the door target must be transformed\n  // into that same frame. Subtracting only anchor.position.y ignores the final model\n  // registration offset and created the visibly false 6.78-degree downhill bridge.\n  model.updateWorldMatrix(true, true);\n  const targetYInModel = model.worldToLocal(targetWorld.clone()).y;\n  const pitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const priorCappedTarget = `  // a1-final-pitch-target-in-model-space-v2\n  // Solve the door-implied pitch in the same model-local frame, but do NOT let that\n  // one-point solution drag the entire supplied Tunnel A/B/C mass down toward a CRJ.\n  // The Aug. 17 attached-state photos show a near-level main bridge with the Cab/hood\n  // doing the final door-height work. Preserve that visual/physical hierarchy here.\n  model.updateWorldMatrix(true, true);\n  const targetYInModel = model.worldToLocal(targetWorld.clone()).y;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });\n  const maximumPhotoAttachedPitchRadians = THREE.MathUtils.degToRad(3.5);\n  const pitchRadians = Math.min(requestedDoorPitchRadians, maximumPhotoAttachedPitchRadians);`;
  const modelTarget = `  // ${modelTargetMarker}\n  // The earlier 6.78-degree result was rejected because it had been computed across\n  // mismatched coordinate frames. The door target, Rotunda pivot and Cab threshold\n  // are now solved in one final model frame. The Cab itself follows the bridge pitch\n  // arc through ${connectedCabPitchMarker}, so a connected pitch correction cannot\n  // leave the hood behind and later demand a disconnected Cab-only vertical drop.\n  model.updateWorldMatrix(true, true);\n  const targetYInModel = model.worldToLocal(targetWorld.clone()).y;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });\n  const maximumPhotoAttachedPitchRadians = THREE.MathUtils.degToRad(7.0);\n  const pitchRadians = Math.min(requestedDoorPitchRadians, maximumPhotoAttachedPitchRadians);`;
  if (source.includes(priorCappedTarget)) source = source.replace(priorCappedTarget, modelTarget);
  else if (source.includes(priorModelTarget)) source = source.replace(priorModelTarget, modelTarget);
  else if (source.includes(staleTarget)) source = source.replace(staleTarget, modelTarget);
  else throw new Error(`${doorFitPath}: A1 pitch-target block is missing`);
  source = source.replace(
    `  const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;`,
    `  const cabVerticalAdjustment = targetYInModel - cabAssembly.front.floorY;`,
  );
}

const pitchGuardPattern = /  \/\/ a1-(?:rendered-door-measured-pitch-envelope-v1|photo-attached-state-pitch-envelope-v2|photo-attached-state-pitch-envelope-v3)[\s\S]*?  if \(!\(pitchRadians > 0\.018 && pitchRadians [<]=? [^)]+\)\) \{\n    throw new Error\(`Supplied A1 [^`]*`\);\n  \}/;
const oldPitchGuard = `  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {\n    throw new Error(\`Supplied A1 corrected pitch is outside the physical range: \${pitchRadians}\`);\n  }`;
const newPitchGuard = `  // ${pitchMarker}\n  // Fail closed on the applied connected-bridge pitch. The corrected same-frame\n  // door solution may be steeper than the prior 3.5-degree artificial cap, but it\n  // may never exceed 7 degrees and must still pass the final bogie/reference views.\n  if (!(pitchRadians > 0.018 && pitchRadians <= maximumPhotoAttachedPitchRadians + 1e-6)) {\n    throw new Error(\`Supplied A1 connected bridge pitch is outside the bounded attached range: \${THREE.MathUtils.radToDeg(pitchRadians)} deg\`);\n  }`;
if (pitchGuardPattern.test(source)) source = source.replace(pitchGuardPattern, newPitchGuard);
else if (source.includes(oldPitchGuard)) source = source.replace(oldPitchGuard, newPitchGuard);
else if (!source.includes(pitchMarker)) throw new Error(`${doorFitPath}: final pitch guard is not recognizable`);

const telemetryNeedle = `    pitchDegrees: THREE.MathUtils.radToDeg(pitchRadians),`;
if (source.includes(telemetryNeedle) && !source.includes("requestedDoorPitchDegrees")) {
  source = source.replace(telemetryNeedle, `${telemetryNeedle}\n    requestedDoorPitchDegrees: THREE.MathUtils.radToDeg(requestedDoorPitchRadians),`);
}

for (const required of [marker, pitchMarker, modelTargetMarker, connectedCabPitchMarker, 'object.name === "Tunnel_C_Jetway_0"', "maximumPhotoAttachedPitchRadians", "degToRad(7.0)", "targetYInModel", "requestedDoorPitchRadians", 'for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"])']) {
  if (!source.includes(required)) throw new Error(`${doorFitPath}: final A1 carrier/pitch preservation is missing ${required}`);
}
for (const forbidden of ["pitchRadians < 0.14", "a1-rendered-door-measured-pitch-envelope-v1", "targetYInAnchor", "degToRad(3.5)", 'for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C"]) {']) {
  if (source.includes(forbidden)) throw new Error(`${doorFitPath}: stale A1 pitch target/guard survived: ${forbidden}`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker} + ${modelTargetMarker} + ${pitchMarker} + ${connectedCabPitchMarker}: the Cab now follows the connected bridge pitch arc while remaining level at its transformed hinge; isolated Cab drops remain tightly bounded.`);
