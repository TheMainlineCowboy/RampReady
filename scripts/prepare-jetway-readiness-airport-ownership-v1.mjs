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
// is independently enforced below.
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

// Physical acceptance is the articulated Cab at the real rendered door, not the
// unarticulated source Cab. Insert one stable fail-closed check immediately after
// the generated door-gap telemetry declaration. This is intentionally separate
// from the large historical mismatch predicate so upstream formatting/order can
// change without weakening or breaking the final physical acceptance contract.
const strictActualContactCondition = `Math.abs(${a1ActualContactDistance} - ${a1TargetDoorDistance}) > 0.06`;
const strictActualDoorGapCondition = `${a1ActualDoorGap} > 0.06`;
const strictContactMarker = "airport-owned-a1-articulated-door-contact-v1";
if (!source.includes(strictContactMarker)) {
  const doorGapDeclarationPattern = new RegExp(
    `(const\\s+${a1ActualDoorGap}\\s*=\\s*Number\\(group\\.userData\\.uploadedJetwayA1ActualDoorGapMeters\\s*\\?\\?\\s*[^)]+\\);)`,
  );
  if (!doorGapDeclarationPattern.test(source)) {
    throw new Error(`${readinessPath}: generated A1 actual-door-gap telemetry declaration is missing`);
  }
  source = source.replace(
    doorGapDeclarationPattern,
    `$1\n          // ${strictContactMarker}\n          if (${strictActualContactCondition} || ${strictActualDoorGapCondition}) {\n            throw new Error(\`A1 articulated door contact exceeds 0.06 m: distance=\${${a1ActualContactDistance}} target=\${${a1TargetDoorDistance}} gap=\${${a1ActualDoorGap}}\`);\n          }`,
  );
}

for (const required of [
  `Math.abs(${staticFleetGroundYOffset} - ${fleetGroundOffset}) > 1e-6`,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
  `!Number.isFinite(${cabTargetHorizontalError})`,
  strictContactMarker,
  strictActualContactCondition,
  strictActualDoorGapCondition,
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
console.log("Aligned final exact-jetway readiness with airport-owned geometry: all 58 bridges preserve the measured shared ground offset; decoded source heading may differ from the synthetic CRJ target; a standalone final guard rejects the articulated A1 Cab above 0.06 m contact-distance error or 0.06 m rendered door gap.");