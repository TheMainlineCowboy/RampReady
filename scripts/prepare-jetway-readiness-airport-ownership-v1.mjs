import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

function resolveTelemetryVariable(fieldName) {
  const pattern = new RegExp(
    `const\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*Number\\(group\\.userData\\.${fieldName}\\s*\\?\\?\\s*[^)]+\\);`,
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`${readinessPath}: could not resolve telemetry variable for ${fieldName}`);
  return match[1];
}

const fleetGroundOffset = resolveTelemetryVariable("uploadedJetwayFleetGroundOffsetMeters");
const staticFleetGroundYOffset = resolveTelemetryVariable("uploadedJetwayStaticFleetGroundYOffsetMeters");
const targetAlignmentCosine = resolveTelemetryVariable("uploadedJetwayA1TargetAlignmentCosine");
const cabTargetHorizontalError = resolveTelemetryVariable("uploadedJetwayA1CabTargetHorizontalErrorMeters");

// Grounding authority changed deliberately: the exact-model contact correction
// now remains on the shared 58-gate fleet parent instead of being transferred to
// A1 and then reset to Y=0 for all 57 static bridges. Readiness must prove the
// static fleet kept the same measured parent offset, not demand the retired zero.
const zeroGroundPattern = new RegExp(`Math\\.abs\\(${staticFleetGroundYOffset}\\)\\s*>\\s*1e-8`, "g");
if (!zeroGroundPattern.test(source)) {
  throw new Error(`${readinessPath}: retired static-fleet-zero grounding assertion is missing`);
}
source = source.replace(
  zeroGroundPattern,
  `Math.abs(${staticFleetGroundYOffset} - ${fleetGroundOffset}) > 1e-6`,
);

// The synthetic CRJ door target is useful telemetry and the articulated Cab is
// still required to reach it through the real runtime contact checks below. It
// must no longer re-aim the complete source-authored bridge, so source-heading
// readiness may only require a finite cosine in the mathematically valid range.
const targetAlignmentPattern = new RegExp(`${targetAlignmentCosine}\\s*<\\s*0\\.99999`, "g");
if (!targetAlignmentPattern.test(source)) {
  throw new Error(`${readinessPath}: retired source-parent synthetic-target alignment assertion is missing`);
}
source = source.replace(
  targetAlignmentPattern,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
);

// This value measures the unarticulated source Cab against the synthetic door
// target. It is no longer an acceptance distance once the airport heading owns
// the rigid parent. Keep it finite for diagnostics; actual animated door contact
// remains separately enforced to 6 cm by a1ActualContactDistance/a1ActualDoorGap.
const cabErrorPattern = new RegExp(`${cabTargetHorizontalError}\\s*>\\s*0\\.06`, "g");
if (!cabErrorPattern.test(source)) {
  throw new Error(`${readinessPath}: retired unarticulated source-Cab 6 cm assertion is missing`);
}
source = source.replace(cabErrorPattern, `!Number.isFinite(${cabTargetHorizontalError})`);

for (const required of [
  `Math.abs(${staticFleetGroundYOffset} - ${fleetGroundOffset}) > 1e-6`,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
  `!Number.isFinite(${cabTargetHorizontalError})`,
  "Math.abs(a1ActualContactDistance - a1TargetDoorDistance) > 0.06",
  "a1ActualDoorGap > 0.06",
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final airport-owned readiness is missing ${required}`);
  }
}
for (const forbidden of [
  `Math.abs(${staticFleetGroundYOffset}) > 1e-8`,
  `${targetAlignmentCosine} < 0.99999`,
  `${cabTargetHorizontalError} > 0.06`,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired aircraft-owned/static-floating readiness survived: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Aligned final exact-jetway readiness with airport-owned geometry: all 58 bridges must preserve the measured shared ground offset; decoded source heading may differ from the synthetic CRJ target; the articulated Cab must still achieve the real runtime door-contact tolerance.");