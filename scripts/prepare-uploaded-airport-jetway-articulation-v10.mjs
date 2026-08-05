import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let fleet = fs.readFileSync(fleetPath, "utf8");

const legacyAlignment = `  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_ExactGlbPrototype";
  sourceScene.position.set(0.651626, 0.23, 15.12);
  aligned.add(sourceScene);`;
const exactAlignment = `  // The uploaded GLB preserves its exporter-authored root transforms. Its
  // longitudinal Rotunda-to-Cab axis is therefore diagonal in the GLB scene,
  // not parent-local +Z. Normalize only the parent scene transform so gate yaw,
  // telescoping offsets and contact measurements share one longitudinal axis.
  // No source node, mesh, geometry, UV, normal, material or scale is replaced.
  sourceScene.updateMatrixWorld(true);
  const sourceRotunda = sourceScene.getObjectByName("Rotunda");
  const sourceCab = sourceScene.getObjectByName("Cab");
  if (!sourceRotunda || !sourceCab) {
    throw new Error("Exact Airport_Jetway.glb axis normalization is missing Rotunda or Cab");
  }
  const sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());
  const sourceLongitudinalAxis = sourceCabCenter.clone().sub(sourceRotundaCenter);
  sourceLongitudinalAxis.y = 0;
  if (sourceLongitudinalAxis.lengthSq() < 1) {
    throw new Error("Exact Airport_Jetway.glb longitudinal source axis is invalid");
  }
  sourceLongitudinalAxis.normalize();
  const axisCorrectionRadians = -Math.atan2(sourceLongitudinalAxis.x, sourceLongitudinalAxis.z);
  sourceScene.rotation.y = axisCorrectionRadians;
  sourceScene.updateMatrixWorld(true);

  const correctedRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const correctedSourceBounds = new THREE.Box3().setFromObject(sourceScene);
  sourceScene.position.set(
    -correctedRotundaCenter.x,
    -correctedSourceBounds.min.y,
    -correctedRotundaCenter.z,
  );
  sourceScene.updateMatrixWorld(true);

  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_ExactGlbPrototype";
  aligned.userData.parentAxisCorrectionRadians = axisCorrectionRadians;
  aligned.userData.rotundaOriginNormalized = true;
  aligned.userData.groundContactNormalized = true;
  aligned.add(sourceScene);`;

if (fleet.includes(legacyAlignment)) {
  fleet = fleet.replace(legacyAlignment, exactAlignment);
  fs.writeFileSync(fleetPath, fleet, "utf8");
} else if (!fleet.includes("const axisCorrectionRadians = -Math.atan2(sourceLongitudinalAxis.x, sourceLongitudinalAxis.z);")) {
  throw new Error(`${fleetPath}: exact uploaded-model parent-axis normalization anchor is missing`);
}

const required = [
  'from "./uploadedAirportJetwayArticulationV10.js"',
  'from "./uploadedAirportJetwayModelSpaceControllerV7.js"',
  "measurePrototypeReach",
  "applyIndividualArticulation",
  "sourcePartNameForEntry",
  "articulationMatrix.makeTranslation(0, 0, partOffset)",
  "computeUploadedJetwayArticulation(placement, reach.sourceContactDistance)",
  "uploadedJetwayA1TargetDoorDistanceMeters",
  "uploadedJetwayA1AttachedExtensionMeters",
  "uploadedJetwayA1PredictedDoorGapMeters",
  "uploadedJetwayA1ActualDoorGapMeters",
  "uploadedJetwayStaticArticulatedGateCount",
  "uploadedJetwayStaticMaximumContactErrorMeters",
  "createModelSpaceA1Controller(THREE",
  "A1_MODEL_SPACE_RETRACTION_MODE_V7",
  "sourceLongitudinalAxis",
  "axisCorrectionRadians",
  "correctedRotundaCenter",
  "correctedSourceBounds",
  "rotundaOriginNormalized",
  "groundContactNormalized",
];
for (const token of required) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: exact GLB articulation is missing ${token}`);
}
for (const forbidden of [
  "buildPrototype(THREE, payload",
  "decodeDeltaVarint",
  "decodeOctNormal",
  "geometry.bin",
  "sourceScene.position.set(0.651626, 0.23, 15.12)",
]) {
  if (fleet.includes(forbidden)) throw new Error(`${fleetPath}: retired articulation path remains: ${forbidden}`);
}
console.log("Prepared direct exact-GLB articulation with parent-only authored-axis normalization: 57 per-gate static instance sets and one independently controlled A1 clone.");
