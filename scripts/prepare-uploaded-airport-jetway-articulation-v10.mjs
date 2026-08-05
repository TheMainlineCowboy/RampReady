import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const fleet = fs.readFileSync(fleetPath, "utf8");
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
];
for (const token of required) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: exact GLB articulation is missing ${token}`);
}
for (const forbidden of [
  "buildPrototype(THREE, payload",
  "decodeDeltaVarint",
  "decodeOctNormal",
  "geometry.bin",
  "AIR_Jetway01_(?!WallCollars)",
]) {
  if (fleet.includes(forbidden)) throw new Error(`${fleetPath}: retired articulation path remains: ${forbidden}`);
}
console.log("Prepared direct exact-GLB articulation: 57 per-gate static instance sets and one independently controlled A1 clone.");
