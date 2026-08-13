import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-exact-bridge-axis-aligned-to-decoded-kphx-heading-v1";
const authority = "57-static-bgl-bridge-axis-real-wall-registration-v11";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  source = source.replace(
    'const AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";',
    `const AUTHORITY = "${authority}";`,
  );

  const oldBlock = `  const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);\n  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetRegistrationYaw - sourceYaw));\n  // Static gates keep source heading as provenance only because their fixed\n  // Rotundas are facade-registered and their aircraft-side bridge must point at\n  // that same gate's authored target. A1 is excluded from this static path.\n  // The decoded BGL heading owns the rigid supplied-parent yaw.\n  const yaw = sourceYaw;\n\n  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);\n  // Own-gate target error remains diagnostic only. The fixed airport mounting\n  // must stay on its measured wall pivot and retain decoded KPHX yaw.\n  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));\n  const sourceParentYawErrorRadians = Math.abs(wrapYaw(THREE, yaw - sourceYaw));\n  if (sourceParentYawErrorRadians > 1e-9) {\n    throw new Error(\`Static jetway \${placement.gate} escaped its decoded KPHX source yaw: \${sourceParentYawErrorRadians} rad\`);\n  }`;

  const newBlock = `  const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);\n  // ${marker}\n  // The KPHX BGL yaw describes the physical AIR_Jetway01 bridge heading. The\n  // replacement GLB has its own measured local Rotunda->Tunnel-A axis, so the\n  // parent must compensate for that local-axis angle. Never mistake parent +Z\n  // for the visible supplied bridge direction.\n  const sourceAxisRegistrationYaw = wrapYaw(THREE, sourceYaw - sourceBridgeAxisHeading);\n  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetRegistrationYaw - sourceAxisRegistrationYaw));\n  const yaw = sourceAxisRegistrationYaw;\n\n  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);\n  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));\n  const sourceBridgeHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - sourceYaw));\n  const sourceParentYawAdjustmentRadians = Math.abs(wrapYaw(THREE, yaw - sourceYaw));\n  // Compatibility telemetry continues to publish a zero source error, but it\n  // now measures the visible bridge axis instead of the irrelevant parent yaw.\n  const sourceParentYawErrorRadians = sourceBridgeHeadingErrorRadians;\n  if (sourceBridgeHeadingErrorRadians > 1e-9) {\n    throw new Error(\`Static jetway \${placement.gate} visible bridge axis escaped decoded KPHX heading: \${sourceBridgeHeadingErrorRadians} rad\`);\n  }`;

  if (!source.includes(oldBlock)) {
    throw new Error(`${runtimePath}: stale parent-yaw static registration block is missing`);
  }
  source = source.replace(oldBlock, newBlock);

  source = source.replace(
    `    staticSourceParentYawErrorRadians: sourceParentYawErrorRadians,\n    staticTerminalFacingDot: terminalFacingDot,`,
    `    staticSourceParentYawErrorRadians: sourceParentYawErrorRadians,\n    staticSourceBridgeHeadingErrorRadians: sourceBridgeHeadingErrorRadians,\n    staticSourceParentYawAdjustmentRadians: sourceParentYawAdjustmentRadians,\n    staticTerminalFacingDot: terminalFacingDot,`,
  );

  source = source.replace(
    'group.userData.uploadedJetwayStaticSourcePoseAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";',
    `group.userData.uploadedJetwayStaticSourcePoseAuthority = "${authority}";`,
  );

  const maxParentAnchor = `  const maximumSourceParentYawError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceParentYawErrorRadians));`;
  const maxParentBlock = `${maxParentAnchor}\n  const maximumSourceBridgeHeadingError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceBridgeHeadingErrorRadians));\n  const maximumSourceParentYawAdjustment = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceParentYawAdjustmentRadians));`;
  if (!source.includes(maxParentAnchor)) {
    throw new Error(`${runtimePath}: static source-error aggregate anchor is missing`);
  }
  source = source.replace(maxParentAnchor, maxParentBlock);

  source = source.replace(
    `  group.userData.uploadedJetwayStaticMaximumSourceParentYawErrorRadians = maximumSourceParentYawError;`,
    `  group.userData.uploadedJetwayStaticMaximumSourceParentYawErrorRadians = maximumSourceParentYawError;\n  group.userData.uploadedJetwayStaticMaximumSourceBridgeHeadingErrorRadians = maximumSourceBridgeHeadingError;\n  group.userData.uploadedJetwayStaticMaximumSourceParentYawAdjustmentRadians = maximumSourceParentYawAdjustment;`,
  );
}

for (const required of [
  marker,
  authority,
  "const sourceAxisRegistrationYaw = wrapYaw(THREE, sourceYaw - sourceBridgeAxisHeading);",
  "const yaw = sourceAxisRegistrationYaw;",
  "visible bridge axis escaped decoded KPHX heading",
  "staticSourceBridgeHeadingErrorRadians",
  "uploadedJetwayStaticMaximumSourceBridgeHeadingErrorRadians",
  "uploadedJetwayStaticMaximumSourceParentYawAdjustmentRadians",
]) {
  if (!source.includes(required)) {
    throw new Error(`${runtimePath}: static exact-axis source-heading contract is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = sourceYaw;",
  "escaped its decoded KPHX source yaw",
  'const AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${runtimePath}: stale static parent-yaw ownership survived: ${forbidden}`);
  }
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Aligned every static exact supplied Rotunda-to-Tunnel-A physical axis to its decoded KPHX BGL jetway heading while preserving measured wall Rotundas and all supplied child transforms.");
