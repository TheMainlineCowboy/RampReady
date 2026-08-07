import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceRegisteredImport = `import {
  enforceSourceRegisteredA1RotundaElbow,
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
} from "./sourceRegisteredA1RotundaElbowV2.js";`;
const staticRegistrationImport = `import {
  registerStaticJetwayFleetToFacade,
  STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
} from "./registerStaticJetwayFleetToFacadeV1.js";`;
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";

// Operate on the CURRENT prepared readiness layer. The production migration
// stack upgrades grounding, static-fleet closure and visual acceptance before
// this finalizer runs. Never rebuild readiness from the old committed baseline.
let source = fs.readFileSync(readinessPath, "utf8");
if (!source.includes("correctUploadedJetwayInstallation")) {
  throw new Error(`${readinessPath}: current prepared readiness layer is missing installation correction`);
}

if (!source.includes("sourceRegisteredA1RotundaElbowV2")) {
  source = `${sourceRegisteredImport}\n${source}`;
}
if (!source.includes("registerStaticJetwayFleetToFacadeV1")) {
  source = `${staticRegistrationImport}\n${source}`;
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
// If an older prepared copy already put A1 immediately after correction, move
// static registration ahead of A1. A1 world geometry must be preserved while
// the shared fleet Y offset is transferred onto the individual A1 anchor.
source = source.replace(
  `${correctionCall}\n${a1Call}\n${staticCall}`,
  `${correctionCall}\n${staticCall}\n${a1Call}`,
);

const magnitudeBlock = `          const terminalDirectionMagnitude = Math.hypot(
            Number(a1TerminalDirection[0] ?? NaN),
            Number(a1TerminalDirection[1] ?? NaN),
          );`;
const sourceLockEvidenceBlock = `${magnitudeBlock}
          const staticFacadeRegistrationAuthority = group.userData.uploadedJetwayStaticFacadeRegistrationAuthority || "missing";
          const staticFacadeRegisteredGateCount = Number(group.userData.uploadedJetwayStaticFacadeRegisteredGateCount ?? -1);
          const staticFacadeMaximumWallError = Number(group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters ?? Infinity);
          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);
          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);
          const staticGroundIsolationAuthority = group.userData.uploadedJetwayGroundIsolationAuthority || "missing";
          const staticFleetGroundYOffset = Number(group.userData.uploadedJetwayStaticFleetGroundYOffsetMeters ?? Infinity);
          const sourceLockedA1Authority = group.userData.uploadedJetwayA1SourceLockedElbowAuthority || "missing";
          const sourceLockedA1PoseError = Number(group.userData.uploadedJetwayA1SourcePoseErrorMeters ?? Infinity);
          const sourceLockedA1YawError = Number(group.userData.uploadedJetwayA1SourceYawErrorRadians ?? Infinity);
          const sourceLockedA1CornerAngle = Number(group.userData.uploadedJetwayA1TerminalCornerAngleDegrees ?? NaN);
          const sourceLockedA1VisibleLeg = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);
          const sourceLockedA1WallDistance = Number(group.userData.uploadedJetwayA1TerminalWallDistanceMeters ?? NaN);
          const sourceLockedA1Rotunda = group.userData.uploadedJetwayA1SourceLockedRotunda === true;
          const sourceYawPreserved = group.userData.uploadedJetwayA1SourceYawPreserved === true;
          const terminalSideIndependent = group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis === true;
          const passengerPassageBlocked = group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked === true;
          const apronFacingOpenAreaMeters = Number(group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters ?? Infinity);`;
if (!source.includes("const sourceLockedA1Authority")) {
  if (!source.includes(magnitudeBlock)) throw new Error(`${readinessPath}: terminal direction magnitude anchor is missing`);
  source = source.replace(magnitudeBlock, sourceLockEvidenceBlock);
} else if (!source.includes("const staticFacadeRegistrationAuthority")) {
  const sourceLockAnchor = "          const sourceLockedA1Authority = group.userData.uploadedJetwayA1SourceLockedElbowAuthority || \"missing\";";
  if (!source.includes(sourceLockAnchor)) throw new Error(`${readinessPath}: source-locked evidence anchor is missing`);
  source = source.replace(sourceLockAnchor, `          const staticFacadeRegistrationAuthority = group.userData.uploadedJetwayStaticFacadeRegistrationAuthority || "missing";
          const staticFacadeRegisteredGateCount = Number(group.userData.uploadedJetwayStaticFacadeRegisteredGateCount ?? -1);
          const staticFacadeMaximumWallError = Number(group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters ?? Infinity);
          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);
          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);
          const staticGroundIsolationAuthority = group.userData.uploadedJetwayGroundIsolationAuthority || "missing";
          const staticFleetGroundYOffset = Number(group.userData.uploadedJetwayStaticFleetGroundYOffsetMeters ?? Infinity);
${sourceLockAnchor}`);
}

// The old zero-angle portal assertion is the exact regression that flattened
// A1's real Rotunda corner. Remove only that obsolete geometric assumption.
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > 1e-6/g, "");
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > [0-9.eE+-]+/g, "");

// Replace the old hand-tuned 0.04–0.10 m vertical-offset range when it still
// survives. The later grounding migration already owns the detailed evidence
// declarations; this finalizer must consume them, not redeclare them.
source = source.replace(
  /\n\s*\|\| !\(bogieTireCorrection > 0\.04 && bogieTireCorrection < 0\.1\)/g,
  `
            || !Number.isFinite(bogieTireCorrection)
            || bogieTireCorrection > 3`,
);

const partOrderCondition = "            || !a1PartOrderValid";
const sourceLockConditions = `${partOrderCondition}
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
            || Math.abs(staticRotundaCenterToWall - 3.98) > 0.001
            || Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001
            || staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY
            || Math.abs(staticFleetGroundYOffset) > 1e-8
            || sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY
            || sourceLockedA1PoseError > 1e-6
            || sourceLockedA1YawError > 1e-7
            || Math.abs(sourceLockedA1VisibleLeg - 2.4) > 0.025
            || !(sourceLockedA1WallDistance >= 2.9 && sourceLockedA1WallDistance <= 5.8)
            || !(sourceLockedA1CornerAngle >= 35 && sourceLockedA1CornerAngle <= 135)
            || !sourceLockedA1Rotunda
            || !sourceYawPreserved
            || !terminalSideIndependent
            || passengerPassageBlocked
            || apronFacingOpenAreaMeters > 0.001`;
if (!source.includes("sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY")) {
  if (!source.includes(partOrderCondition)) throw new Error(`${readinessPath}: A1 part-order condition anchor is missing`);
  source = source.replace(partOrderCondition, sourceLockConditions);
} else if (!source.includes("staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY")) {
  const sourceConditionAnchor = "            || sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY";
  if (!source.includes(sourceConditionAnchor)) throw new Error(`${readinessPath}: A1 source authority condition anchor is missing`);
  source = source.replace(sourceConditionAnchor, `            || staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY
            || staticFacadeRegisteredGateCount !== 57
            || staticFacadeMaximumWallError > 1e-6
            || Math.abs(staticRotundaCenterToWall - 3.98) > 0.001
            || Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001
            || staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY
            || Math.abs(staticFleetGroundYOffset) > 1e-8
${sourceConditionAnchor}`);
}

if (!source.includes("staticFleetRegistration,")) {
  const returnAnchor = "            installationCorrection,";
  if (source.includes(returnAnchor)) {
    source = source.replace(returnAnchor, `${returnAnchor}\n            staticFleetRegistration,`);
  }
}
if (!source.includes("sourceLockedA1Elbow,")) {
  const returnAnchor = "            staticFleetRegistration,";
  if (source.includes(returnAnchor)) {
    source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
  }
}

for (const token of [
  "registerStaticJetwayFleetToFacadeV1",
  "registerStaticJetwayFleetToFacade(THREE, group, fleet, placements)",
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "staticFacadeRegisteredGateCount !== 57",
  "Math.abs(staticFleetGroundYOffset) > 1e-8",
  "sourceRegisteredA1RotundaElbowV2",
  "enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements)",
  "SOURCE_REGISTERED_A1_ELBOW_AUTHORITY",
  "uploadedJetwayA1SourcePoseErrorMeters",
  "uploadedJetwayA1SourceYawErrorRadians",
  "uploadedJetwayA1TerminalCornerAngleDegrees",
  "uploadedJetwayA1VisibleVestibuleLengthMeters",
  "sourceLockedA1CornerAngle >= 35",
  "sourceYawPreserved",
  "uploadedJetwayA1TerminalSideIndependentFromTunnelAxis",
  "uploadedJetwayA1PassengerPassageCrossSectionBlocked",
  "bogieGroundClearance",
  "bogieGroundContactAuthority",
  `"${BOGIE_GROUND_AUTHORITY}"`,
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: final exact-jetway readiness is missing ${token}`);
}
if (/\|\| a1PortalAlignmentError >/.test(source)) {
  throw new Error(`${readinessPath}: obsolete straight-A1 portal alignment gate remains`);
}
if (source.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) {
  throw new Error(`${readinessPath}: obsolete fixed bogie-correction range remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?photo-registered-static-and-a1=${Date.now()}`);
console.log("Prepared final Terminal 4 jetway readiness on the current migration layer: the 57 static supplied bridges stay on their normalized pavement plane and their Rotundas are registered to measured terminal facade points; A1 receives its own grounding transfer, preserves source aircraft-side yaw, attaches through the compact 2.4 m real-building leg, requires a visible Rotunda elbow, and rejects T4_WALK/straight-portal targeting.");
