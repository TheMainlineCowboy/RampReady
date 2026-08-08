import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const source = fs.readFileSync(readinessPath, "utf8");

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

console.log("Confirmed final jetway ground-contact telemetry declarations before semantic readiness normalization.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?seeded-ground-contact=${Date.now()}`);
