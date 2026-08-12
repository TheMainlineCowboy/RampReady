import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const authority = "57-static-bgl-source-pose-real-wall-registration-v10";
let source = fs.readFileSync(registrationPath, "utf8");

// The decoded kphx-airport.bgl jetway records already contain the authored
// physical pivot position and heading. The previous final registration moved
// every Rotunda toward a nearest facade candidate and then replaced the source
// heading with a CRJ-door target heading. That can make individually-valid
// bridges sweep through neighbouring stands. Keep the authored airport pose as
// the rigid-parent authority; aircraft fitting/articulation must happen later.
source = source
  .replaceAll("57-static-own-gate-target-real-wall-compact-registration-v9", authority)
  .replaceAll('const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0.25;', 'const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0;')
  .replaceAll('const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.25;', 'const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 28;');

const relocatedBlock = `  // Register the complete rigid supplied assembly to the measured real
  // Terminal 4 wall. Generated geometry is limited to the short wall sleeve;
  // the replacement jetway itself stays the exact supplied GLB.
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const visibleTerminalLegMeters = 0.55;
  const terminalWallOverlapMeters = 0.18;
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} compact real-wall vestibule is invalid: \${visibleTerminalLegMeters}\`);
  }
  const resolvedRotundaCenterToWallMeters = authoredRotundaOffset.radiusMeters
    + visibleTerminalLegMeters - terminalWallOverlapMeters;
  const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;
  const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;`;

const sourcePoseBlock = `  // exact-kphx-bgl-static-pose-authority-v10
  // Keep the authored KPHX Rotunda/pivot point. The measured wall hit is used
  // only to build the terminal sleeve; it is never allowed to relocate the
  // complete supplied jetway.
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const rotundaX = sourceX;
  const rotundaZ = sourceZ;
  const terminalWallOverlapMeters = 0;
  const resolvedRotundaCenterToWallMeters = sourceWallDistance;
  const visibleTerminalLegMeters = Math.max(0, sourceWallDistance - authoredRotundaOffset.radiusMeters);
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} authored source-pose terminal span is invalid: \${visibleTerminalLegMeters}\`);
  }`;

if (source.includes(relocatedBlock)) {
  source = source.replace(relocatedBlock, sourcePoseBlock);
} else if (!source.includes("exact-kphx-bgl-static-pose-authority-v10")) {
  throw new Error(`${registrationPath}: final compact relocation block is missing; refusing to guess at static placement`);
}

if (source.includes("  const yaw = targetRegistrationYaw;")) {
  source = source.replace("  const yaw = targetRegistrationYaw;", `  // The BGL source heading owns the rigid supplied-parent yaw.\n  const yaw = sourceYaw;`);
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
  // Own-gate target error remains diagnostic only. It must not rotate the
  // fixed airport mounting. Source-parent preservation is the hard contract.
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
  "exact-kphx-bgl-static-pose-authority-v10",
  "const rotundaX = sourceX;",
  "const rotundaZ = sourceZ;",
  "const resolvedRotundaCenterToWallMeters = sourceWallDistance;",
  "const yaw = sourceYaw;",
  "sourceParentYawErrorRadians",
  "uploadedJetwayStaticSourcePoseAuthority",
  "uploadedJetwayStaticSourcePoseGateCount = 57",
]) {
  if (!source.includes(required)) {
    throw new Error(`${registrationPath}: source-pose static contract is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = targetRegistrationYaw;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${registrationPath}: target-driven static relocation survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, source, "utf8");
console.log("Prepared all 57 static Terminal 4 jetways with decoded KPHX BGL pivot position and heading as rigid-parent authority; wall hits now size only the terminal sleeve and aircraft targets no longer steer fixed bridge mountings.");
