import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-final-terminal-building-overlap-v2-bounded-hidden-seam";
const doglegAuthority = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const BUILDING_OVERLAP_METERS = 0.35;

let source = fs.readFileSync(sourcePath, "utf8");
if (!source.includes(doglegAuthority)) {
  throw new Error(`${sourcePath}: final terminal continuity requires the photo-authoritative A1 dogleg`);
}

// The exact BGATE1 hit is the authoritative terminal endpoint. Only a short hidden
// seam may penetrate the facade to avoid z-fighting/daylight at the joint. A deep
// overlap can make the corridor appear attached to the wrong building mass and can
// bury/disconnect adjacent structural pieces, so keep this bounded to 35 cm.
const firstStartPattern = /const firstShellStart = fixedWallPoint\.clone\(\)\.addScaledVector\(doglegFirstLegDirection, -[^)]+\);/;
if (!firstStartPattern.test(source)) {
  throw new Error(`${sourcePath}: photo dogleg first-shell wall anchor is missing`);
}
source = source.replace(
  firstStartPattern,
  `const firstShellStart = fixedWallPoint.clone().addScaledVector(doglegFirstLegDirection, -${BUILDING_OVERLAP_METERS}); // ${marker}`,
);

const telemetryAnchor = "  connector.userData.fixedRealTerminalWall = true;";
if (!source.includes(telemetryAnchor)) throw new Error(`${sourcePath}: terminal connector telemetry anchor is missing`);
source = source.replace(
  /\n\s*connector\.userData\.fixedTerminalBuildingOverlapMeters = [^;]+;\n\s*group\.userData\.uploadedJetwayA1FixedTerminalBuildingOverlapMeters = [^;]+;\n\s*group\.userData\.uploadedJetwayA1TerminalContinuityAuthority = "[^"]+";/,
  "",
);
source = source.replace(
  telemetryAnchor,
  `${telemetryAnchor}\n  connector.userData.fixedTerminalBuildingOverlapMeters = ${BUILDING_OVERLAP_METERS};\n  group.userData.uploadedJetwayA1FixedTerminalBuildingOverlapMeters = ${BUILDING_OVERLAP_METERS};\n  group.userData.uploadedJetwayA1TerminalContinuityAuthority = "${marker}";`,
);

for (const required of [marker, `-${BUILDING_OVERLAP_METERS}`, "uploadedJetwayA1TerminalContinuityAuthority"]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: final A1 terminal continuity is missing ${required}`);
}
if (/fixedTerminalBuildingOverlapMeters = (?:[1-9]|0\.[4-9])/.test(source)) {
  throw new Error(`${sourcePath}: excessive A1 facade penetration survived final continuity preparation`);
}
fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: A1 stays anchored to the exact BGATE1 facade with only ${BUILDING_OVERLAP_METERS} m of hidden seam penetration; terminal, Rotunda, aircraft and supplied jetway geometry remain fixed.`);
