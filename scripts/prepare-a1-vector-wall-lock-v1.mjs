import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const source = fs.readFileSync(installationPath, "utf8");

// This preparer used to translate the COMPLETE supplied A1 parent toward a
// compact terminal-wall target. That behavior is incompatible with the Aug. 15
// KPHX photo authority: A1 has a long fixed terminal corridor/dogleg to a remote
// Rotunda, while the supplied Airport_Jetway.glb movable assembly begins at that
// Rotunda and must not be dragged toward the building.
//
// The current production chain owns A1 terminal geometry in later generated
// runtime stages (BGATE1 wall point + long fixed corridor/dogleg/remote Rotunda).
// This installation helper therefore must remain compatibility-only. Do not
// require those later authority markers to be present in this earlier source
// file; generation order legitimately means they may live elsewhere.

const retiredScalarRelocationPattern = /const terminalWallX = a1Placement\.x \+ terminalDirection\.x \* sourceTerminalDistance;[\s\S]*?a1Anchor\.position\.(?:x|z) \+=/;
const retiredCompactAuthorityPattern = /post-transform-measured-terminal-wall-lock-grounded-exact-chain-v33|exact-world-rotunda-wall-cab-endpoints-v31/;

if (retiredScalarRelocationPattern.test(source) || retiredCompactAuthorityPattern.test(source)) {
  throw new Error(`${installationPath}: retired compact A1 parent-to-wall relocation survived after Aug. 15 long-corridor normalization`);
}

console.log("Skipped retired complete-parent A1 vector wall lock; no compact parent relocation was reintroduced. Later Aug. 15 BGATE1 fixed-corridor stages remain authoritative.");
