import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const retiredCoupling = "Math.abs(staticFleetGroundYOffset - fleetGroundOffset) > 1e-6";
const independentStaticGuard = "!Number.isFinite(staticFleetGroundYOffset) || Math.abs(staticFleetGroundYOffset) > 8";
const exactA1WheelAuthority = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
const retiredA1BogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
let source = fs.readFileSync(readinessPath, "utf8");

// A1 is individually grounded from the exact connected authored wheel pair.
// The 57 static jetways preserve the supplied model's authored shared ground
// offset under their own static-ground authority. Those are independent frames
// and must never be forced to share one numeric Y offset.
if (source.includes(retiredCoupling)) {
  source = source.replaceAll(retiredCoupling, independentStaticGuard);
}
source = source.replaceAll(retiredA1BogieAuthority, exactA1WheelAuthority);

if (!source.includes(independentStaticGuard)) {
  throw new Error(`${readinessPath}: independent finite static-fleet ground-offset guard is missing`);
}
if (source.includes(retiredCoupling)) {
  throw new Error(`${readinessPath}: stale static=A1 ground-offset equality survived final normalization`);
}
if (source.includes(retiredA1BogieAuthority)) {
  throw new Error(`${readinessPath}: retired generic Tunnel-C v3 authority survived final normalization`);
}
for (const required of [
  "staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "Math.abs(bogieGroundClearance) > 0.015",
  `bogieGroundContactAuthority !== "${exactA1WheelAuthority}"`,
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.4",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: independent ground-offset normalization lost required exact-wheel guard ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Separated static-fleet authored ground offset from A1 exact authored wheel-pair grounding: static bridges keep their shared source frame while A1 keeps its own <=1.5 cm two-wheel ramp contact authority.");
