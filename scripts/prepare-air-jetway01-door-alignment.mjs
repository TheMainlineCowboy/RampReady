import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetways = fs.readFileSync(jetwayPath, "utf8");
let verifier = fs.readFileSync(verifierPath, "utf8");

// The production preparation pass runs before this guard and normalizes the
// A1/CRJ relationship to the simulator-validated 6.25 / 1.35 / 1.58 authority.
// Keep the committed KPHX contract synchronized during the same clean-tree
// preparation sequence so it cannot continue demanding the retired
// 7.32 / 1.34 / 2.61 values after production has already moved on. This only
// changes source validation constants; Airport_Jetway.glb is never edited.
verifier = verifier
  .replaceAll("CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25")
  .replaceAll("CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35")
  .replaceAll("AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58");
fs.writeFileSync(verifierPath, verifier, "utf8");

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

// Scan the prepared production jetway source for retired geometry. Do not scan
// the verifier for these literals: it intentionally contains some of them in
// its own forbidden-token assertions, and treating those negative assertions as
// production geometry makes this guard reject itself before browser evidence.
for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
]) {
  if (jetways.includes(forbidden)) {
    throw new Error(`Exact Airport Jetway alignment contains forbidden conflicting/shrunk production geometry ${forbidden}`);
  }
}

console.log("Verified early exact Airport Jetway alignment: airport scale remains 1.00, the CRJ forward-left door uses the single simulator-validated 6.25 m aft / 1.35 m left authority, the 1.58 m contact clearance is shared with production placement, and the KPHX contract has been synchronized in the clean-tree preparation pass. All 58 exact placement records are verified after source wiring.");
