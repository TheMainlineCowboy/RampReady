import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceRegisteredImport = `import {
  enforceSourceRegisteredA1RotundaElbow,
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
} from "./sourceRegisteredA1RotundaElbowV2.js";`;
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

const correctionCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const finalizerCall = `${correctionCall}
          const sourceLockedA1Elbow = enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements);`;
if (!source.includes("const sourceLockedA1Elbow = enforceSourceRegisteredA1RotundaElbow")) {
  if (!source.includes(correctionCall)) throw new Error(`${readinessPath}: installation correction call anchor is missing`);
  source = source.replace(correctionCall, finalizerCall);
}

const magnitudeBlock = `          const terminalDirectionMagnitude = Math.hypot(
            Number(a1TerminalDirection[0] ?? NaN),
            Number(a1TerminalDirection[1] ?? NaN),
          );`;
const sourceLockEvidenceBlock = `${magnitudeBlock}
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
          const apronFacingOpenAreaMeters = Number(group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters ?? Infinity);
          const bogieGroundClearanceMeters = Number(group.userData.uploadedJetwayBogieGroundClearanceMeters ?? Infinity);
          const bogieGroundContactAuthority = group.userData.uploadedJetwayBogieGroundContactAuthority || "missing";
          const bogieGroundContactPointCount = Number(group.userData.uploadedJetwayBogieGroundContactPointCount ?? -1);
          const bogieGroundContactClusterCount = Number(group.userData.uploadedJetwayBogieGroundContactClusterCount ?? -1);
          const bogieGroundHorizontalContactSpanMeters = Number(group.userData.uploadedJetwayBogieGroundHorizontalContactSpanMeters ?? -1);`;
if (!source.includes("const sourceLockedA1Authority")) {
  if (!source.includes(magnitudeBlock)) throw new Error(`${readinessPath}: terminal direction magnitude anchor is missing`);
  source = source.replace(magnitudeBlock, sourceLockEvidenceBlock);
}

// The old zero-angle portal assertion is the exact regression that flattened
// A1's real Rotunda corner. Remove only that obsolete geometric assumption.
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > 1e-6/g, "");
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > [0-9.eE+-]+/g, "");

// Replace the old hand-tuned 0.04–0.10 m vertical-offset range with direct
// authored-geometry ramp contact. The measured parent correction may be any
// sane finite value; what matters is that the exact supplied geometry actually
// lands on the ramp with a credible multi-point footprint.
source = source.replace(
  /\n\s*\|\| !\(bogieTireCorrection > 0\.04 && bogieTireCorrection < 0\.1\)/g,
  `
            || !Number.isFinite(bogieTireCorrection)
            || bogieTireCorrection > 3
            || Math.abs(bogieGroundClearanceMeters) > 0.005
            || bogieGroundContactAuthority !== "${BOGIE_GROUND_AUTHORITY}"
            || bogieGroundContactPointCount < 8
            || bogieGroundContactClusterCount < 2
            || bogieGroundHorizontalContactSpanMeters < 1.2`,
);

const partOrderCondition = "            || !a1PartOrderValid";
const sourceLockConditions = `${partOrderCondition}
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
}

if (!source.includes("sourceLockedA1Elbow,")) {
  const returnAnchor = "            installationCorrection,";
  if (source.includes(returnAnchor)) {
    source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
  }
}

for (const token of [
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
  "bogieGroundClearanceMeters",
  "bogieGroundContactAuthority",
  `"${BOGIE_GROUND_AUTHORITY}"`,
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpanMeters < 1.2",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: final A1 readiness is missing ${token}`);
}
if (/\|\| a1PortalAlignmentError >/.test(source)) {
  throw new Error(`${readinessPath}: obsolete straight-A1 portal alignment gate remains`);
}
if (source.includes("bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1")) {
  throw new Error(`${readinessPath}: obsolete fixed bogie-correction range remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?photo-registered-rotunda=${Date.now()}`);
console.log("Prepared final A1 readiness on the current migration layer: direct exact-geometry ramp contact replaces the obsolete fixed offset range; source aircraft-side yaw is preserved; the supplied Rotunda is photo-registered to the real Terminal 4 wall through the compact 2.4 m fixed leg; a visible Rotunda elbow is mandatory; T4_WALK/straight-portal targeting is rejected.");
