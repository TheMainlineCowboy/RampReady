import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const authority = "57-static-bgl-source-pose-real-wall-registration-v10";
let source = fs.readFileSync(registrationPath, "utf8");

// The decoded KPHX BGL heading is valid airport-placement provenance, but the
// decoded x/z is the stock-model origin rather than the replacement GLB's
// Rotunda center. Keep the existing measured real-wall Rotunda registration so
// every bridge stays attached to Terminal 4, and restore only the BGL heading
// as rigid-parent yaw. Aircraft targets may control later articulation/length;
// they must not swivel the entire fixed bridge through neighbouring stands.
source = source.replaceAll(
  "57-static-own-gate-target-real-wall-compact-registration-v9",
  authority,
);

if (source.includes("  const yaw = targetRegistrationYaw;")) {
  source = source.replace(
    "  const yaw = targetRegistrationYaw;",
    `  // The decoded BGL heading owns the rigid supplied-parent yaw.\n  const yaw = sourceYaw;`,
  );
}
if (!source.includes("const yaw = sourceYaw;")) {
  throw new Error(`${registrationPath}: could not restore decoded source yaw as rigid-parent authority`);
}

const oldHeadingValidation = `  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);
  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));
  if (ownGateHeadingErrorRadians > 0.002) {
    throw new Error(\`Static jetway \${placement.gate} is not aimed at its own gate target: \${ownGateHeadingErrorRadians} rad\`);
  }
  const bridgeUnitX = bridgeDx / bridgeDistance;
  const bridgeUnitZ = bridgeDz / bridgeDistance;
  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;
  if (terminalFacingDot > 0.25) {
    throw new Error(\`Static jetway \${placement.gate} points back toward the terminal instead of its own stand: dot=\${terminalFacingDot}\`);
  }`;

const sourceHeadingValidation = `  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);
  // Own-gate target error remains diagnostic only. The fixed airport mounting
  // must stay on its measured wall pivot and retain decoded KPHX yaw.
  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));
  const sourceParentYawErrorRadians = Math.abs(wrapYaw(THREE, yaw - sourceYaw));
  if (sourceParentYawErrorRadians > 1e-9) {
    throw new Error(\`Static jetway \${placement.gate} escaped its decoded KPHX source yaw: \${sourceParentYawErrorRadians} rad\`);
  }
  const bridgeUnitX = Math.sin(resolvedBridgeHeading);
  const bridgeUnitZ = Math.cos(resolvedBridgeHeading);
  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;`;

if (source.includes(oldHeadingValidation)) {
  source = source.replace(oldHeadingValidation, sourceHeadingValidation);
} else if (!source.includes("sourceParentYawErrorRadians")) {
  throw new Error(`${registrationPath}: own-gate heading validation block is missing`);
}

const returnAnchor = `    staticOwnGateHeadingErrorRadians: ownGateHeadingErrorRadians,
    staticTerminalFacingDot: terminalFacingDot,`;
const returnPatch = `    staticOwnGateHeadingErrorRadians: ownGateHeadingErrorRadians,
    staticSourceParentYawErrorRadians: sourceParentYawErrorRadians,
    staticTerminalFacingDot: terminalFacingDot,`;
if (source.includes(returnAnchor) && !source.includes("staticSourceParentYawErrorRadians:")) {
  source = source.replace(returnAnchor, returnPatch);
}

const aggregateAnchor = `  const maximumOwnGateHeadingError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticOwnGateHeadingErrorRadians));
  const maximumTerminalFacingDot = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticTerminalFacingDot));`;
const aggregatePatch = `  const maximumOwnGateHeadingError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticOwnGateHeadingErrorRadians));
  const maximumSourceParentYawError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceParentYawErrorRadians));
  const maximumTerminalFacingDot = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticTerminalFacingDot));`;
if (source.includes(aggregateAnchor) && !source.includes("maximumSourceParentYawError")) {
  source = source.replace(aggregateAnchor, aggregatePatch);
}

const telemetryAnchor = `  group.userData.uploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = maximumOwnGateHeadingError;
  group.userData.uploadedJetwayStaticMaximumTerminalFacingDot = maximumTerminalFacingDot;`;
const telemetryPatch = `  group.userData.uploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = maximumOwnGateHeadingError;
  group.userData.uploadedJetwayStaticSourcePoseAuthority = "${authority}";
  group.userData.uploadedJetwayStaticSourcePoseGateCount = 57;
  group.userData.uploadedJetwayStaticMaximumSourceParentYawErrorRadians = maximumSourceParentYawError;
  group.userData.uploadedJetwayStaticMaximumTerminalFacingDot = maximumTerminalFacingDot;`;
if (source.includes(telemetryAnchor) && !source.includes("uploadedJetwayStaticSourcePoseAuthority")) {
  source = source.replace(telemetryAnchor, telemetryPatch);
}

for (const required of [
  authority,
  "const visibleTerminalLegMeters = 0.55;",
  "const terminalWallOverlapMeters = 0.18;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = sourceYaw;",
  "sourceParentYawErrorRadians",
  "uploadedJetwayStaticSourcePoseAuthority",
  "uploadedJetwayStaticSourcePoseGateCount = 57",
]) {
  if (!source.includes(required)) {
    throw new Error(`${registrationPath}: real-wall/source-heading static contract is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = targetRegistrationYaw;",
  "const rotundaX = sourceX;",
  "const rotundaZ = sourceZ;",
  "authored source-pose terminal span is invalid",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${registrationPath}: raw-origin/target-driven static placement survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, source, "utf8");
console.log("Prepared all 57 static Terminal 4 jetways with measured real-wall Rotunda registration preserved and decoded KPHX BGL heading as rigid-parent yaw; aircraft targets no longer swivel fixed bridges across neighbouring stands.");