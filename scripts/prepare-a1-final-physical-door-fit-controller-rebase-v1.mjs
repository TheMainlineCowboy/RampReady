import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const elbowPath = "src/environment/sourceRegisteredA1RenderedDoorElbowV4.js";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-physical-door-fit-controller-rebase-v1";
const contactNormalMarker = "a1-horizontal-contact-normal-validation-v1";
const modelFrameYawMarker = "a1-model-frame-aware-cab-yaw-v1";
const measuredCabFaceMarker = "a1-measured-cab-face-direction-v1";
const refinedSourceFaceMarker = "a1-refined-source-cab-face-v1";
const worldRampGroundMarker = "a1-world-ramp-grounded-tunnel-c-detail-v1";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";

let doorFitSource = fs.readFileSync(doorFitPath, "utf8");

if (!doorFitSource.includes(worldRampGroundMarker)) {
  const groundingNeedle = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) return { corrected: false, minimumY: NaN, maximumY: NaN };\n  const before = measureBounds(THREE, model, object).box;\n  if (before.min.y >= GROUND_CLEARANCE_METERS) {\n    return { corrected: false, minimumY: before.min.y, maximumY: before.max.y };\n  }\n\n  // Tunnel C's stair and bogie are exact triangle subsets of the supplied mesh,\n  // not independent authored articulation nodes. A small rigid vertical adjustment\n  // preserves every supplied vertex, material split and silhouette while placing\n  // the lowest source triangle at the pavement clearance plane.\n  const rigidVerticalAdjustmentMeters = GROUND_CLEARANCE_METERS - before.min.y;\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    object,\n    translationMatrix(THREE, 0, rigidVerticalAdjustmentMeters, 0),\n  );\n  const after = measureBounds(THREE, model, object).box;\n  return {\n    corrected: true,\n    minimumY: after.min.y,\n    maximumY: after.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;
  if (!doorFitSource.includes(groundingNeedle)) {
    throw new Error(`${doorFitPath}: model-local Tunnel-C grounding anchor is missing`);
  }
  const worldGroundingBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) throw new Error("Supplied A1 Tunnel-C grounding received no support mesh");\n\n  // ${worldRampGroundMarker}\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) > 0.001) {\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(\n      THREE, model, object,\n      translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z),\n    );\n  }\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\`Supplied A1 Tunnel-C detail failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`);\n  }\n  return {\n    corrected: Math.abs(rigidVerticalAdjustmentMeters) > 0.001,\n    minimumY: afterWorld.min.y,\n    maximumY: afterWorld.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;
  doorFitSource = doorFitSource.replace(groundingNeedle, worldGroundingBlock);
}

if (!doorFitSource.includes(runtimeSupportMarker)) {
  const resolverAnchor = `function restoreUnarticulatedSource(model) {`;
  if (!doorFitSource.includes(resolverAnchor)) {
    throw new Error(`${doorFitPath}: Tunnel-C support resolver insertion anchor is missing`);
  }
  const resolver = `// ${runtimeSupportMarker}\nfunction resolveTunnelCGroundedSupportMeshes(THREE, model) {\n  const tunnelC = findSourcePartRoot(model, "Tunnel_C") || model?.getObjectByName?.("Tunnel_C");\n  if (!tunnelC) throw new Error("Supplied A1 support resolver cannot find Tunnel_C");\n  model.updateWorldMatrix(true, true);\n  const candidates = [];\n  tunnelC.traverse((entry) => {\n    if (!entry.isMesh || entry.visible === false || !entry.geometry?.getAttribute?.("position")) return;\n    const box = measureBounds(THREE, model, entry).box;\n    const size = box.getSize(new THREE.Vector3());\n    candidates.push({ entry, box, size });\n  });\n  if (!candidates.length) throw new Error("Supplied A1 Tunnel_C exposes no measurable mesh descendants");\n  const minimumY = Math.min(...candidates.map(({ box }) => box.min.y));\n  const support = candidates.filter(({ box, size }) => {\n    const horizontalSpan = Math.hypot(size.x, size.z);\n    const maximumHorizontalDimension = Math.max(size.x, size.z);\n    return box.min.y <= minimumY + 0.80\n      && horizontalSpan >= 0.35\n      && maximumHorizontalDimension <= 6.5\n      && size.y <= 5.5;\n  });\n  if (!support.length) {\n    const diagnostic = candidates.map(({ entry, box, size }) => ({\n      name: entry.name || "unnamed",\n      minY: Number(box.min.y.toFixed(3)),\n      size: size.toArray().map((value) => Number(value.toFixed(3))),\n    }));\n    throw new Error(\`Supplied A1 Tunnel_C has no separable low support mesh: \${JSON.stringify(diagnostic)}\`);\n  }\n  return support.map(({ entry }) => entry);\n}\n\n`;
  doorFitSource = doorFitSource.replace(resolverAnchor, `${resolver}${resolverAnchor}`);

  const oldGrounding = `  const stair = model.getObjectByName("Tunnel_C_GalvanizedServiceStair_SourceTriangles");\n  const mechanical = model.getObjectByName("Tunnel_C_DarkBogieLift_SourceTriangles");\n  const stairGrounding = correctGroundedDetail(THREE, model, stair);\n  const mechanicalGrounding = correctGroundedDetail(THREE, model, mechanical);`;
  const newGrounding = `  const tunnelCSupportMeshes = resolveTunnelCGroundedSupportMeshes(THREE, model);\n  const tunnelCSupportGroundings = tunnelCSupportMeshes.map((supportMesh) =>\n    correctGroundedDetail(THREE, model, supportMesh));\n  const groundedMinimumY = Math.min(...tunnelCSupportGroundings.map((entry) => entry.minimumY));\n  const groundedMaximumY = Math.max(...tunnelCSupportGroundings.map((entry) => entry.maximumY));\n  const combinedGrounding = {\n    corrected: tunnelCSupportGroundings.some((entry) => entry.corrected),\n    minimumY: groundedMinimumY,\n    maximumY: groundedMaximumY,\n    supportMeshCount: tunnelCSupportMeshes.length,\n  };\n  const stairGrounding = combinedGrounding;\n  const mechanicalGrounding = combinedGrounding;`;
  if (!doorFitSource.includes(oldGrounding)) {
    throw new Error(`${doorFitPath}: invented Tunnel-C support-name grounding block is missing`);
  }
  doorFitSource = doorFitSource.replace(oldGrounding, newGrounding);
}

if (!doorFitSource.includes(refinedSourceFaceMarker)) {
  const sourceFaceNeedle = `  const sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);`;
  if (!doorFitSource.includes(sourceFaceNeedle)) throw new Error(`${doorFitPath}: initial Cab face measurement anchor is missing`);
  doorFitSource = doorFitSource.replace(sourceFaceNeedle, `  // ${refinedSourceFaceMarker}\n  let sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);\n  sourceFacingDirection.copy(sourceCab.frontOffset).setY(0).normalize();\n  sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);`);
}

if (!doorFitSource.includes(contactNormalMarker)) {
  const normalNeedle = `  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0).transformDirection(group.matrixWorld);\n  const actualCabNormalWorld = cabFacingDirection.clone().transformDirection(model.matrixWorld);`;
  if (!doorFitSource.includes(normalNeedle)) throw new Error(`${doorFitPath}: full-3D Cab normal validation anchor is missing`);
  doorFitSource = doorFitSource.replace(normalNeedle, `  // ${contactNormalMarker}\n  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0)\n    .transformDirection(group.matrixWorld).setY(0).normalize();\n  const actualCabNormalWorld = cabFacingDirection.clone()\n    .transformDirection(model.matrixWorld).setY(0).normalize();`);
}

if (!doorFitSource.includes(modelFrameYawMarker)) {
  const yawNeedle = `  const cabRelativeYawRadians = desiredCabDirectionAngle\n    - correctedYawRadians\n    - sourceCabDirectionAngle;`;
  if (!doorFitSource.includes(yawNeedle)) throw new Error(`${doorFitPath}: Cab relative-yaw solve anchor is missing`);
  doorFitSource = doorFitSource.replace(yawNeedle, `  // ${modelFrameYawMarker}\n  const modelForwardInAnchor = transformDirectionToParent(\n    THREE, model, new THREE.Vector3(0, 0, 1), anchor,\n  );\n  const modelYawInAnchor = angleFromPositiveZ(modelForwardInAnchor);\n  const cabRelativeYawRadians = desiredCabDirectionAngle\n    - correctedYawRadians\n    - modelYawInAnchor\n    - sourceCabDirectionAngle;`);
}

if (!doorFitSource.includes(measuredCabFaceMarker)) {
  const facingNeedle = `  const cabFacingDirection = sourceFacingDirection.clone()\n    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cabRelativeYawRadians)\n    .setY(0)\n    .normalize();`;
  if (!doorFitSource.includes(facingNeedle)) throw new Error(`${doorFitPath}: derived Cab facing-direction anchor is missing`);
  doorFitSource = doorFitSource.replace(facingNeedle, `  // ${measuredCabFaceMarker}\n  const cabFacingDirection = sourceCab.frontOffset.clone()\n    .setY(0).normalize()\n    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cabRelativeYawRadians)\n    .setY(0).normalize();`);
}
fs.writeFileSync(doorFitPath, doorFitSource, "utf8");

let fleetSource = fs.readFileSync(fleetPath, "utf8");
if (!fleetSource.includes(marker)) {
  const bindNeedle = "          controller.bind(anchor);";
  if (!fleetSource.includes(bindNeedle)) throw new Error(`${fleetPath}: A1 controller bind anchor is missing`);
  fleetSource = fleetSource.replace(bindNeedle, `${bindNeedle}\n          // ${marker}\n          anchor.uploadedJetwayModelSpaceController = controller;`);
  fs.writeFileSync(fleetPath, fleetSource, "utf8");
}

let elbowSource = fs.readFileSync(elbowPath, "utf8");
if (!elbowSource.includes(marker)) {
  const importNeedle = `import {\n  enforceSourceRegisteredA1RotundaElbow as enforceLegacySourceTargetElbow,\n} from "./sourceRegisteredA1RotundaElbowV3.js";`;
  if (!elbowSource.includes(importNeedle)) throw new Error(`${elbowPath}: source-registered A1 elbow import anchor is missing`);
  elbowSource = elbowSource.replace(importNeedle, `${importNeedle}\nimport { fitUploadedA1JetwayToRenderedCrjDoor } from "./uploadedAirportJetwayA1DoorFitV11.js";`);
  const returnNeedle = "  return Object.freeze({\n    ...legacy,";
  if (!elbowSource.includes(returnNeedle)) throw new Error(`${elbowPath}: final A1 rendered-door return anchor is missing`);
  const physicalFitBlock = `  // ${marker}\n  const physicalDoorFit = fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements);\n  const deploymentController = anchor.uploadedJetwayModelSpaceController;\n  if (!deploymentController?.bind || !deploymentController?.setDeployment) {\n    throw new Error("A1 final physical door fit cannot rebase the model-space deployment controller");\n  }\n  deploymentController.bind(anchor);\n  deploymentController.setDeployment(1);\n  model.updateWorldMatrix(true, true);\n  group.userData.uploadedJetwayA1FinalPhysicalDoorFitAuthority = physicalDoorFit.authority;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = physicalDoorFit.verticalGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorHorizontalGapMeters = physicalDoorFit.horizontalGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorVectorGapMeters = physicalDoorFit.vectorGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorPitchDegrees = physicalDoorFit.pitchDegrees;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorCabVerticalAdjustmentMeters = physicalDoorFit.cabVerticalAdjustmentMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorStairMinimumHeightMeters = physicalDoorFit.stairGrounding.minimumY;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorMechanicalMinimumHeightMeters = physicalDoorFit.mechanicalGrounding.minimumY;\n\n`;
  elbowSource = elbowSource.replace(returnNeedle, `${physicalFitBlock}${returnNeedle}`);
  fs.writeFileSync(elbowPath, elbowSource, "utf8");
}

fleetSource = fs.readFileSync(fleetPath, "utf8");
elbowSource = fs.readFileSync(elbowPath, "utf8");
doorFitSource = fs.readFileSync(doorFitPath, "utf8");
for (const requiredMarker of [
  marker, contactNormalMarker, modelFrameYawMarker, measuredCabFaceMarker,
  refinedSourceFaceMarker, worldRampGroundMarker, runtimeSupportMarker,
]) {
  if (!`${fleetSource}\n${elbowSource}\n${doorFitSource}`.includes(requiredMarker)) {
    throw new Error(`A1 final physical fit is missing ${requiredMarker}`);
  }
}
for (const required of [
  "resolveTunnelCGroundedSupportMeshes", "supportMeshCount", "targetWorldMinimumY = 0",
  "sourceFacingDirection.copy(sourceCab.frontOffset)", "fitUploadedA1JetwayToRenderedCrjDoor",
  "deploymentController.bind(anchor)", "MAX_CAB_NORMAL_ERROR_DEGREES",
  "MAX_CAB_FUSELAGE_PENETRATION_METERS",
]) {
  if (!`${fleetSource}\n${elbowSource}\n${doorFitSource}`.includes(required)) {
    throw new Error(`A1 final physical fit is missing ${required}`);
  }
}
for (const forbidden of [
  'model.getObjectByName("Tunnel_C_GalvanizedServiceStair_SourceTriangles")',
  'model.getObjectByName("Tunnel_C_DarkBogieLift_SourceTriangles")',
]) {
  if (doorFitSource.includes(forbidden)) throw new Error(`A1 physical fit still uses invented support node: ${forbidden}`);
}

console.log(`Installed ${marker} + ${runtimeSupportMarker}: A1 keeps its photo-authoritative fixed corridor/remote Rotunda, resolves real separable Tunnel-C support meshes from the exact supplied hierarchy, grounds those meshes on the actual world ramp, solves the Cab to the CRJ door, and rebases attached deployment.`);
