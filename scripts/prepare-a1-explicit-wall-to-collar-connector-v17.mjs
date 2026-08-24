import fs from "node:fs";

const runtimePath = "src/environment/correctUploadedJetwayInstallationV1.js";
const doglegOpeningAuthority = "a1-aug15-remote-rotunda-dogleg-opening-v18";
let source = fs.readFileSync(runtimePath, "utf8");

// Aug. 15 photo authority: A1 reaches the remote Rotunda through a fixed
// terminal-side dogleg. The terminal facade therefore does NOT have to lie on
// the straight opposite extension of the Rotunda -> Tunnel-A movable-bridge
// axis. Any compact-era straight-line facing veto is invalid for A1 and must
// never rotate the exact supplied Airport_Jetway.glb or reject the long route.
//
// This preparer runs more than once in production and later preparers can
// regenerate the legacy guard with slightly different whitespace/thresholds.
// Remove the actual throw semantically instead of matching one complete block.
const staleFacingThrow = /throw\s+new\s+Error\(\s*`A1 exact authored Rotunda opening does not face the measured terminal wall:\s*\$\{terminalFacingDot\}`\s*\);/g;
const staleFacingMessage = "A1 exact authored Rotunda opening does not face the measured terminal wall";

if (staleFacingThrow.test(source)) {
  staleFacingThrow.lastIndex = 0;
  source = source.replace(
    staleFacingThrow,
    `/* ${doglegOpeningAuthority}: terminalFacingDot is diagnostic only for the real A1 fixed dogleg. */ void terminalFacingDot;`,
  );
}

// Stamp the current dogleg authority beside the diagnostic even when an older
// preparer has already removed the throw. This keeps repeated preparation
// idempotent without resurrecting the retired compact connector.
if (!source.includes(doglegOpeningAuthority)) {
  const dotAnchor = "const terminalFacingDot = openingDirection.dot(terminalDirection);";
  if (source.includes(dotAnchor)) {
    source = source.replace(dotAnchor, `${dotAnchor}\n  // ${doglegOpeningAuthority}`);
  } else {
    source += `\n// ${doglegOpeningAuthority}\n`;
  }
}

if (source.includes(staleFacingMessage)) {
  throw new Error(`${runtimePath}: retired compact straight-line Rotunda/wall facing veto survived Aug. 15 dogleg migration`);
}

// Do not migrate or recreate a synthetic short wall endpoint here. The current
// A1 path is owned upstream by the exact BGATE1 wall publication and the
// photo-authoritative fixed corridor/elbow/remote-Rotunda builders. A3+ retain
// their separate short/direct connector logic.
fs.writeFileSync(runtimePath, source, "utf8");
console.log("Preserved A1 Aug. 15 fixed-dogleg authority, retired every regenerated straight-line Rotunda/wall facing veto, and left the exact movable GLB untouched.");
