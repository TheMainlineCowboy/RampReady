import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const elbowPath = "src/environment/sourceRegisteredA1RenderedDoorElbowV4.js";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-physical-door-fit-controller-rebase-v1";
const contactNormalMarker = "a1-horizontal-contact-normal-validation-v1";
const modelFrameYawMarker = "a1-model-frame-aware-cab-yaw-v1";
const measuredCabFaceMarker = "a1-measured-cab-face-direction-v1";

let doorFitSource = fs.readFileSync(doorFitPath, "utf8");
if (!doorFitSource.includes(contactNormalMarker)) {
  const normalNeedle = `  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0).transformDirection(group.matrixWorld);\n  const actualCabNormalWorld = cabFacingDirection.clone().transformDirection(model.matrixWorld);`;
  if (!doorFitSource.includes(normalNeedle)) {
    throw new Error(`${doorFitPath}: full-3D Cab normal validation anchor is missing`);
  }
  const horizontalNormalBlock = `  // ${contactNormalMarker}\n  // The hinge/yaw solve above intentionally works in the horizontal ramp plane.\n  // Validate Cab heading and fuselage penetration in that same contact plane so\n  // aircraft-model pitch/roll cannot masquerade as a yaw error or penetration.\n  // The strict 2-degree normal and 0.30 m penetration limits remain unchanged.\n  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0)\n    .transformDirection(group.matrixWorld)\n    .setY(0)\n    .normalize();\n  const actualCabNormalWorld = cabFacingDirection.clone()\n    .transformDirection(model.matrixWorld)\n    .setY(0)\n    .normalize();`;
  doorFitSource = doorFitSource.replace(normalNeedle, horizontalNormalBlock);
}
if (!doorFitSource.includes(modelFrameYawMarker)) {
  const yawNeedle = `  const cabRelativeYawRadians = desiredCabDirectionAngle\n    - correctedYawRadians\n    - sourceCabDirectionAngle;`;
  if (!doorFitSource.includes(yawNeedle)) {
    throw new Error(`${doorFitPath}: Cab relative-yaw solve anchor is missing`);
  }
  const modelFrameYawBlock = `  // ${modelFrameYawMarker}\n  // sourceCabDirectionAngle is measured in model-local coordinates, while the\n  // desired direction lives in the anchor-parent frame. Account for the supplied\n  // model's own normalized yaw inside the anchor before solving the Cab hinge yaw.\n  const modelForwardInAnchor = transformDirectionToParent(\n    THREE,\n    model,\n    new THREE.Vector3(0, 0, 1),\n    anchor,\n  );\n  const modelYawInAnchor = angleFromPositiveZ(modelForwardInAnchor);\n  const cabRelativeYawRadians = desiredCabDirectionAngle\n    - correctedYawRadians\n    - modelYawInAnchor\n    - sourceCabDirectionAngle;`;
  doorFitSource = doorFitSource.replace(yawNeedle, modelFrameYawBlock);
}
if (!doorFitSource.includes(measuredCabFaceMarker)) {
  const facingNeedle = `  const cabFacingDirection = sourceFacingDirection.clone()\n    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cabRelativeYawRadians)\n    .setY(0)\n    .normalize();`;
  if (!doorFitSource.includes(facingNeedle)) {
    throw new Error(`${doorFitPath}: derived Cab facing-direction anchor is missing`);
  }
  const measuredFacingBlock = `  // ${measuredCabFaceMarker}\n  // Yaw is solved from the measured Cab front-to-hinge vector, so carry that same\n  // physical face direction forward for final face selection and normal validation.\n  // The Rotunda-to-Cab centerline is only a coarse source-side face selector.\n  const cabFacingDirection = sourceCab.frontOffset.clone()\n    .setY(0)\n    .normalize()\n    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cabRelativeYawRadians)\n    .setY(0)\n    .normalize();`;
  doorFitSource = doorFitSource.replace(facingNeedle, measuredFacingBlock);
}
fs.writeFileSync(doorFitPath, doorFitSource, "utf8");

let fleetSource = fs.readFileSync(fleetPath, "utf8");
if (!fleetSource.includes(marker)) {
  const bindNeedle = "          controller.bind(anchor);";
  if (!fleetSource.includes(bindNeedle)) {
    throw new Error(`${fleetPath}: A1 controller bind anchor is missing`);
  }
  fleetSource = fleetSource.replace(
    bindNeedle,
    `${bindNeedle}\n          // ${marker}\n          // Keep the controller reachable by the final photo/door-fit stage without\n          // putting a function-bearing object into userData/dataset telemetry.\n          anchor.uploadedJetwayModelSpaceController = controller;`,
  );
  fs.writeFileSync(fleetPath, fleetSource, "utf8");
}

let elbowSource = fs.readFileSync(elbowPath, "utf8");
if (!elbowSource.includes(marker)) {
  const importNeedle = `import {\n  enforceSourceRegisteredA1RotundaElbow as enforceLegacySourceTargetElbow,\n} from "./sourceRegisteredA1RotundaElbowV3.js";`;
  if (!elbowSource.includes(importNeedle)) {
    throw new Error(`${elbowPath}: source-registered A1 elbow import anchor is missing`);
  }
  elbowSource = elbowSource.replace(
    importNeedle,
    `${importNeedle}\nimport { fitUploadedA1JetwayToRenderedCrjDoor } from "./uploadedAirportJetwayA1DoorFitV11.js";`,
  );

  const returnNeedle = "  return Object.freeze({\n    ...legacy,";
  if (!elbowSource.includes(returnNeedle)) {
    throw new Error(`${elbowPath}: final A1 rendered-door return anchor is missing`);
  }
  const physicalFitBlock = `  // ${marker}\n  // The Aug. 15 photo registration owns the terminal facade, long fixed dogleg and\n  // remote Rotunda. Only after those are final may the exact supplied movable GLB\n  // articulate from that Rotunda to the rendered CRJ door. V11 pitches the authored\n  // Tunnel A/B/C hierarchy, keeps the Cab level at the sill, and counter-grounds the\n  // existing Tunnel-C stair/bogie source triangles; it does not move Terminal 4 or\n  // the aircraft and does not replace any supplied GLB geometry/textures.\n  const physicalDoorFit = fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements);\n  const deploymentController = anchor.uploadedJetwayModelSpaceController;\n  if (!deploymentController?.bind || !deploymentController?.setDeployment) {\n    throw new Error("A1 final physical door fit cannot rebase the model-space deployment controller");\n  }\n  // Re-snapshot the physically fitted child matrices. Attached deployment is 1, so\n  // subsequent training/evidence calls restore this correct fitted base instead of\n  // the stale pre-registration/high authored transforms captured during GLB load.\n  deploymentController.bind(anchor);\n  deploymentController.setDeployment(1);\n  model.updateWorldMatrix(true, true);\n  group.userData.uploadedJetwayA1FinalPhysicalDoorFitAuthority = physicalDoorFit.authority;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = physicalDoorFit.verticalGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorHorizontalGapMeters = physicalDoorFit.horizontalGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorVectorGapMeters = physicalDoorFit.vectorGapMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorPitchDegrees = physicalDoorFit.pitchDegrees;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorCabVerticalAdjustmentMeters = physicalDoorFit.cabVerticalAdjustmentMeters;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorStairMinimumHeightMeters = physicalDoorFit.stairGrounding.minimumY;\n  group.userData.uploadedJetwayA1FinalPhysicalDoorMechanicalMinimumHeightMeters = physicalDoorFit.mechanicalGrounding.minimumY;\n\n`;
  elbowSource = elbowSource.replace(returnNeedle, `${physicalFitBlock}${returnNeedle}`);
  fs.writeFileSync(elbowPath, elbowSource, "utf8");
}

fleetSource = fs.readFileSync(fleetPath, "utf8");
elbowSource = fs.readFileSync(elbowPath, "utf8");
doorFitSource = fs.readFileSync(doorFitPath, "utf8");
for (const [path, source] of [[fleetPath, fleetSource], [elbowPath, elbowSource]]) {
  if (!source.includes(marker)) throw new Error(`${path}: final physical door-fit/controller-rebase marker is missing`);
}
for (const requiredMarker of [contactNormalMarker, modelFrameYawMarker, measuredCabFaceMarker]) {
  if (!doorFitSource.includes(requiredMarker)) {
    throw new Error(`${doorFitPath}: ${requiredMarker} is missing`);
  }
}
for (const required of [
  "fitUploadedA1JetwayToRenderedCrjDoor",
  "uploadedJetwayModelSpaceController",
  "deploymentController.bind(anchor)",
  "uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters",
]) {
  if (!`${fleetSource}\n${elbowSource}`.includes(required)) {
    throw new Error(`A1 final physical door-fit/controller-rebase preparation is missing ${required}`);
  }
}
for (const required of [
  ".transformDirection(group.matrixWorld)\n    .setY(0)\n    .normalize()",
  ".transformDirection(model.matrixWorld)\n    .setY(0)\n    .normalize()",
  "modelYawInAnchor",
  "sourceCab.frontOffset.clone()",
  "MAX_CAB_NORMAL_ERROR_DEGREES",
  "MAX_CAB_FUSELAGE_PENETRATION_METERS",
]) {
  if (!doorFitSource.includes(required)) {
    throw new Error(`A1 physical door-fit normalization is missing ${required}`);
  }
}

console.log(`Installed ${marker} + ${contactNormalMarker} + ${modelFrameYawMarker} + ${measuredCabFaceMarker}: final photo-registered A1 keeps its real fixed corridor/remote Rotunda, articulates only the exact supplied movable GLB to the CRJ door, solves and validates Cab yaw from the same measured Cab face vector, validates contact in the horizontal ramp plane, re-grounds authored Tunnel-C support subsets, and rebases attached deployment on that fitted pose.`);
