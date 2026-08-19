import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-final-terminal-building-overlap-v1";
const doglegAuthority = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const BUILDING_OVERLAP_METERS = 8.0;

let source = fs.readFileSync(sourcePath, "utf8");
if (!source.includes(doglegAuthority)) {
  throw new Error(`${sourcePath}: final terminal continuity requires the photo-authoritative A1 dogleg`);
}

// The exact BGATE1 hit is still the terminal endpoint. Extend only the hidden
// first-shell end through that facade so coordinate-frame/skin thickness cannot
// leave visible daylight between the building and fixed corridor. This does not
// move Terminal 4, the remote Rotunda, aircraft, or supplied Airport_Jetway.glb.
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
if (!source.includes("fixedTerminalBuildingOverlapMeters")) {
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  connector.userData.fixedTerminalBuildingOverlapMeters = ${BUILDING_OVERLAP_METERS};\n  group.userData.uploadedJetwayA1FixedTerminalBuildingOverlapMeters = ${BUILDING_OVERLAP_METERS};\n  group.userData.uploadedJetwayA1TerminalContinuityAuthority = "${marker}";`,
  );
}

for (const required of [marker, `-${BUILDING_OVERLAP_METERS}`, "uploadedJetwayA1TerminalContinuityAuthority"]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: final A1 terminal continuity is missing ${required}`);
}
fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: the A1 fixed corridor now overlaps the measured Terminal 4 facade by ${BUILDING_OVERLAP_METERS} m so a visible terminal-side air gap is impossible while the wall/Rotunda endpoints remain fixed.`);
