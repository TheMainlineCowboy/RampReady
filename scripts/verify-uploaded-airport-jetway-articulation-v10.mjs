import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";
import concourseB from "../src/environment/kphxV181/concourseB.js";
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  UPLOADED_AIRPORT_JETWAY_A1_TARGET_AUTHORITY,
  UPLOADED_AIRPORT_JETWAY_A1_TARGET_WORLD,
} from "../src/environment/uploadedAirportJetwayArticulationV10.js";

function requireTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path} is missing full-3D jetway token: ${token}`);
  }
  return source;
}

const full3D = requireTokens("src/environment/uploadedAirportJetwayFull3DV11.js", [
  "supplied-cab-aircraft-side-opening-threshold-v12",
  "measureSuppliedCabOpening",
  "openingThresholdY",
  "cabAircraftPlaneIntrusion",
  "cabRampClearance",
]);
if (full3D.includes("new THREE.Vector3(cabCenter.x, cabCenter.y, cabBox.max.z)")) {
  throw new Error("The rejected Cab bounding-box-center contact remains");
}
const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  "measureUploadedJetwaySourcePose",
  "measureUploadedJetwayFull3DPose",
  "applyUploadedJetwayFull3DPose",
  "buildUploadedJetwayStaticFull3D",
  "uploadedJetwayA1CabNormalErrorDegrees",
  "uploadedJetwayA1CabHeightErrorMeters",
  "uploadedJetwayA1StairGroundClearanceMeters",
  "uploadedJetwayA1BogieGroundClearanceMeters",
  "uploadedJetwayStaticMaximumCabNormalErrorDegrees",
]);
if (fleet.includes("AIR_Jetway01_(?!WallCollars)")) throw new Error("Legacy wall collars are still exempted");
requireTokens("scripts/prepare-uploaded-airport-jetway-fleet.mjs", [
  "aircraftHeading: parkingHeading",
  "prepare-uploaded-jetway-crj700-door-target-v14.mjs",
  "prepare-uploaded-jetway-full3d-evidence-v11.mjs",
  "targetX",
  "targetZ",
]);
requireTokens("scripts/prepare-uploaded-jetway-crj700-door-target-v14.mjs", [
  "a1AttachedExtension > 2.2 && a1AttachedExtension < 2.5",
  "Legacy v11 assertion block retained only",
]);
requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "staticMaximumCabNormalError > 2",
  "a1AttachedExtension > 2.2 && a1AttachedExtension < 2.5",
  "a1CabNormalError > 2",
  "a1CabHeightError > 0.05",
]);
requireTokens("scripts/prepare-uploaded-airport-jetway-readiness-v2.mjs", [
  "authoredTerminal4UploadedJetwayA1CabNormalErrorDegrees",
  "authoredTerminal4UploadedJetwayA1CabHeightErrorMeters",
]);
requireTokens("scripts/prepare-uploaded-jetway-full3d-evidence-v11.mjs", [
  "dataset.terminal4UploadedJetwayA1CabNormalErrorDegrees",
  "dataset.terminal4UploadedJetwayA1CabHeightErrorMeters",
  "dataset.terminal4UploadedJetwayA1CabYawOffsetDegrees",
]);
requireTokens("scripts/prepare-uploaded-jetway-exact-threshold-band-v13.mjs", [
  "EXACT_MINIMUM_VERTICAL_OFFSET = -2.59",
  "EXACT_MAXIMUM_VERTICAL_OFFSET = -2.56",
  "zero plane intrusion",
]);
requireTokens("src/environment/uploadedAirportJetwayArticulationV10.js", [
  "authored-crj700-forward-left-door-from-model-v14",
  "x: -1.309233922",
  "y: 1.72",
  "z: 2.23886",
]);

const sourceGeometry = Object.freeze({
  sourceContactDistance: 25.980676689692473,
  cabContactAuthority: "supplied-cab-aircraft-side-opening-threshold-v12",
  cabPivot: Object.freeze({ x: 0.651626, y: 5.736130, z: 21.890110 }),
  cabContact: Object.freeze({ x: 0.653434, y: 4.294661264419555, z: 25.731423 }),
  cabContactLever: Object.freeze({ x: 0.001808, y: -1.441468735580445, z: 3.841313 }),
  cabOpeningYaw: 0,
});
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
  const aircraftHeading = Number(parking?.h || 0) * Math.PI / 180;
  const forwardX = Math.cos(aircraftHeading);
  const forwardZ = Math.sin(aircraftHeading);
  const leftX = forwardZ;
  const leftZ = -forwardX;
  const targetX = jetway.px - forwardX * 6.25 + leftX * 1.35;
  const targetZ = jetway.pz - forwardZ * 6.25 + leftZ * 1.35;
  const distance = Math.hypot(targetX - jetway.x, targetZ - jetway.z);
  const yaw = Math.atan2(targetX - jetway.x, targetZ - jetway.z);
  const parkedGateCode = [...jetway.g].reduce((value, character) => value + character.charCodeAt(0), 0);
  return {
    gate: jetway.g,
    x: jetway.x,
    z: jetway.z,
    yaw,
    aircraftHeading,
    bridgeEnd: jetway.g === "A1" ? Math.min(29.5, Math.max(11.5, distance - 1.55)) : 11.9 + (parkedGateCode % 4) * 0.65,
    cabinY: jetway.g === "A1" ? 2.95 : 3.08,
    targetX,
    targetZ,
  };
});
if (placements.length !== 58) throw new Error(`Expected 58 supplied-jetway placements, received ${placements.length}`);

let maximumPredictedGap = 0;
let minimumPartSeparation = Infinity;
let a1 = null;
for (const placement of placements) {
  const articulation = computeUploadedJetwayArticulation(placement, sourceGeometry);
  if (articulation.authority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY) {
    throw new Error(`${placement.gate} used the wrong articulation authority`);
  }
  maximumPredictedGap = Math.max(maximumPredictedGap, articulation.predictedDoorGap);
  const centers = Object.fromEntries(Object.entries(sourcePartCenters).map(([name, center]) => [
    name,
    center + articulation.partOffsets[name].z,
  ]));
  const separations = [
    centers.Tunnel_A - centers.Rotunda,
    centers.Tunnel_B - centers.Tunnel_A,
    centers.Tunnel_C - centers.Tunnel_B,
    centers.Cab - centers.Tunnel_C,
  ];
  minimumPartSeparation = Math.min(minimumPartSeparation, ...separations);
  if (separations.some((separation) => separation <= 0)) {
    throw new Error(`${placement.gate} supplied sections invert: ${JSON.stringify(centers)}`);
  }
  if (articulation.openingYawError > 1e-6) {
    throw new Error(`${placement.gate} supplied Cab misses its aircraft door plane by ${articulation.openingYawError} rad`);
  }
  if (placement.gate === "A1") a1 = articulation;
}
if (maximumPredictedGap > 0.001) throw new Error(`Full-3D supplied jetway predicted gap is ${maximumPredictedGap} m`);
if (minimumPartSeparation < 0.4) throw new Error(`Full-3D supplied sections telescope too deeply: ${minimumPartSeparation} m`);
if (!a1) throw new Error("A1 full-3D articulation was not computed");
if (a1.targetAuthority !== UPLOADED_AIRPORT_JETWAY_A1_TARGET_AUTHORITY) {
  throw new Error(`A1 used the wrong target authority: ${a1.targetAuthority}`);
}
for (const axis of ["x", "y", "z"]) {
  const error = Math.abs(a1.targetWorldContact[axis] - UPLOADED_AIRPORT_JETWAY_A1_TARGET_WORLD[axis]);
  if (error > 1e-9) throw new Error(`A1 ${axis} door target error is ${error} m`);
}
if (!(a1.targetDistance > 26.8 && a1.targetDistance < 27.1)) throw new Error(`A1 target distance is ${a1.targetDistance} m`);
if (!(a1.extension > 2.2 && a1.extension < 2.5)) throw new Error(`A1 extension is ${a1.extension} m`);
if (!(a1.anchorYaw * 180 / Math.PI > 39 && a1.anchorYaw * 180 / Math.PI < 40)) throw new Error(`A1 bridge yaw is ${a1.anchorYaw * 180 / Math.PI} degrees`);
if (!(a1.cabYawOffset * 180 / Math.PI > 49.5 && a1.cabYawOffset * 180 / Math.PI < 51)) throw new Error(`A1 Cab yaw is ${a1.cabYawOffset * 180 / Math.PI} degrees`);
if (!(a1.cabVerticalOffset > -2.59 && a1.cabVerticalOffset < -2.56)) throw new Error(`A1 Cab threshold vertical offset is ${a1.cabVerticalOffset} m`);
if (!(a1.partOffsets.Cab.y > -2.59 && a1.partOffsets.Cab.y < -2.56)) throw new Error(`A1 Cab still uses the rejected vertical pose: ${a1.partOffsets.Cab.y} m`);

console.log(`Verified ${UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY}: all 58 exact supplied models preserve their authored hierarchy; A1 targets the authored CRJ700 forward-left door at (${a1.targetWorldContact.x.toFixed(3)}, ${a1.targetWorldContact.y.toFixed(3)}, ${a1.targetWorldContact.z.toFixed(3)}) with ${a1.extension.toFixed(3)} m extension, ${(a1.anchorYaw * 180 / Math.PI).toFixed(3)}° bridge yaw, ${(a1.cabYawOffset * 180 / Math.PI).toFixed(3)}° Cab yaw and ${a1.cabVerticalOffset.toFixed(3)} m vertical articulation.`);
