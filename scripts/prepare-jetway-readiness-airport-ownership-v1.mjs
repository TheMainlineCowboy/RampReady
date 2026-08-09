import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const STATIC_SOURCE_MEASURED_CONNECTOR_AUTHORITY = "57-static-source-measured-real-wall-fixed-terminal-legs-v3";
const STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT = 228;
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

// The static terminal connector is now a source-measured fixed wall-to-Rotunda
// leg. Retire the compact synthetic connector authority in the final readiness
// file so successful real spans (including zero visible overlap and long fixed
// legs) are compared against the runtime that actually built them.
source = source.replace(
  'const STATIC_CONNECTOR_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";',
  `const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOURCE_MEASURED_CONNECTOR_AUTHORITY}";`,
);
if (!source.includes(`const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOURCE_MEASURED_CONNECTOR_AUTHORITY}";`)) {
  throw new Error(`${readinessPath}: source-measured static connector authority could not be installed`);
}
if (source.includes('const STATIC_CONNECTOR_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";')) {
  throw new Error(`${readinessPath}: retired compact static connector authority survived final readiness`);
}

// The original bare source-measured fixed corridors used exactly four box
// surfaces per gate (228 instances total). Simulator-quality corridor panel ribs
// and ground supports deliberately add more instances to the SAME single
// instanced draw batch. Readiness must preserve the structural floor, not reject
// legitimate visual detail for exceeding the old exact count.
const exactStaticCountDeclaration = /const STATIC_CONNECTOR_INSTANCE_COUNT = 228;/g;
const exactStaticCountCondition = /staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT/g;
if (!exactStaticCountDeclaration.test(source)) {
  throw new Error(`${readinessPath}: retired exact static connector instance declaration is missing`);
}
exactStaticCountDeclaration.lastIndex = 0;
source = source.replace(
  exactStaticCountDeclaration,
  `const STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT = ${STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT};`,
);
if (!exactStaticCountCondition.test(source)) {
  throw new Error(`${readinessPath}: retired exact static connector instance assertion is missing`);
}
exactStaticCountCondition.lastIndex = 0;
source = source.replace(
  exactStaticCountCondition,
  "staticConnectorInstanceCount < STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT",
);

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

// The aircraft now conforms to the decoded source jetway Cab endpoint. The
// source-parent bridge heading therefore remains airport-owned; target alignment
// only has to be finite and mathematically valid, while the actual Cab/door
// contact is enforced separately below.
const targetAlignmentCheck = new RegExp(`${targetAlignmentCosine}\\s*<\\s*0\\.99999`);
const targetAlignmentPattern = new RegExp(`${targetAlignmentCosine}\\s*<\\s*0\\.99999`, "g");
if (!targetAlignmentCheck.test(source)) {
  throw new Error(`${readinessPath}: retired source-parent synthetic-target alignment assertion is missing`);
}
source = source.replace(
  targetAlignmentPattern,
  `!Number.isFinite(${targetAlignmentCosine}) || ${targetAlignmentCosine} < -1 || ${targetAlignmentCosine} > 1`,
);

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

// Physical acceptance is the rendered aircraft door at the source jetway Cab.
// Keep a standalone fail-closed check independent of the old large mismatch
// predicate so upstream formatting cannot silently loosen it.
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
  `const STATIC_CONNECTOR_AUTHORITY = "${STATIC_SOURCE_MEASURED_CONNECTOR_AUTHORITY}";`,
  `const STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT = ${STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT};`,
  "staticConnectorInstanceCount < STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT",
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
  'const STATIC_CONNECTOR_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";',
  "const STATIC_CONNECTOR_INSTANCE_COUNT = 228;",
  "staticConnectorInstanceCount !== STATIC_CONNECTOR_INSTANCE_COUNT",
  `Math.abs(${staticFleetGroundYOffset}) > 1e-8`,
  `${targetAlignmentCosine} < 0.99999`,
  `${cabTargetHorizontalError} > 0.06`,
  "Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Infinity) > 0.06",
  "Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Number.POSITIVE_INFINITY) > 0.06",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired aircraft-owned/static-floating/exact-count readiness survived: ${forbidden}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log(`Aligned final exact-jetway readiness with airport-owned geometry and source-measured static connectors (${STATIC_SOURCE_MEASURED_CONNECTOR_AUTHORITY}): all 58 bridges preserve the shared ground offset; static fixed-corridor detail may exceed the ${STATIC_CONNECTOR_MINIMUM_INSTANCE_COUNT}-instance structural floor in the same batch; and the A1 aircraft must conform to the fixed source jetway Cab within 0.06 m.`);
