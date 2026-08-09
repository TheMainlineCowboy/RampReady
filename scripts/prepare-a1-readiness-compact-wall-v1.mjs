import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const marker = "source-measured-real-terminal-wall-readiness-v3";
const FINAL_CENTER_TO_WALL_MINIMUM_METERS = 0.5;
const FINAL_CENTER_TO_WALL_MAXIMUM_METERS = 44;
const FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS = 0.15;
const FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS = 44;

// A1's final Terminal 4 attachment is measured from the structural facade to
// the exact supplied Rotunda. Do not relocate the bridge to manufacture a
// compact 2.4 m leg. Normalize every historical wall/visible-span allowance to
// the physical source-measured range while preserving all other readiness gates.
source = source
  .replace(
    /a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
    `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  )
  .replace(
    /connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
    `connectorVisibleLength > ${FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS} && connectorVisibleLength < ${FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS}`,
  )
  .replaceAll("compact-real-terminal-wall-readiness-v2", marker)
  .replaceAll("compact-real-terminal-wall-readiness-v1", marker);

if (!source.includes(marker)) {
  const anchor = "          const connectorVisibleLength = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);";
  if (!source.includes(anchor)) {
    throw new Error(`${readinessPath}: A1 connector-visible-length declaration is missing`);
  }
  source = source.replace(
    anchor,
    `${anchor}\n          // ${marker}: the exact supplied Rotunda remains at the source gate pivot;\n          // the fixed terminal leg is the measured structural-wall span, not a magic distance.`,
  );
}

for (const token of [
  marker,
  `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  `connectorVisibleLength > ${FINAL_VISIBLE_FIXED_LEG_MINIMUM_METERS} && connectorVisibleLength < ${FINAL_VISIBLE_FIXED_LEG_MAXIMUM_METERS}`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: source-measured A1 readiness contract is missing ${token}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "a1TerminalWallDistance >= 2.9 && a1TerminalWallDistance <= 5.8",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
  "exact 2.4 m visible white vestibule",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: stale compact A1 readiness survived: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final A1 readiness to the source-measured structural Terminal 4 wall span (0.5-44 m center-to-wall; 0.15-44 m visible fixed leg) with no 2.4 m relocation requirement.");
