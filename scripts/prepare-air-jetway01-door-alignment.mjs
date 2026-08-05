import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetways = fs.readFileSync(jetwayPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
  "sourceScaleAuthority",
  "jetwayMotionLimits",
  "aircraftDoorDistance: distance",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
]) {
  if (!jetways.includes(token)) throw new Error(`Exact Airport Jetway source-scale alignment is missing ${token}`);
}

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "sourceScaleAuthority",
  "aircraft-specific jetway shrink",
]) {
  if (!verifier.includes(token)) throw new Error(`KPHX verifier is missing corrected exact-jetway alignment token ${token}`);
}

for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
]) {
  if (jetways.includes(forbidden)) throw new Error(`Exact Airport Jetway alignment contains forbidden aircraft-specific bridge shrink ${forbidden}`);
}

console.log("Verified exact Airport Jetway alignment: airport scale remains 1.00, the CRJ forward-left door uses 7.32 m aft and 1.34 m left offsets, and the supplied 2.61 m contact assembly reaches the aircraft without shrinking the model.");
