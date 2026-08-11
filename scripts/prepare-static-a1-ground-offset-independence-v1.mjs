import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const retiredCoupling = "Math.abs(staticFleetGroundYOffset - fleetGroundOffset) > 1e-6";
const independentStaticGuard = "!Number.isFinite(staticFleetGroundYOffset) || Math.abs(staticFleetGroundYOffset) > 8";
let source = fs.readFileSync(readinessPath, "utf8");

// A1 is individually grounded from the final visible Tunnel-C support footprint.
// The 57 static jetways preserve the supplied model's authored shared ground
// offset under their own static-ground authority. Those are independent frames
// and must not be forced to have the same numeric Y offset.
if (source.includes(retiredCoupling)) {
  source = source.replaceAll(retiredCoupling, independentStaticGuard);
}

if (!source.includes(independentStaticGuard)) {
  throw new Error(`${readinessPath}: independent finite static-fleet ground-offset guard is missing`);
}
if (source.includes(retiredCoupling)) {
  throw new Error(`${readinessPath}: stale static=A1 ground-offset equality survived final normalization`);
}
for (const required of [
  "staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "Math.abs(bogieGroundClearance) > 0.015",
  'bogieGroundContactAuthority !== "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3"',
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: independent ground-offset normalization lost required physical guard ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Separated static-fleet authored ground offset from A1 Tunnel-C grounding: both remain finite/bounded under their own authorities, while A1 still requires <=1.5 cm visible aircraft-side support clearance.");
