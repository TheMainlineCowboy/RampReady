import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceRegisteredImport = `import {
  enforceSourceRegisteredA1RotundaElbow,
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
  SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY,
} from "./sourceRegisteredA1RotundaElbowV3.js";`;
const staticRegistrationImport = `import {
  registerStaticJetwayFleetToFacade,
  STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
} from "./registerStaticJetwayFleetToFacadeV1.js";`;
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";

let source = fs.readFileSync(readinessPath, "utf8");
if (!source.includes("correctUploadedJetwayInstallation")) {
  throw new Error(`${readinessPath}: current prepared readiness layer is missing installation correction`);
}

source = source.replace(/import \{[\s\S]*?SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,[\s\S]*?\} from "\.\/sourceRegisteredA1RotundaElbowV2\.js";\n?/, "");
source = source.replace(/import \{[\s\S]*?SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY,[\s\S]*?\} from "\.\/sourceRegisteredA1RotundaElbowV3\.js";\n?/, "");
source = `${sourceRegisteredImport}\n${source}`;

if (!source.includes("registerStaticJetwayFleetToFacadeV1")) {
  source = `${staticRegistrationImport}\n${source}`;
} else if (!source.includes("STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY")) {
  source = source.replace(
    "  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,\n} from \"./registerStaticJetwayFleetToFacadeV1.js\";",
    "  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,\n  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,\n} from \"./registerStaticJetwayFleetToFacadeV1.js\";",
  );
}

const correctionCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const staticCall = "          const staticFleetRegistration = registerStaticJetwayFleetToFacade(THREE, group, fleet, placements);";
const a1Call = "          const sourceLockedA1Elbow = enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements);";
if (!source.includes(staticCall)) {
  if (!source.includes(correctionCall)) throw new Error(`${readinessPath}: installation correction call anchor is missing`);
  source = source.replace(correctionCall, `${correctionCall}\n${staticCall}`);
}
if (!source.includes(a1Call)) {
  if (!source.includes(staticCall)) throw new Error(`${readinessPath}: static fleet registration call anchor is missing`);
  source = source.replace(staticCall, `${staticCall}\n${a1Call}`);
}
source = source.replace(`${correctionCall}\n${a1Call}\n${staticCall}`, `${correctionCall}\n${staticCall}\n${a1Call}`);

const magnitudeBlock = `          const terminalDirectionMagnitude = Math.hypot(
            Number(a1TerminalDirection[0] ?? NaN),
            Number(a1TerminalDirection[1] ?? NaN),
          );`;
const evidenceStart = source.indexOf("          const staticFacadeRegistrationAuthority =");
const ifStart = source.indexOf("\n          if (\n", evidenceStart >= 0 ? evidenceStart : source.indexOf(magnitudeBlock));
if (ifStart < 0) throw new Error(`${readinessPath}: readiness condition block is missing`);
if (evidenceStart >= 0) source = source.slice(0, evidenceStart) + source.slice(ifStart + 1);

const evidence = `${magnitudeBlock}
          const staticFacadeRegistrationAuthority = group.userData.uploadedJetwayStaticFacadeRegistrationAuthority || "missing";
          const staticFacadeRegisteredGateCount = Number(group.userData.uploadedJetwayStaticFacadeRegisteredGateCount ?? -1);
          const staticFacadeMaximumWallError = Number(group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters ?? Infinity);
          const staticPhysicalRotundaMaximumError = Number(group.userData.uploadedJetwayStaticPhysicalRotundaMaximumErrorMeters ?? Infinity);
          const staticModelRootOffsetAuthority = group.userData.uploadedJetwayStaticModelRootOffsetAuthority || "missing";
          const staticAuthoredRotundaOffsetHorizontal = Number(group.userData.uploadedJetwayStaticAuthoredRotundaOffsetHorizontalMeters ?? NaN);
          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);
          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);
          const staticGroundIsolationAuthority = group.userData.uploadedJetwayGroundIsolationAuthority || "missing";
          const staticFleetGroundYOffset = Number(group.userData.uploadedJetwayStaticFleetGroundYOffsetMeters ?? Infinity);
          const sourceLockedA1Authority = group.userData.uploadedJetwayA1SourceLockedElbowAuthority || "missing";
          const targetDirectionAuthority = group.userData.uploadedJetwayA1TargetDirectionAuthority || "missing";
          const targetAlignmentCosine = Number(group.userData.uploadedJetwayA1TargetAlignmentCosine ?? -1);
          const sourceDoorTargetDistance = Number(group.userData.uploadedJetwayA1SourceDoorTargetDistanceMeters ?? NaN);
          const rotundaPreservationError = Number(group.userData.uploadedJetwayA1RotundaPreservationErrorMeters ?? Infinity);
          const sourceLockedA1CornerAngle = Number(group.userData.uploadedJetwayA1TerminalCornerAngleDegrees ?? NaN);
          const sourceLockedA1VisibleLeg = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);
          const sourceLockedA1WallDistance = Number(group.userData.uploadedJetwayA1TerminalWallDistanceMeters ?? NaN);
          const sourceLockedA1Rotunda = group.userData.uploadedJetwayA1SourceLockedRotunda === true;
          const terminalSideIndependent = group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis === true;
          const passengerPassageBlocked = group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked === true;
          const apronFacingOpenAreaMeters = Number(group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters ?? Infinity);
          const cabTargetHorizontalError = Number(group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters ?? Infinity);`;

if (!source.includes(magnitudeBlock)) throw new Error(`${readinessPath}: terminal direction magnitude anchor is missing`);
source = source.replace(magnitudeBlock, evidence);

source = source.replace(/\n\s*\|\| a1PortalAlignmentError > [0-9.eE+-]+/g, "");
source = source.replace(/\n\s*\|\| !\(bogieTireCorrection > 0\.04 && bogieTireCorrection < 0\.1\)/g,
  `\n            || !Number.isFinite(bogieTireCorrection)\n            || bogieTireCorrection > 3`);

const partOrderCondition = "            || !a1PartOrderValid";
const conditionStart = source.indexOf(partOrderCondition);
const conditionEnd = source.indexOf("            || exactModelGuard.authority", conditionStart);
if (conditionStart < 0 || conditionEnd < 0) throw new Error(`${readinessPath}: A1 readiness condition boundaries are missing`);
const replacementConditions = `${partOrderCondition}
            || !Number.isFinite(bogieTireCorrection)
            || bogieTireCorrection > 3
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${BOGIE_GROUND_AUTHORITY}"
            || bogieGroundContactPointCount < 8
            || bogieGroundContactClusterCount < 2
            || bogieGroundHorizontalContactSpan < 1.2
            || staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY
            || staticFacadeRegisteredGateCount !== 57
            || staticFacadeMaximumWallError > 1e-6
            || staticPhysicalRotundaMaximumError > 1e-6
            || staticModelRootOffsetAuthority !== STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY
            || !Number.isFinite(staticAuthoredRotundaOffsetHorizontal)
            || staticAuthoredRotundaOffsetHorizontal > 12
            || Math.abs(staticRotundaCenterToWall - 3.98) > 0.001
            || Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001
            || staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY
            || Math.abs(staticFleetGroundYOffset) > 1e-8
            || sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY
            || targetDirectionAuthority !== SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY
            || targetAlignmentCosine < 0.99999
            || !(sourceDoorTargetDistance > 15 && sourceDoorTargetDistance < 45)
            || rotundaPreservationError > 1e-6
            || Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.025
            || !(sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8)
            || !(sourceLockedA1CornerAngle >= 45 && sourceLockedA1CornerAngle <= 150)
            || !sourceLockedA1Rotunda
            || !terminalSideIndependent
            || passengerPassageBlocked
            || apronFacingOpenAreaMeters > 0.001
            || !Number.isFinite(cabTargetHorizontalError)
`;
source = source.slice(0, conditionStart) + replacementConditions + source.slice(conditionEnd);

if (!source.includes("staticFleetRegistration,")) {
  const returnAnchor = "            installationCorrection,";
  if (source.includes(returnAnchor)) source = source.replace(returnAnchor, `${returnAnchor}\n            staticFleetRegistration,`);
}
if (!source.includes("sourceLockedA1Elbow,")) {
  const returnAnchor = "            staticFleetRegistration,";
  if (source.includes(returnAnchor)) source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
}

for (const token of [
  "sourceRegisteredA1RotundaElbowV3",
  "SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY",
  "registerStaticJetwayFleetToFacade(THREE, group, fleet, placements)",
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  "sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY",
  "targetDirectionAuthority !== SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY",
  "targetAlignmentCosine < 0.99999",
  "rotundaPreservationError > 1e-6",
  "sourceLockedA1CornerAngle >= 45",
  "bogieGroundContactClusterCount < 2",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: fixed-gate A1 readiness is missing ${token}`);
}
for (const forbidden of [
  "sourceRegisteredA1RotundaElbowV2",
  "sourceLockedA1YawError",
  "sourceYawPreserved",
  "a1PortalAlignmentError >",
  "bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1",
]) {
  if (source.includes(forbidden)) throw new Error(`${readinessPath}: obsolete A1 bridge-following readiness remains: ${forbidden}`);
}

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?fixed-gate-a1-elbow=${Date.now()}`);
console.log("Prepared final Terminal 4 jetway readiness with the real A1 wall/Rotunda joint fixed in place and the complete supplied aircraft-side bridge pivoted toward the original A1 door target. The aircraft/gate stop owns the bridge heading; the airplane is no longer allowed to validate a bad bridge by following the Cab.");
