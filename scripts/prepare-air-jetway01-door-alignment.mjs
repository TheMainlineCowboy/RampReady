import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetways = fs.readFileSync(jetwayPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
  "sourceScaleAuthority",
  "jetwayMotionLimits",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 source-scale alignment is missing ${token}`);
}

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "sourceScaleAuthority",
  "aircraft-specific jetway shrink",
]) {
  if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 verifier is missing source-scale alignment token ${token}`);
}

for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
]) {
  if (jetways.includes(forbidden)) throw new Error(`AIR_Jetway01 alignment contains forbidden aircraft-specific bridge shrink ${forbidden}`);
}

console.log("Verified AIR_Jetway01 source-scale alignment: airport geometry remains scale 1.00, while aircraft door calibration and future articulation are handled independently.");
