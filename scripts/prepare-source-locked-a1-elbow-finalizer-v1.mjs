import fs from "node:fs";
import { execFileSync } from "node:child_process";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceRegisteredImport = `import {
  enforceSourceRegisteredA1RotundaElbow,
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
} from "./sourceRegisteredA1RotundaElbowV2.js";`;

// Re-establish the committed readiness baseline after the historical A1
// migration stack has run. Those migrations still provide exact-model,
// articulation and grounding diagnostics, but their rigid-parent/zero-angle
// assumptions are not allowed to own the final A1 placement. The stock BGL
// record identifies the real wall ray and aircraft-side heading; the supplied
// replacement Rotunda is photo-registered to that wall independently.
let source = execFileSync("git", ["show", `HEAD:${readinessPath}`], { encoding: "utf8" });
if (!source.includes("correctUploadedJetwayInstallation")) {
  throw new Error(`${readinessPath}: committed readiness baseline is missing the installation correction`);
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
          const apronFacingOpenAreaMeters = Number(group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters ?? Infinity);`;
if (!source.includes("const sourceLockedA1Authority")) {
  if (!source.includes(magnitudeBlock)) throw new Error(`${readinessPath}: terminal direction magnitude anchor is missing`);
  source = source.replace(magnitudeBlock, sourceLockEvidenceBlock);
}

// A zero portal-angle error was a regression guard for the obsolete straight
// installation. A1 must instead prove: the source aircraft-side yaw survives,
// the exact Rotunda is registered to the measured real wall, the terminal leg
// is the photo-matched compact 2.4 m span, and the Rotunda produces a visible
// corner into the authored movable bridge.
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > 1e-6/g, "");
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
  if (!source.includes(returnAnchor)) throw new Error(`${readinessPath}: installation correction return anchor is missing`);
  source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
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
  "sourceLockedA1Elbow,",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: photo-registered Rotunda finalizer is missing ${token}`);
}
if (source.includes("|| a1PortalAlignmentError > 1e-6")) {
  throw new Error(`${readinessPath}: obsolete zero-angle A1 portal gate remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?photo-registered-rotunda=${Date.now()}`);
console.log("Prepared final A1 readiness: exact source aircraft-side yaw, photo-registered Rotunda at the real Terminal 4 wall, compact 2.4 m fixed terminal leg, visible Rotunda elbow, exact supplied child hierarchy, measured ground contact, and no T4_WALK targeting.");
