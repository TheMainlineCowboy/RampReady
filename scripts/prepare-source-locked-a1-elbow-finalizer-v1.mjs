import fs from "node:fs";
import { execFileSync } from "node:child_process";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const sourceLockedImport = `import {
  enforceSourceLockedA1Elbow,
  SOURCE_LOCKED_A1_ELBOW_AUTHORITY,
} from "./sourceLockedA1ElbowV1.js";`;

// Re-establish the committed readiness baseline after the historical A1
// migration stack has run. Those migrations were useful for diagnostics and
// grounding, but some also added zero-angle portal assumptions that are
// incompatible with the real A1 Rotunda elbow. The exact supplied GLB remains
// corrected/grounded by that stack; this final readiness layer owns the final
// source parent pose and terminal-side leg.
let source = execFileSync("git", ["show", `HEAD:${readinessPath}`], { encoding: "utf8" });
if (!source.includes("correctUploadedJetwayInstallation")) {
  throw new Error(`${readinessPath}: committed readiness baseline is missing the installation correction`);
}

if (!source.includes("sourceLockedA1ElbowV1")) {
  source = `${sourceLockedImport}\n${source}`;
}

const correctionCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const finalizerCall = `${correctionCall}
          const sourceLockedA1Elbow = enforceSourceLockedA1Elbow(THREE, group, fleet, placements);`;
if (!source.includes("const sourceLockedA1Elbow = enforceSourceLockedA1Elbow")) {
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
          const sourceLockedA1CornerAngle = Number(group.userData.uploadedJetwayA1TerminalCornerAngleDegrees ?? NaN);
          const sourceLockedA1Rotunda = group.userData.uploadedJetwayA1SourceLockedRotunda === true;
          const terminalSideIndependent = group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis === true;
          const passengerPassageBlocked = group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked === true;
          const apronFacingOpenAreaMeters = Number(group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters ?? Infinity);`;
if (!source.includes("const sourceLockedA1Authority")) {
  if (!source.includes(magnitudeBlock)) throw new Error(`${readinessPath}: terminal direction magnitude anchor is missing`);
  source = source.replace(magnitudeBlock, sourceLockEvidenceBlock);
}

// A zero portal-angle error was a regression guard for the obsolete straight
// installation. A1 must instead prove that its complete parent is exactly back
// at the source pose and that the terminal-side leg meets the aircraft-side
// bridge through a visible Rotunda corner.
source = source.replace(/\n\s*\|\| a1PortalAlignmentError > 1e-6/g, "");
const partOrderCondition = "            || !a1PartOrderValid";
const sourceLockConditions = `${partOrderCondition}
            || sourceLockedA1Authority !== SOURCE_LOCKED_A1_ELBOW_AUTHORITY
            || sourceLockedA1PoseError > 1e-7
            || !(sourceLockedA1CornerAngle >= 20 && sourceLockedA1CornerAngle <= 150)
            || !sourceLockedA1Rotunda
            || !terminalSideIndependent
            || passengerPassageBlocked
            || apronFacingOpenAreaMeters > 0.001`;
if (!source.includes("sourceLockedA1Authority !== SOURCE_LOCKED_A1_ELBOW_AUTHORITY")) {
  if (!source.includes(partOrderCondition)) throw new Error(`${readinessPath}: A1 part-order condition anchor is missing`);
  source = source.replace(partOrderCondition, sourceLockConditions);
}

if (!source.includes("sourceLockedA1Elbow,")) {
  const returnAnchor = "            installationCorrection,";
  if (!source.includes(returnAnchor)) throw new Error(`${readinessPath}: installation correction return anchor is missing`);
  source = source.replace(returnAnchor, `${returnAnchor}\n            sourceLockedA1Elbow,`);
}

for (const token of [
  "sourceLockedA1ElbowV1",
  "enforceSourceLockedA1Elbow(THREE, group, fleet, placements)",
  "SOURCE_LOCKED_A1_ELBOW_AUTHORITY",
  "uploadedJetwayA1SourcePoseErrorMeters",
  "uploadedJetwayA1TerminalCornerAngleDegrees",
  "sourceLockedA1CornerAngle >= 20",
  "uploadedJetwayA1TerminalSideIndependentFromTunnelAxis",
  "uploadedJetwayA1PassengerPassageCrossSectionBlocked",
  "sourceLockedA1Elbow,",
]) {
  if (!source.includes(token)) throw new Error(`${readinessPath}: source-locked finalizer is missing ${token}`);
}
if (source.includes("|| a1PortalAlignmentError > 1e-6")) {
  throw new Error(`${readinessPath}: obsolete zero-angle A1 portal gate remains`);
}

fs.writeFileSync(readinessPath, source, "utf8");
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?source-locked-elbow=${Date.now()}`);
console.log("Prepared source-locked A1 readiness: exact BGL parent pose, real Terminal 4 wall, independent terminal-side Rotunda leg, visible elbow, exact child hierarchy, measured ground contact, and no T4_WALK targeting.");
