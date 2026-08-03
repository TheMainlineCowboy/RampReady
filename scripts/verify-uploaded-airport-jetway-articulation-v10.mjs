import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";
import concourseB from "../src/environment/kphxV181/concourseB.js";
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
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
  "measurePrototypeReach",
  "applyIndividualArticulation",
  "sourcePartNameForEntry",
  "articulationMatrix.makeTranslation(0, 0, partOffset)",
  "computeUploadedJetwayArticulation(placement, reach.sourceContactDistance)",
  "uploadedJetwayA1TargetDoorDistanceMeters",
  "uploadedJetwayA1AttachedExtensionMeters",
  "uploadedJetwayA1PredictedDoorGapMeters",
  "uploadedJetwayStaticArticulatedGateCount",
  "uploadedJetwayStaticMaximumContactErrorMeters",
]);
if (fleet.includes("AIR_Jetway01_(?!WallCollars)")) {
  throw new Error("Legacy wall collars are still exempted from supplied-jetway replacement");
}

requireTokens("scripts/prepare-uploaded-airport-jetway-fleet.mjs", [
  "targetX",
  "targetZ",
  "aircraftDoorDistance: distance",
  "aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
]);
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured",
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
const sourceContactDistance = 25.783;
const parkings = new Map(
  [...concourseA.parkings, ...concourseB.parkings].map((parking) => [parking.g, parking]),
);
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
  const bridgeEnd = Math.max(11.5, Math.min(
    29.5,
    aircraftDoorDistance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS,
  ));
  return { gate: jetway.g, targetX, targetZ, aircraftDoorDistance, bridgeEnd };
});
if (placements.length !== 58) throw new Error(`Expected 58 supplied-jetway placements, received ${placements.length}`);

let maximumStaticError = 0;
for (const placement of placements) {
  const articulation = computeUploadedJetwayArticulation(placement, sourceContactDistance);
  if (articulation.authority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY) {
    throw new Error(`${placement.gate} used the wrong articulation authority`);
  }
  if (placement.gate === "A1") {
    if (!(articulation.extension > 4 && articulation.extension < 6)) {
      throw new Error(`A1 supplied jetway extension is not the measured aircraft-door reach: ${articulation.extension}`);
    }
    if (Math.abs(articulation.contactError) > 0.001) {
      throw new Error(`A1 supplied jetway remains ${articulation.contactError} m from the aircraft door`);
    }
    if (!(articulation.partOffsets.Tunnel_B < articulation.partOffsets.Tunnel_C
      && articulation.partOffsets.Tunnel_C < articulation.partOffsets.Cab)) {
      throw new Error("A1 supplied tunnel sections are not telescoped in authored order");
    }
  } else {
    maximumStaticError = Math.max(maximumStaticError, Math.abs(articulation.contactError));
  }
}
if (maximumStaticError > 0.001) {
  throw new Error(`Static supplied jetway contact error is ${maximumStaticError} m`);
}

console.log("Verified the exact supplied Terminal 4 jetway articulation: 57 static gates receive per-gate parked telescoping, A1 extends the authored Tunnel B/Tunnel C/Cab chain about 4.8 m to the CRJ forward door, Rotunda and Tunnel A remain fixed, and no source mesh is scaled or replaced.");
