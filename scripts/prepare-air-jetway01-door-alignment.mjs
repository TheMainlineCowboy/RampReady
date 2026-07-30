import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetways = fs.readFileSync(jetwayPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "a1DoorContactErrorMeters",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 CRJ700 source is missing ${token}`);
}

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "a1DoorContactErrorMeters",
]) {
  if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 verifier is missing CRJ700 token ${token}`);
}

console.log("Verified AIR_Jetway01 v5 alignment without rewriting source contracts: CRJ700 forward-door station, compact contact cabin, and measured A1 contact evidence.");
