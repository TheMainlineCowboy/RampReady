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
  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
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
source = source.replace(
  `${correctionCall}\n${a1Call}\n${staticCall}`,
  `${correctionCall}\n${staticCall}\n${a1Call}`,
);

const magnitudeBlock = `          const terminalDirectionMagnitude = Math.hypot(
            Number(a1TerminalDirection[0] ?? NaN),
            Number(a1TerminalDirection[1] ?? NaN),
          );`;
const staticEvidence = `          const staticFacadeRegistrationAuthority = group.userData.uploadedJetwayStaticFacadeRegistrationAuthority || "missing";
          const staticFacadeRegisteredGateCount = Number(group.userData.uploadedJetwayStaticFacadeRegisteredGateCount ?? -1);
          const staticFacadeMaximumWallError = Number(group.userData.uploadedJetwayStaticFacadeMaximumWallErrorMeters ?? Infinity);
          const staticPhysicalRotundaMaximumError = Number(group.userData.uploadedJetwayStaticPhysicalRotundaMaximumErrorMeters ?? Infinity);
          const staticModelRootOffsetAuthority = group.userData.uploadedJetwayStaticModelRootOffsetAuthority || "missing";
          const staticAuthoredRotundaOffsetX = Number(group.userData.uploadedJetwayStaticAuthoredRotundaOffsetX ?? NaN);
          const staticAuthoredRotundaOffsetZ = Number(group.userData.uploadedJetwayStaticAuthoredRotundaOffsetZ ?? NaN);
          const staticAuthoredRotundaOffsetHorizontal = Number(group.userData.uploadedJetwayStaticAuthoredRotundaOffsetHorizontalMeters ?? NaN);
          const staticRotundaCenterToWall = Number(group.userData.uploadedJetwayStaticRotundaCenterToWallMeters ?? NaN);
          const staticVisibleTerminalLeg = Number(group.userData.uploadedJetwayStaticVisibleTerminalLegMeters ?? NaN);
          const staticGroundIsolationAuthority = group.userData.uploadedJetwayGroundIsolationAuthority || "missing";
          const staticFleetGroundYOffset = Number(group.userData.uploadedJetwayStaticFleetGroundYOffsetMeters ?? Infinity);`;
const sourceLockEvidenceBlock = `${magnitudeBlock}
${staticEvidence}
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
} else {
  const start = source.indexOf("          const staticFacadeRegistrationAuthority =");
  const end = source.indexOf("          const sourceLockedA1Authority =");
  if (start >= 0 && end > start) source = `${source.slice(0, start)}${staticEvidence}\n${source.slice(end)}`;
  else if (end >= 0) source = `${source.slice(0, end)}${staticEvidence}\n${source.slice(end)}`;
}

source = source.replace(/\n\s*\|\| a1PortalAlignmentError > 1e-6/g, "");
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > [0-9.eE+-]+/g, "");
source = source.replace(
  /\n\s*\|\| !\(bogieTireCorrection > 0\.04 && bogieTireCorrection < 0\.1\)/g,
  `
            || !Number.isFinite(bogieTireCorrection)
            || bogieTireCorrection > 3`,
);

const partOrderCondition = "            || !a1PartOrderValid";
const staticConditions = `            || staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY
            || staticFacadeRegisteredGateCount !== 57
            || staticFacadeMaximumWallError > 1e-6
            || staticPhysicalRotundaMaximumError > 1e-6
            || staticModelRootOffsetAuthority !== STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY
            || !Number.isFinite(staticAuthoredRotundaOffsetX)
            || !Number.isFinite(staticAuthoredRotundaOffsetZ)
            || !Number.isFinite(staticAuthoredRotundaOffsetHorizontal)
            || staticAuthoredRotundaOffsetHorizontal > 12
            || Math.abs(staticRotundaCenterToWall - 3.98) > 0.001
            || Math.abs(staticVisibleTerminalLeg - 2.4) > 0.001
            || staticGroundIsolationAuthority !== STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY
            || Math.abs(staticFleetGroundYOffset) > 1e-8`;
const sourceLockConditions = `${partOrderCondition}
            || !Number.isFinite(bogieTireCorrection)
            || bogieTireCorrection > 3
            || Math.abs(bogieGroundClearance) > 0.005
            || bogieGroundContactAuthority !== "${BOGIE_GROUND_AUTHORITY}"
            || bogieGroundContactPointCount < 8
            || bogieGroundContactClusterCount < 2
            || bogieGroundHorizontalContactSpan < 1.2
${staticConditions}
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
} else {
  const conditionStart = source.indexOf("            || staticFacadeRegistrationAuthority !== STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY");
  const sourceCondition = source.indexOf("            || sourceLockedA1Authority !== SOURCE_REGISTERED_A1_ELBOW_AUTHORITY");
  if (conditionStart >= 0 && sourceCondition > conditionStart) {
    source = `${source.slice(0, conditionStart)}${staticConditions}\n${source.slice(sourceCondition)}`;
  } else if (sourceCondition >= 0) {
    source = `${source.slice(0, sourceCondition)}${staticConditions}\n${source.slice(sourceCondition)}`;
  }
}

if (!source.includes("staticFleetRegistration,")) {
  const returnAnchor = "            installationCorrection,";
  if (source.includes(returnAnchor)) source = source.replace(returnAnchor, `${returnAnchor}\n            staticFleetRegistration,`);
}
if (!source.includes("sourceLockedA1Elbow,")) {
  const returnAnchor = "            staticFleetRegistration,";
  if (source.includes(returnAnchor)) source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
}

for (const token of [
  "registerStaticJetwayFleetToFacadeV1",
  "registerStaticJetwayFleetToFacade(THREE, group, fleet, placements)",
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  "staticFacadeRegisteredGateCount !== 57",
  "staticPhysicalRotundaMaximumError > 1e-6",
  "staticModelRootOffsetAuthority !== STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
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
if (/\|\| a1PortalAlignmentError >/.test(source)) throw new Error(`${readinessPath}: obsolete straight-A1 portal alignment gate remains`);
if (source.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) throw new Error(`${readinessPath}: obsolete fixed bogie-correction range remains`);

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?photo-registered-static-and-a1=${Date.now()}`);
console.log("Prepared final Terminal 4 jetway readiness on the current migration layer: all 57 static exact GLBs now register their physical authored Rotundas, not model roots, to measured facade points while remaining on pavement; A1 receives isolated grounding, preserves source aircraft-side yaw, attaches through the compact 2.4 m real-building leg, requires a visible Rotunda elbow, and rejects T4_WALK/straight-portal targeting.");
