import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";
import concourseB from "../src/environment/kphxV181/concourseB.js";
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS,
} from "../src/environment/uploadedAirportJetwayArticulationV10.js";

function requireTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path} is missing jetway articulation token: ${token}`);
  }
  return source;
}

const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
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
  "controller.bind(anchor)",
]);
for (const forbidden of ["AIR_Jetway01_(?!WallCollars)", "geometry.bin", "decodeDeltaVarint", "decodeOctNormal"]) {
  if (fleet.includes(forbidden)) throw new Error(`Retired articulation path remains: ${forbidden}`);
}

requireTokens("scripts/prepare-uploaded-airport-jetway-articulation-v10.mjs", [
  "57 per-gate static instance sets",
  "one independently controlled A1 clone",
]);
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "exact-uploaded-airport-jetway-complete-58-gates-v1"',
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "staticArticulatedGateCount !== 57",
  "a1PredictedDoorGap > 0.05",
  "a1AttachedExtension > 3 && a1AttachedExtension < 7",
]);
requireTokens("scripts/prepare-uploaded-airport-jetway-readiness-v2.mjs", [
  "authoredTerminal4UploadedJetwayArticulationAuthority",
  "authoredTerminal4UploadedJetwayStaticArticulatedGateCount",
  "authoredTerminal4UploadedJetwayA1AttachedExtensionMeters",
  "authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters",
]);
requireTokens("scripts/prepare-terminal4-crj-runtime-evidence.mjs", [
  "dataset.terminal4UploadedJetwayArticulationAuthority",
  "dataset.terminal4UploadedJetwayA1AttachedExtensionMeters",
  "dataset.terminal4UploadedJetwayA1PredictedDoorGapMeters",
]);

const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32;
const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34;
const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61;
const sourceContactDistance = 25.980676689692473;
const sourcePartCenters = Object.freeze({
  Rotunda: -0.249,
  Tunnel_A: 5.406,
  Tunnel_B: 10.666,
  Tunnel_C: 17.126,
  Cab: 23.327,
});
const parkings = new Map([...concourseA.parkings, ...concourseB.parkings].map((parking) => [parking.g, parking]));
const placements = [...concourseA.jetways, ...concourseB.jetways].map((jetway) => {
  const parking = parkings.get(jetway.g);
  const heading = Number(parking?.h || 0) * Math.PI / 180;
  const forwardX = Math.cos(heading);
  const forwardZ = Math.sin(heading);
  const leftX = forwardZ;
  const leftZ = -forwardX;
  const targetX = jetway.px - forwardX * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS
    + leftX * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
  const targetZ = jetway.pz - forwardZ * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS
    + leftZ * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
  const aircraftDoorDistance = Math.hypot(targetX - jetway.x, targetZ - jetway.z);
  const parkedGateCode = [...jetway.g].reduce((value, character) => value + character.charCodeAt(0), 0);
  const bridgeEnd = jetway.g === "A1"
    ? Math.max(11.5, Math.min(29.5, aircraftDoorDistance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS))
    : 11.9 + (parkedGateCode % 4) * 0.65;
  return { gate: jetway.g, targetX, targetZ, aircraftDoorDistance, bridgeEnd };
});
if (placements.length !== 58) throw new Error(`Expected 58 exact-jetway placements, received ${placements.length}`);
if (placements.filter((placement) => placement.gate !== "A1").length !== 57) throw new Error("Expected 57 static exact-jetway placements");
if (UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS.minimum > -14.08) {
  throw new Error(`Exact jetway cannot reach the shortest authored parked pose: ${UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS.minimum}`);
}

let maximumStaticError = 0;
let minimumPartSeparation = Infinity;
for (const placement of placements) {
  const articulation = computeUploadedJetwayArticulation(placement, sourceContactDistance);
  if (articulation.authority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY) {
    throw new Error(`${placement.gate} used the wrong articulation authority`);
  }
  const centers = {
    Rotunda: sourcePartCenters.Rotunda + articulation.partOffsets.Rotunda,
    Tunnel_A: sourcePartCenters.Tunnel_A + articulation.partOffsets.Tunnel_A,
    Tunnel_B: sourcePartCenters.Tunnel_B + articulation.partOffsets.Tunnel_B,
    Tunnel_C: sourcePartCenters.Tunnel_C + articulation.partOffsets.Tunnel_C,
    Cab: sourcePartCenters.Cab + articulation.partOffsets.Cab,
  };
  const separations = [
    centers.Tunnel_A - centers.Rotunda,
    centers.Tunnel_B - centers.Tunnel_A,
    centers.Tunnel_C - centers.Tunnel_B,
    centers.Cab - centers.Tunnel_C,
  ];
  minimumPartSeparation = Math.min(minimumPartSeparation, ...separations);
  if (separations.some((separation) => separation <= 0)) {
    throw new Error(`${placement.gate} exact tunnel sections inverted while telescoping: ${JSON.stringify(centers)}`);
  }
  if (placement.gate === "A1") {
    if (!(articulation.extension > 3 && articulation.extension < 5)) {
      throw new Error(`A1 exact jetway extension is not the measured aircraft-door reach: ${articulation.extension}`);
    }
    if (Math.abs(articulation.contactError) > 0.001) {
      throw new Error(`A1 exact jetway remains ${articulation.contactError} m from the aircraft door`);
    }
    if (!(articulation.partOffsets.Tunnel_B < articulation.partOffsets.Tunnel_C
      && articulation.partOffsets.Tunnel_C < articulation.partOffsets.Cab)) {
      throw new Error("A1 exact tunnel sections are not telescoped in authored order");
    }
  } else {
    maximumStaticError = Math.max(maximumStaticError, Math.abs(articulation.contactError));
  }
}
if (maximumStaticError > 0.001) throw new Error(`Static exact jetway contact error is ${maximumStaticError} m`);
if (minimumPartSeparation < 0.45) {
  throw new Error(`Exact parked jetways telescope too deeply; minimum part-center separation is ${minimumPartSeparation} m`);
}
console.log(`Verified direct exact-GLB articulation for all 58 Terminal 4 gates: 57 static gate poses, individually controlled A1 door alignment, ordered authored sections, ${maximumStaticError.toFixed(6)} m maximum static contact error, and ${minimumPartSeparation.toFixed(3)} m minimum section separation.`);
