import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";
import concourseB from "../src/environment/kphxV181/concourseB.js";
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  UPLOADED_AIRPORT_JETWAY_STATIC_RIGID_AUTHORITY,
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
  "Math.abs(a1AttachedExtension) > 0.001",
]);
requireTokens("scripts/prepare-uploaded-airport-jetway-readiness-v2.mjs", [
  "source-connected-attached-v12-a1-retracts-inward-only",
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
const sourceAdjacentSpacing = Object.freeze([
  sourcePartCenters.Tunnel_A - sourcePartCenters.Rotunda,
  sourcePartCenters.Tunnel_B - sourcePartCenters.Tunnel_A,
  sourcePartCenters.Tunnel_C - sourcePartCenters.Tunnel_B,
  sourcePartCenters.Cab - sourcePartCenters.Tunnel_C,
]);
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
  throw new Error(`A1 exact jetway inward retraction limit unexpectedly changed: ${UPLOADED_AIRPORT_JETWAY_EXTENSION_LIMITS.minimum}`);
}

let maximumStaticOffset = 0;
let maximumA1AttachedOffset = 0;
let maximumA1AdjacentSpacingDelta = 0;
let retiredPositiveStretchMeters = 0;
let minimumPartSeparation = Infinity;
for (const placement of placements) {
  const articulation = computeUploadedJetwayArticulation(placement, sourceContactDistance);
  const expectedAuthority = placement.gate === "A1"
    ? UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY
    : UPLOADED_AIRPORT_JETWAY_STATIC_RIGID_AUTHORITY;
  if (articulation.authority !== expectedAuthority) {
    throw new Error(`${placement.gate} used the wrong articulation authority: ${articulation.authority}`);
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
    throw new Error(`${placement.gate} exact tunnel sections inverted: ${JSON.stringify(centers)}`);
  }

  if (placement.gate === "A1") {
    const offsets = Object.values(articulation.partOffsets).map((value) => Math.abs(Number(value)));
    maximumA1AttachedOffset = Math.max(...offsets);
    maximumA1AdjacentSpacingDelta = Math.max(
      ...separations.map((spacing, index) => Math.abs(spacing - sourceAdjacentSpacing[index])),
    );
    retiredPositiveStretchMeters = Number(articulation.discardedAttachedExtension);
    if (articulation.extension !== 0 || articulation.requestedExtension !== 0) {
      throw new Error(`A1 attached exact jetway still stretches by ${articulation.extension} m`);
    }
    if (maximumA1AttachedOffset > 1e-9) {
      throw new Error(`A1 attached source hierarchy still offsets a child by ${maximumA1AttachedOffset} m`);
    }
    if (maximumA1AdjacentSpacingDelta > 1e-9) {
      throw new Error(`A1 attached source hierarchy changed an adjacent joint spacing by ${maximumA1AdjacentSpacingDelta} m`);
    }
    if (Math.abs(articulation.contactError) > 0.001) {
      throw new Error(`A1 attached source hierarchy reports ${articulation.contactError} m internal contact error`);
    }
    if (articulation.targetDistance !== sourceContactDistance
      || articulation.predictedContactDistance !== sourceContactDistance
      || articulation.attachedSourceHierarchyPreserved !== true) {
      throw new Error(`A1 attached source hierarchy is not authoritative: ${JSON.stringify(articulation)}`);
    }
    if (!(retiredPositiveStretchMeters > 3 && retiredPositiveStretchMeters < 5)) {
      throw new Error(`A1 regression fixture no longer proves removal of the former positive stretch: ${retiredPositiveStretchMeters}`);
    }
  } else {
    const offsets = Object.values(articulation.partOffsets).map((value) => Math.abs(Number(value)));
    maximumStaticOffset = Math.max(maximumStaticOffset, ...offsets);
    if (maximumStaticOffset > 1e-9 || articulation.extension !== 0 || articulation.rigidSourceHierarchy !== true) {
      throw new Error(`${placement.gate} mutated the supplied static GLB hierarchy: ${JSON.stringify(articulation)}`);
    }
  }
}
if (maximumStaticOffset > 1e-9) throw new Error(`Static exact jetway source-part offset is ${maximumStaticOffset} m`);
if (minimumPartSeparation < 5) {
  throw new Error(`Exact source hierarchy lost authored section spacing; minimum part-center separation is ${minimumPartSeparation} m`);
}
console.log(`Verified exact supplied Terminal 4 jetway articulation: attached A1 preserves all authored child transforms and adjacent joint spacings exactly (max offset ${maximumA1AttachedOffset.toFixed(6)} m, max spacing delta ${maximumA1AdjacentSpacingDelta.toFixed(6)} m) instead of applying the retired ${retiredPositiveStretchMeters.toFixed(3)} m positive stretch; all 57 static gates remain rigid, and pre-push A1 retraction remains separately available.`);
