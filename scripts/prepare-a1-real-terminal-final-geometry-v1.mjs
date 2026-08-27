import fs from "node:fs";

// Retired compatibility stage.
//
// This preparer formerly forced A1 back into a 2.9-5.8 m wall/Rotunda envelope
// with a 1.2-3.6 m short terminal sleeve. That model contradicts the user's
// Aug. 15 KPHX reference: A1 alone has a long elevated fixed corridor, a
// dogleg/elbow, and a remote Rotunda. The current BGATE1/photo-authoritative
// stages own that geometry later in production. This stage must not move the
// supplied jetway parent, rebuild a compact sleeve, or rewrite readiness to the
// retired short-route assumptions.

const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-real-terminal-final-geometry-v1-retired-for-aug15-long-route";

for (const path of [sourcePlacedPath, installationPath, readinessPath, elbowPath]) {
  if (!fs.existsSync(path)) throw new Error(`${path}: required A1 source is missing`);
}

const sourcePlaced = fs.readFileSync(sourcePlacedPath, "utf8");
if (sourcePlaced.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${sourcePlacedPath}: obsolete A1 T4_WALK portal survived the Aug. 15 long-route migration`);
}

console.log(`${marker}: no A1 geometry changes made; BGATE1 long fixed corridor/dogleg/remote-Rotunda stages remain authoritative.`);
