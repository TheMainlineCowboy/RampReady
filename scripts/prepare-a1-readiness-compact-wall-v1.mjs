import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const marker = "compact-real-terminal-wall-readiness-v1";
source = source
  .replaceAll(
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 28",
    "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  )
  .replaceAll(
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12",
    "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  )
  .replaceAll(
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
  );

if (!source.includes(marker)) {
  const anchor = "          const connectorVisibleLength = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);";
  if (!source.includes(anchor)) {
    throw new Error(`${readinessPath}: A1 connector-visible-length declaration is missing`);
  }
  source = source.replace(
    anchor,
    `${anchor}
          // ${marker}: the real A1 terminal facade must be adjacent to the Rotunda;
          // a distant hit is the obsolete elevated walkway or a fabricated corridor.`,
  );
}

for (const token of [
  marker,
  "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]) {
  if (!source.includes(token)) {
    throw new Error(`${readinessPath}: compact A1 readiness contract is missing ${token}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance < 28",
  "a1TerminalWallDistance < 12",
  "connectorVisibleLength < 28",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: broad A1 readiness allowance remains: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Normalized A1 readiness to a 1.5-4.1 m real-terminal wall span and restored the connector anchor that the exact 2.4 m visual gate replaces.");
