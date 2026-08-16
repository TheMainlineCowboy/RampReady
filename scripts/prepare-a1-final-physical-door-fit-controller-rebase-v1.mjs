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

let doorFitSource = fs.readFileSync(doorFitPath, "utf8");
if (!doorFitSource.includes(worldRampGroundMarker)) {
  const groundingNeedle = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) return { corrected: false, minimumY: NaN, maximumY: NaN };\n  const before = measureBounds(THREE, model, object).box;\n  if (before.min.y >= GROUND_CLEARANCE_METERS) {\n    return { corrected: false, minimumY: before.min.y, maximumY: before.max.y };\n  }\n\n  // Tunnel C's stair and bogie are exact triangle subsets of the supplied mesh,\n  // not independent authored articulation nodes. A small rigid vertical adjustment\n  // preserves every supplied vertex, material split and silhouette while placing\n  // the lowest source triangle at the pavement clearance plane.\n  const rigidVerticalAdjustmentMeters = GROUND_CLEARANCE_METERS - before.min.y;\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    object,\n    translationMatrix(THREE, 0, rigidVerticalAdjustmentMeters, 0),\n  );\n  const after = measureBounds(THREE, model, object).box;\n  return {\n    corrected: true,\n    minimumY: after.min.y,\n    maximumY: after.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;
  if (!doorFitSource.includes(groundingNeedle)) {
    throw new Error(`${doorFitPath}: model-local Tunnel-C grounding anchor is missing`);
  }
  const worldGroundingBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) return { corrected: false, minimumY: NaN, maximumY: NaN };\n\n  // ${worldRampGroundMarker}\n  // A1's exact supplied model carries a non-zero parent Y offset after final airport\n  // registration. Model-local Y therefore is not the ramp plane. Measure the visible\n  // support subset in scene world space and convert only the required world-up shift\n  // back into model space before applying it. This keeps the exact triangles intact\n  // while putting their lowest visible point on the actual ramp (world Y = 0).\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) <= 0.001) {\n    return {\n      corrected: false,\n      minimumY: beforeWorld.min.y,\n      maximumY: beforeWorld.max.y,\n      rigidVerticalAdjustmentMeters: 0,\n    };\n  }\n\n  const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n  const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n  const localOrigin = model.worldToLocal(worldOrigin.clone());\n  const shiftedLocal = model.worldToLocal(shiftedWorld);\n  const modelSpaceShift = shiftedLocal.sub(localOrigin);\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    object,\n    translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z),\n  );\n\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\n      \`Supplied A1 Tunnel-C detail failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`,\n    );\n  }\n  return {\n    corrected: true,\n    minimumY: afterWorld.min.y,\n    maximumY: afterWorld.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;
  doorFitSource = doorFitSource.replace(groundingNeedle, worldGroundingBlock);
}
if (!doorFitSource.includes(refinedSourceFaceMarker)) {
  const sourceFaceNeedle = `  const sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);`;
  if (!doorFitSource.includes(sourceFaceNeedle)) {
    throw new Error(`${doorFitPath}: initial Cab face measurement anchor is missing`);
  }
  const refinedSourceFaceBlock = `  // ${refinedSourceFaceMarker}\n  // The Rotunda-to-Cab centerline is only a coarse first selector. Refine it from\n  // the measured front-to-hinge face vector before any extension/yaw geometry is\n  // solved, then remeasure the actual contact and hinge planes in that direction.\n  let sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);\n  sourceFacingDirection.copy(sourceCab.frontOffset).setY(0).normalize();\n  sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);`;
  doorFitSource = doorFitSource.replace(sourceFaceNeedle, refinedSourceFaceBlock);
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
for (const requiredMarker of [marker, contactNormalMarker, modelFrameYawMarker, measuredCabFaceMarker, refinedSourceFaceMarker, worldRampGroundMarker]) {
  if (!`${fleetSource}\n${elbowSource}\n${doorFitSource}`.includes(requiredMarker)) throw new Error(`A1 final physical fit is missing ${requiredMarker}`);
}
for (const required of ["sourceFacingDirection.copy(sourceCab.frontOffset)", "targetWorldMinimumY = 0", "new THREE.Box3().setFromObject(object)", "fitUploadedA1JetwayToRenderedCrjDoor", "deploymentController.bind(anchor)", "MAX_CAB_NORMAL_ERROR_DEGREES", "MAX_CAB_FUSELAGE_PENETRATION_METERS"]) {
  if (!`${fleetSource}\n${elbowSource}\n${doorFitSource}`.includes(required)) throw new Error(`A1 final physical fit is missing ${required}`);
}

console.log(`Installed ${marker} + ${refinedSourceFaceMarker} + ${worldRampGroundMarker}: A1 keeps its photo-authoritative fixed corridor/remote Rotunda while the exact supplied movable bridge solves extension, yaw and contact from one refined measured Cab face, grounds Tunnel-C detail on the actual world ramp plane, and rebases attached deployment.`);
