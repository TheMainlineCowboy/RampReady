import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "rendered-a1-passenger-centerline-continuity-v2";
const ROTUNDA_BRIDGE_OVERLAP_METERS = 0.32;
const TUNNEL_A_OVERLAP_METERS = 0.32;
const MAXIMUM_CENTERLINE_ERROR_METERS = 0.01;

let source = fs.readFileSync(sourcePath, "utf8");

source = source
  .replace(
    /const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  )
  .replace(
    /const TUNNEL_A_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  );

// The supplied Rotunda object includes the stationary support/pedestal below
// the passenger tube. Its whole-object Box3 center is therefore NOT a valid
// passenger centerline. The live phone defect showed the generated terminal
// leg centered on that contaminated Y while Tunnel A remained at the real
// passenger level, leaving two white sections stacked vertically. Derive the
// generated fixed leg from the measured Tunnel-A Rotunda-facing cross-section
// instead. The exact supplied GLB hierarchy is not translated, stretched or
// replaced here.
const tunnelSurfaceNeedle = `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`;
const tunnelSurfaceReplacement = `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n  const passengerCenterY = tunnelRotundaSurfacePoint.y;\n  const passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterY - rotundaCenter.y;\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`;
if (!source.includes("const passengerCenterY = tunnelRotundaSurfacePoint.y;")) {
  if (!source.includes(tunnelSurfaceNeedle)) {
    throw new Error(`${sourcePath}: Tunnel-A passenger centerline insertion anchor is missing`);
  }
  source = source.replace(tunnelSurfaceNeedle, tunnelSurfaceReplacement);
}

const shellNeedle = `  const shellStart = fixedWallPoint.clone().addScaledVector(terminalDirection, TERMINAL_HIDDEN_OVERLAP_METERS);\n  const shellEnd = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, ROTUNDA_SHELL_OVERLAP_METERS);`;
const shellReplacement = `  const shellStart = fixedWallPoint.clone().addScaledVector(terminalDirection, TERMINAL_HIDDEN_OVERLAP_METERS);\n  const shellEnd = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, ROTUNDA_SHELL_OVERLAP_METERS);\n  shellStart.y = passengerCenterY;\n  shellEnd.y = passengerCenterY;`;
if (!source.includes("shellStart.y = passengerCenterY;")) {
  if (!source.includes(shellNeedle)) {
    throw new Error(`${sourcePath}: fixed terminal shell centerline anchor is missing`);
  }
  source = source.replace(shellNeedle, shellReplacement);
}

const bridgeSealNeedle = `  const bridgeSealStartFleet = rotundaBridgeSurfacePoint.clone().addScaledVector(bridgeDirection, -ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS);\n  const bridgeSealEndFleet = tunnelRotundaSurfacePoint.clone().addScaledVector(bridgeDirection, TUNNEL_A_HIDDEN_OVERLAP_METERS);`;
const bridgeSealReplacement = `  const bridgeSealStartFleet = rotundaBridgeSurfacePoint.clone().addScaledVector(bridgeDirection, -ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS);\n  const bridgeSealEndFleet = tunnelRotundaSurfacePoint.clone().addScaledVector(bridgeDirection, TUNNEL_A_HIDDEN_OVERLAP_METERS);\n  bridgeSealStartFleet.y = passengerCenterY;\n  bridgeSealEndFleet.y = passengerCenterY;`;
if (!source.includes("bridgeSealStartFleet.y = passengerCenterY;")) {
  if (!source.includes(bridgeSealNeedle)) {
    throw new Error(`${sourcePath}: Rotunda/Tunnel-A sleeve centerline anchor is missing`);
  }
  source = source.replace(bridgeSealNeedle, bridgeSealReplacement);
}

// Keep the visible short Rotunda->Tunnel-A closure in the same white shell
// finish as the supplied jetway exterior. Unlike v1, do not add a cylindrical
// shroud over the mismatch; there must be only one passenger-level envelope.
const bridgeMaterialNeedle = `    materials.bellows,\n    bridgeSealStartLocal,`;
if (source.includes(bridgeMaterialNeedle)) {
  source = source.replace(
    bridgeMaterialNeedle,
    `    materials.shell,\n    bridgeSealStartLocal,`,
  );
}

const crossSectionNeedle = `  const width = 2.58;\n  const height = 2.44;`;
const crossSectionReplacement = `  const width = bridgeBellowsWidthMeters;\n  const height = bridgeBellowsHeightMeters;`;
if (source.includes(crossSectionNeedle)) {
  source = source.replace(crossSectionNeedle, crossSectionReplacement);
}

const compactBellowsNeedle = `  addCompactRotundaBellows(THREE, connector, materials, rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, 0.03), terminalToRotunda, width, height);`;
const compactBellowsReplacement = `  const terminalBellowsCenter = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, 0.03);\n  terminalBellowsCenter.y = passengerCenterY;\n  addCompactRotundaBellows(THREE, connector, materials, terminalBellowsCenter, terminalToRotunda, width, height);`;
if (!source.includes("terminalBellowsCenter.y = passengerCenterY;")) {
  if (!source.includes(compactBellowsNeedle)) {
    throw new Error(`${sourcePath}: terminal Rotunda bellows centerline anchor is missing`);
  }
  source = source.replace(compactBellowsNeedle, compactBellowsReplacement);
}

const connectorTelemetryAnchor = "  connector.userData.apronFacingOpenAreaMeters = 0;";
if (!source.includes("connector.userData.passengerCenterlineAuthority")) {
  if (!source.includes(connectorTelemetryAnchor)) {
    throw new Error(`${sourcePath}: fixed connector telemetry anchor is missing`);
  }
  source = source.replace(
    connectorTelemetryAnchor,
    `${connectorTelemetryAnchor}\n  connector.userData.passengerCenterlineAuthority = "${authority}";\n  connector.userData.passengerCenterY = passengerCenterY;\n  connector.userData.passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  connector.userData.crossSectionWidthMeters = width;\n  connector.userData.crossSectionHeightMeters = height;`,
  );
}

const groupTelemetryAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes("uploadedJetwayA1PassengerCenterlineAuthority")) {
  if (!source.includes(groupTelemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 group telemetry anchor is missing`);
  }
  source = source.replace(
    groupTelemetryAnchor,
    `${groupTelemetryAnchor}\n  group.userData.uploadedJetwayA1PassengerCenterlineAuthority = "${authority}";\n  group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1PassengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  group.userData.uploadedJetwayA1TerminalCenterlineErrorMeters = Math.abs(shellStart.y - tunnelRotundaSurfacePoint.y);\n  group.userData.uploadedJetwayA1TerminalCrossSectionWidthMeters = width;\n  group.userData.uploadedJetwayA1TerminalCrossSectionHeightMeters = height;`,
  );
}

const failClosedAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes("A1 fixed terminal passenger centerline mismatch")) {
  source = source.replace(
    failClosedAnchor,
    `  const terminalCenterlineErrorMeters = Math.abs(shellStart.y - tunnelRotundaSurfacePoint.y);\n  if (terminalCenterlineErrorMeters > ${MAXIMUM_CENTERLINE_ERROR_METERS.toFixed(2)}) {\n    throw new Error(\`A1 fixed terminal passenger centerline mismatch: \${terminalCenterlineErrorMeters}\`);\n  }\n${failClosedAnchor}`,
  );
}

for (const forbidden of [
  "UploadedAirportJetwayA1TerminalRotundaOuterShroud",
  "rotundaOuterShroud",
  "rendered-a1-terminal-rotunda-tunnel-a-continuous-exterior-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: obsolete mismatch-masking geometry remains: ${forbidden}`);
  }
}

for (const required of [
  `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  "const passengerCenterY = tunnelRotundaSurfacePoint.y;",
  "shellStart.y = passengerCenterY;",
  "shellEnd.y = passengerCenterY;",
  "bridgeSealStartFleet.y = passengerCenterY;",
  "bridgeSealEndFleet.y = passengerCenterY;",
  "const width = bridgeBellowsWidthMeters;",
  "const height = bridgeBellowsHeightMeters;",
  "terminalBellowsCenter.y = passengerCenterY;",
  "materials.shell,\n    bridgeSealStartLocal,",
  `uploadedJetwayA1PassengerCenterlineAuthority = "${authority}"`,
  "A1 fixed terminal passenger centerline mismatch",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: missing passenger-centerline continuity requirement ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 passenger-level continuity: the fixed terminal leg, compact Rotunda seam and Tunnel-A sleeve now share the measured Tunnel-A centerline/cross-section; the v1 outer shroud is forbidden under ${authority}.`);
