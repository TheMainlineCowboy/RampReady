import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const source = fs.readFileSync(installationPath, "utf8");

// This preparer used to translate the COMPLETE supplied A1 parent toward a
// compact terminal-wall target. That behavior is incompatible with the Aug. 15
// KPHX photo authority: A1 has a long fixed terminal corridor/dogleg to a remote
// Rotunda, while the supplied Airport_Jetway.glb movable assembly begins at that
// Rotunda and must not be dragged toward the building.
//
// The current production chain owns A1 terminal geometry through the explicit
// BGATE1 wall point + long fixed corridor/dogleg/remote-Rotunda stages. Keep this
// file as a compatibility guard only so older build lists can still invoke it
// without resurrecting the retired compact-parent relocation.

const retiredScalarRelocationPattern = /const terminalWallX = a1Placement\.x \+ terminalDirection\.x \* sourceTerminalDistance;[\s\S]*?a1Anchor\.position\.(?:x|z) \+=/;
const retiredCompactAuthorityPattern = /post-transform-measured-terminal-wall-lock-grounded-exact-chain-v33|exact-world-rotunda-wall-cab-endpoints-v31/;

if (retiredScalarRelocationPattern.test(source) || retiredCompactAuthorityPattern.test(source)) {
  throw new Error(`${installationPath}: retired compact A1 parent-to-wall relocation survived after Aug. 15 long-corridor normalization`);
}

const longRouteAuthorities = [
  "a1-real-photo-remote-rotunda-fixed-corridor-v1",
  "a1-aug15-photo-fixed-corridor-dogleg-v1",
];

const hasLongRouteAuthority = longRouteAuthorities.some((token) => source.includes(token));
if (!hasLongRouteAuthority) {
  throw new Error(`${installationPath}: Aug. 15 A1 long fixed-corridor/remote-Rotunda authority is missing before retired vector-wall-lock compatibility stage`);
}

console.log("Skipped retired complete-parent A1 vector wall lock; Aug. 15 BGATE1 long fixed corridor/dogleg/remote-Rotunda authority remains intact.");
