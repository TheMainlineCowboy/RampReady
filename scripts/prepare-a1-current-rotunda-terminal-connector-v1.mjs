import fs from "node:fs";

const connectorPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const AUTHORITY = "a1-current-rotunda-terminal-connector-v1-retired-for-aug15-long-route";

// This preparer predates the Aug. 15 KPHX photo-authoritative A1 layout. Its old
// job was to create a short 2.9-5.8 m Rotunda-to-wall connector from the current
// transformed Rotunda. That is now physically wrong for A1: the real gate owns a
// long elevated fixed corridor, dogleg/elbow and remote Rotunda, while A3+ retain
// their short/direct terminal-side connectors. Do not mutate A1 geometry here.
const connector = fs.readFileSync(connectorPath, "utf8");
const readiness = fs.readFileSync(readinessPath, "utf8");

// Fail closed if this retired stage's compact readiness envelope is ever
// reintroduced. The current long-route readiness is owned by the later Aug. 15
// photo-authoritative stages and must not be narrowed here.
for (const forbidden of [
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 6",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired compact A1 current-Rotunda readiness survived: ${forbidden}`);
  }
}

// The old placement-based terminalPoint was one of the mechanisms that could
// manufacture a second short tunnel. It may still exist as dormant compatibility
// source, but this stage must never require or install it. The current Aug. 15
// path owns the terminal endpoint and fixed route.
if (!connector.includes("a1-real-photo-remote-rotunda-fixed-corridor-v1")) {
  console.log(`${AUTHORITY}: long-route authority is installed later in the production chain; leaving connector source untouched at this compatibility stage.`);
} else {
  console.log(`${AUTHORITY}: preserved Aug. 15 BGATE1 long fixed corridor/dogleg/remote-Rotunda authority without installing a compact terminal leg.`);
}
