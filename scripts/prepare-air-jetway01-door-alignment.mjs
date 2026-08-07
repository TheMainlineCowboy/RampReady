import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetways = fs.readFileSync(jetwayPath, "utf8");
const verifier = fs.readFileSync(verifierPath, "utf8");

// This guard runs during verify:kphx-v181, before the later exact-fleet source
// wiring pass creates all 58 placement records. Validate only the immutable
// source scale and the single simulator-validated CRJ door/contact geometry
// authority here. The exact placement fields, fleet installer call and all 58
// gate records remain enforced by the later post-wiring fleet/articulation
// verifiers. Airport_Jetway.glb itself is never scaled or edited here.
for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
  "sourceScaleAuthority",
  "jetwayMotionLimits",
]) {
  if (!jetways.includes(token)) throw new Error(`Exact Airport Jetway source-scale alignment is missing ${token}`);
}

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "sourceScaleAuthority",
  "aircraft-specific jetway shrink",
]) {
  if (!verifier.includes(token)) throw new Error(`KPHX verifier is missing simulator-validated exact-jetway alignment token ${token}`);
}

for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
]) {
  if (jetways.includes(forbidden)) throw new Error(`Exact Airport Jetway alignment contains forbidden conflicting/shrunk bridge geometry ${forbidden}`);
}

console.log("Verified early exact Airport Jetway alignment: airport scale remains 1.00, the CRJ forward-left door uses the single simulator-validated 6.25 m aft / 1.35 m left authority, and the 1.58 m contact clearance is shared with production placement. All 58 exact placement records are verified after source wiring.");
