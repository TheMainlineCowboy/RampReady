import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const authority = "57-static-own-gate-target-real-wall-source-heading-provenance-v11";
let source = fs.readFileSync(registrationPath, "utf8");

// The Aug. 15 KPHX reference and fresh exact-head fleet evidence reject using
// decoded BGL heading as the final rendered rigid-parent yaw. The replacement
// GLB is Rotunda-normalized, so the raw source heading is provenance only; when
// reapplied after real-wall registration it visibly crosses neighbouring stands.
// Keep the measured real-wall Rotunda position and the already-computed
// targetRegistrationYaw that points each movable bridge toward its OWN authored
// gate target. Preserve sourceYaw only as telemetry/provenance.
source = source.replaceAll(
  "57-static-bgl-source-pose-real-wall-registration-v10",
  authority,
);
source = source.replaceAll(
  "57-static-own-gate-target-real-wall-compact-registration-v9",
  authority,
);

if (source.includes("  // The decoded BGL heading owns the rigid supplied-parent yaw.\n  const yaw = sourceYaw;")) {
  source = source.replace(
    "  // The decoded BGL heading owns the rigid supplied-parent yaw.\n  const yaw = sourceYaw;",
    `  // Source yaw is provenance only. Final rigid-parent yaw must aim the\n  // supplied bridge from its measured real-wall Rotunda toward its own stand.\n  const yaw = targetRegistrationYaw;`,
  );
} else if (source.includes("  const yaw = sourceYaw;")) {
  source = source.replace("  const yaw = sourceYaw;", "  const yaw = targetRegistrationYaw;");
}
if (!source.includes("const yaw = targetRegistrationYaw;")) {
  throw new Error(`${registrationPath}: own-gate target yaw is missing after source-provenance normalization`);
}

const sourceValidation = `  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);
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
const targetValidation = `  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);
  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));
  if (ownGateHeadingErrorRadians > 0.002) {
    throw new Error(\`Static jetway \${placement.gate} is not aimed at its own gate target: \${ownGateHeadingErrorRadians} rad\`);
  }
  const sourceParentYawErrorRadians = Math.abs(wrapYaw(THREE, yaw - sourceYaw));
  const bridgeUnitX = Math.sin(resolvedBridgeHeading);
  const bridgeUnitZ = Math.cos(resolvedBridgeHeading);
  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;
  if (terminalFacingDot > 0.25) {
    throw new Error(\`Static jetway \${placement.gate} points back toward the terminal instead of its own stand: dot=\${terminalFacingDot}\`);
  }`;
if (source.includes(sourceValidation)) source = source.replace(sourceValidation, targetValidation);
else if (!source.includes("if (ownGateHeadingErrorRadians > 0.002)")) {
  throw new Error(`${registrationPath}: final own-gate heading validation is missing`);
}

source = source.replaceAll(
  'group.userData.uploadedJetwayStaticSourcePoseAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";',
  `group.userData.uploadedJetwayStaticSourcePoseAuthority = "${authority}";`,
);
source = source.replaceAll(
  'group.userData.uploadedJetwayStaticOwnGateTargetAuthority = "57-static-own-gate-target-real-wall-compact-registration-v9";',
  `group.userData.uploadedJetwayStaticOwnGateTargetAuthority = "${authority}";`,
);

for (const required of [
  authority,
  "const visibleTerminalLegMeters = 0.55;",
  "const terminalWallOverlapMeters = 0.18;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = targetRegistrationYaw;",
  "ownGateHeadingErrorRadians",
]) {
  if (!source.includes(required)) {
    throw new Error(`${registrationPath}: own-gate/source-provenance static contract is missing ${required}`);
  }
}
if (source.includes("const yaw = sourceYaw;")) {
  throw new Error(`${registrationPath}: decoded BGL source yaw still owns rendered static bridge direction`);
}

// Source yaw is deliberately provenance-only in this final contract. A numeric
// parent-yaw difference from source is therefore expected and must not be used
// as a fail-closed invariant. The own-gate heading error plus terminal-facing
// dot are the physical rendered-direction invariants; existing yaw-change
// telemetry retains the source-versus-rendered diagnostic value.
fs.writeFileSync(registrationPath, source, "utf8");
console.log("Preserved decoded KPHX static headings as provenance only; all 57 exact static jetways remain on measured real-wall Rotundas and render toward their own authored stand targets instead of crossing neighbouring gates.");
