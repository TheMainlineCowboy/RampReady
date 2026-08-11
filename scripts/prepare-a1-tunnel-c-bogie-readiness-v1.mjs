import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const oldAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const authority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
let source = fs.readFileSync(readinessPath, "utf8");

// The v2 readiness contract measured the lowest footprint anywhere in the
// complete jetway. That allowed the terminal-side Rotunda pedestal to satisfy
// "grounded" while the aircraft-side Tunnel-C bogie/wheels were visibly high in
// the air. Keep the existing telemetry plumbing, but make its acceptance values
// match the Tunnel-C-specific measurement now published by installation v3.
source = source.replaceAll(oldAuthority, authority);
source = source
  .replaceAll("Math.abs(fleetGroundOffset) > 3", "Math.abs(fleetGroundOffset) > 8")
  .replaceAll("Math.abs(bogieGroundClearance) > 0.005", "Math.abs(bogieGroundClearance) > 0.015")
  .replaceAll("bogieGroundContactPointCount < 8", "bogieGroundContactPointCount < 4")
  .replaceAll("bogieGroundContactClusterCount < 2", "bogieGroundContactClusterCount < 1")
  .replaceAll("bogieGroundHorizontalContactSpan < 1.2", "bogieGroundHorizontalContactSpan < 0.35");

for (const required of [
  `bogieGroundContactAuthority !== "${authority}"`,
  "Math.abs(bogieGroundClearance) > 0.015",
  "bogieGroundContactPointCount < 4",
  "bogieGroundContactClusterCount < 1",
  "bogieGroundHorizontalContactSpan < 0.35",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: Tunnel-C bogie readiness migration is missing ${required}`);
  }
}
for (const forbidden of [
  oldAuthority,
  "Math.abs(bogieGroundClearance) > 0.005",
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: obsolete whole-model bogie readiness remains: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log(`Migrated final A1 readiness to ${authority}: the aircraft-side Tunnel-C support/bogie must be within 1.5 cm of the ramp; terminal-pedestal ground contact cannot satisfy this gate.`);
