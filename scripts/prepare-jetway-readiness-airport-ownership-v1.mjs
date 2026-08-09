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
const a1TargetDoorDistance = resolveTelemetryVariable("uploadedJetwayA1TargetDoorDistanceMeters");
const a1ActualContactDistance = resolveTelemetryVariable("uploadedJetwayA1ActualContactDistanceMeters");
const a1ActualDoorGap = resolveTelemetryVariable("uploadedJetwayA1ActualDoorGapMeters");

// Grounding authority changed deliberately: the exact-model contact correction
// now remains on the shared 58-gate fleet parent instead of being transferred to
// A1 and then reset to Y=0 for all 57 static bridges. Readiness must prove the
// static fleet kept the same measured parent offset, not demand the retired zero.
const zeroGroundCheck = new RegExp(`Math\\.abs\\(${staticFleetGroundYOffset}\\)\\s*>\\s*1e-8`);
const zeroGroundPattern = new RegExp(`Math\\.abs\\(${staticFleetGroundYOffset}\\)\\s*>\\s*1e-8`, "g");
if (!zeroGroundCheck.test(source)) {
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
const targetAlignmentCheck = new RegExp(`${targetAlignmentCosine}\\s*<\\s*0\\.99999`);
const targetAlignmentPattern = new RegExp(`${targetAlignmentCosine}\\s*<\\s*0\\.99999`, "g");
if (!targetAlignmentCheck.test(source)) {
  throw new Error(`${readinessPath}: retired source-parent synthetic-target alignment assertion is missing`);
}
source = source.replace(
  targetAlignmentPattern,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
);

// This value measures the unarticulated source Cab against the synthetic door
// target. It is no longer an acceptance distance once the airport heading owns
// the rigid parent. Generated readiness has used both a local telemetry variable
// and a direct group.userData Number(...) expression over time, so normalize
// either form. Keep the value finite for diagnostics; actual articulated contact
// remains separately enforced to <= 6 cm below.
const cabVariableCheck = new RegExp(`${cabTargetHorizontalError}\\s*>\\s*0\\.06`);
const cabVariablePattern = new RegExp(`${cabTargetHorizontalError}\\s*>\\s*0\\.06`, "g");
const cabDirectCheck = /Number\(group\.userData\.uploadedJetwayA1CabTargetHorizontalErrorMeters\s*\?\?\s*(?:Infinity|Number\.POSITIVE_INFINITY)\)\s*>\s*0\.06/;
const cabDirectPattern = /Number\(group\.userData\.uploadedJetwayA1CabTargetHorizontalErrorMeters\s*\?\?\s*(?:Infinity|Number\.POSITIVE_INFINITY)\)\s*>\s*0\.06/g;
if (!cabVariableCheck.test(source) && !cabDirectCheck.test(source)) {
  throw new Error(`${readinessPath}: retired unarticulated source-Cab 6 cm assertion is missing`);
}
source = source
  .replace(cabVariablePattern, `!Number.isFinite(${cabTargetHorizontalError})`)
  .replace(cabDirectPattern, `!Number.isFinite(${cabTargetHorizontalError})`);

// Do not hard-code whichever local identifiers or 5/6 cm spelling an upstream
// preparer emitted. Resolve the generated telemetry variables, find the actual
// articulated contact predicates, and prove their thresholds are no looser than
// 6 cm. These are the physical door-contact checks that remain acceptance-critical.
const actualContactPattern = new RegExp(
  `Math\\.abs\\(\\s*${a1ActualContactDistance}\\s*-\\s*${a1TargetDoorDistance}\\s*\\)\\s*>\\s*([0-9.]+)`,
);
const actualDoorGapPattern = new RegExp(`${a1ActualDoorGap}\\s*>\\s*([0-9.]+)`);
const actualContactMatch = source.match(actualContactPattern);
const actualDoorGapMatch = source.match(actualDoorGapPattern);
if (!actualContactMatch) {
  throw new Error(`${readinessPath}: actual articulated A1 contact-distance tolerance is missing`);
}
if (!actualDoorGapMatch) {
  throw new Error(`${readinessPath}: actual articulated A1 door-gap tolerance is missing`);
}
const actualContactToleranceMeters = Number(actualContactMatch[1]);
const actualDoorGapToleranceMeters = Number(actualDoorGapMatch[1]);
if (!(actualContactToleranceMeters > 0 && actualContactToleranceMeters <= 0.06)) {
  throw new Error(`${readinessPath}: articulated A1 contact tolerance is too loose: ${actualContactToleranceMeters}`);
}
if (!(actualDoorGapToleranceMeters > 0 && actualDoorGapToleranceMeters <= 0.06)) {
  throw new Error(`${readinessPath}: articulated A1 door-gap tolerance is too loose: ${actualDoorGapToleranceMeters}`);
}

for (const required of [
  `Math.abs(${staticFleetGroundYOffset} - ${fleetGroundOffset}) > 1e-6`,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
  `!Number.isFinite(${cabTargetHorizontalError})`,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: final airport-owned readiness is missing ${required}`);
  }
}
for (const forbidden of [
  `Math.abs(${staticFleetGroundYOffset}) > 1e-8`,
  `${targetAlignmentCosine} < 0.99999`,
  `${cabTargetHorizontalError} > 0.06`,
  "Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Infinity) > 0.06",
  "Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Number.POSITIVE_INFINITY) > 0.06",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired aircraft-owned/static-floating readiness survived: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log(`Aligned final exact-jetway readiness with airport-owned geometry: all 58 bridges preserve the measured shared ground offset; decoded source heading may differ from the synthetic CRJ target; actual articulated Cab contact remains enforced at ${actualContactToleranceMeters} m distance error / ${actualDoorGapToleranceMeters} m door gap.`);