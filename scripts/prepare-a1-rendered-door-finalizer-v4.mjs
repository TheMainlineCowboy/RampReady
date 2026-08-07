import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const importBlock = `import {
  enforceSourceRegisteredA1RotundaElbow as enforceRenderedDoorA1Elbow,
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY as RENDERED_DOOR_A1_ELBOW_AUTHORITY,
  SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY as RENDERED_DOOR_A1_TARGET_AUTHORITY,
  SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY,
} from "./sourceRegisteredA1RenderedDoorElbowV4.js";`;
if (!source.includes("sourceRegisteredA1RenderedDoorElbowV4")) source = `${importBlock}\n${source}`;

const legacyCall = "          const sourceLockedA1Elbow = enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements);";
const renderedCall = "          const renderedDoorA1Elbow = enforceRenderedDoorA1Elbow(THREE, group, fleet, placements);";
if (!source.includes(renderedCall)) {
  if (!source.includes(legacyCall)) throw new Error(`${readinessPath}: legacy/fixed-wall A1 finalizer call is missing`);
  source = source.replace(legacyCall, `${legacyCall}\n${renderedCall}`);
}

// The earlier readiness layer still contains legacy predictions calculated from
// the old 6.238 m door-Z approximation. V4 measures the final exact Cab against
// the authored rendered door at the fixed A1 source stop instead, so these old
// approximation gates must not override the final physical measurement.
for (const pattern of [
  /\n\s*\|\| !\(a1TargetDoorDistance > 0\)/g,
  /\n\s*\|\| !\(a1AttachedExtension > 3 && a1AttachedExtension < 7\)/g,
  /\n\s*\|\| a1PredictedDoorGap > 0\.05/g,
  /\n\s*\|\| Math\.abs\(a1PredictedContactDistance - a1TargetDoorDistance\) > 0\.05/g,
  /\n\s*\|\| Math\.abs\(a1ActualContactDistance - a1TargetDoorDistance\) > 0\.05/g,
  /\n\s*\|\| a1ActualDoorGap > 0\.05/g,
]) source = source.replace(pattern, "");

source = source.replaceAll(
  "sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY",
  "sourceLockedA1Authority !== RENDERED_DOOR_A1_ELBOW_AUTHORITY",
);
source = source.replaceAll(
  "targetDirectionAuthority !== SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY",
  "targetDirectionAuthority !== RENDERED_DOOR_A1_TARGET_AUTHORITY",
);

const authorityCondition = "            || sourceLockedA1Authority !== RENDERED_DOOR_A1_ELBOW_AUTHORITY";
const physicalConditions = `${authorityCondition}
            || group.userData.uploadedJetwayA1TelescopingAuthority !== SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY
            || Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Infinity) > 0.06
            || Math.abs(Number(group.userData.uploadedJetwayA1ActualContactDistanceMeters ?? NaN) - Number(group.userData.uploadedJetwayA1TargetDoorDistanceMeters ?? NaN)) > 0.06
            || Math.abs(Number(group.userData.uploadedJetwayA1PredictedDoorGapMeters ?? Infinity)) > 0.06`;
if (!source.includes("uploadedJetwayA1TelescopingAuthority !== SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY")) {
  if (!source.includes(authorityCondition)) throw new Error(`${readinessPath}: rendered-door A1 authority condition anchor is missing`);
  source = source.replace(authorityCondition, physicalConditions);
}

if (!source.includes("renderedDoorA1Elbow,")) {
  const returnAnchor = "            sourceLockedA1Elbow,";
  if (source.includes(returnAnchor)) source = source.replace(returnAnchor, `${returnAnchor}\n            renderedDoorA1Elbow,`);
}

for (const token of [
  "sourceRegisteredA1RenderedDoorElbowV4",
  "enforceRenderedDoorA1Elbow(THREE, group, fleet, placements)",
  "RENDERED_DOOR_A1_ELBOW_AUTHORITY",
  "RENDERED_DOOR_A1_TARGET_AUTHORITY",
  "SOURCE_REGISTERED_A1_TELESCOPING_AUTHORITY",
  "uploadedJetwayA1CabTargetHorizontalErrorMeters",
  "renderedDoorA1Elbow,",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: rendered-door final readiness is missing ${token}`);
}
for (const forbidden of [
  "!(a1AttachedExtension > 3 && a1AttachedExtension < 7)",
  "a1PredictedDoorGap > 0.05",
  "Math.abs(a1PredictedContactDistance - a1TargetDoorDistance) > 0.05",
  "Math.abs(a1ActualContactDistance - a1TargetDoorDistance) > 0.05",
  "a1ActualDoorGap > 0.05",
]) {
  if (source.includes(forbidden)) throw new Error(`${readinessPath}: obsolete approximate A1 door gate remains: ${forbidden}`);
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Prepared final A1 readiness from the actual authored rendered forward-left CRJ door at the fixed source stop: the real wall/Rotunda stays fixed, the exact bridge pivots toward the door, and only Tunnel B/C/Cab telescope to close the remaining measured horizontal gap.");
