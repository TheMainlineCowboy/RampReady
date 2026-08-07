import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const marker = "compact-real-terminal-wall-readiness-v2";
const FINAL_CENTER_TO_WALL_MINIMUM_METERS = 2.9;
const FINAL_CENTER_TO_WALL_MAXIMUM_METERS = 5.8;

source = source
  .replaceAll(
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 28",
    `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  )
  .replaceAll(
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12",
    `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  )
  .replaceAll(
    "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
    `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  )
  .replaceAll(
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
  );

source = source.replaceAll("compact-real-terminal-wall-readiness-v1", marker);
if (!source.includes(marker)) {
  const anchor = "          const connectorVisibleLength = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);";
  if (!source.includes(anchor)) {
    throw new Error(`${readinessPath}: A1 connector-visible-length declaration is missing`);
  }
  source = source.replace(
    anchor,
    `${anchor}
          // ${marker}: center-to-wall includes the exact authored Rotunda collar.
          // The following visual stage independently requires the visible white
          // vestibule itself to equal 2.4 m.`,
  );
}

for (const token of [
  marker,
  `a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}`,
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: separated A1 center/visible readiness contract is missing ${token}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance < 28",
  "a1TerminalWallDistance < 12",
  "a1TerminalWallDistance < 4.1",
  "connectorVisibleLength < 28",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: stale A1 center-to-wall readiness allowance remains: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized final A1 readiness to the authored Rotunda center-to-wall range 2.9-5.8 m; the next visual gate independently requires the exact 2.4 m visible white vestibule.");
