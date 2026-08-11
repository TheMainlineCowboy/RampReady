import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const retiredAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
];
const authority = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
let source = fs.readFileSync(readinessPath, "utf8");

// Final readiness must use the exact connected wheel pair isolated from the
// supplied Tunnel_C_Jetway_0 topology. A low Rotunda pedestal, tunnel frame,
// or arbitrary Tunnel-C vertex can never satisfy this authority.
for (const retired of retiredAuthorities) source = source.replaceAll(retired, authority);
source = source
  .replaceAll("Math.abs(fleetGroundOffset) > 3", "Math.abs(fleetGroundOffset) > 8")
  .replaceAll("Math.abs(bogieGroundClearance) > 0.005", "Math.abs(bogieGroundClearance) > 0.015")
  .replaceAll("bogieGroundContactPointCount < 4", "bogieGroundContactPointCount < 8")
  .replaceAll("bogieGroundContactPointCount < 8", "bogieGroundContactPointCount < 8")
  .replaceAll("bogieGroundContactClusterCount < 1", "bogieGroundContactClusterCount < 2")
  .replaceAll("bogieGroundContactClusterCount < 2", "bogieGroundContactClusterCount < 2")
  .replaceAll("bogieGroundHorizontalContactSpan < 0.35", "bogieGroundHorizontalContactSpan < 1.4")
  .replaceAll("bogieGroundHorizontalContactSpan < 1.2", "bogieGroundHorizontalContactSpan < 1.4");

for (const required of [
  `bogieGroundContactAuthority !== "${authority}"`,
  "Math.abs(bogieGroundClearance) > 0.015",
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.4",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: exact authored wheel-pair readiness is missing ${required}`);
  }
}
for (const forbidden of [
  ...retiredAuthorities,
  "Math.abs(bogieGroundClearance) > 0.005",
  "bogieGroundContactPointCount < 4",
  "bogieGroundContactClusterCount < 1",
  "bogieGroundHorizontalContactSpan < 0.35",
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired generic bogie readiness remains: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log(`Migrated final A1 readiness to ${authority}: only the exact paired authored wheel shells may establish ramp contact, with two wheel clusters and a full axle-width footprint.`);
