import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "rendered-a1-tunnel-a-endpoint-cross-section-continuity-v3";
const ROTUNDA_BRIDGE_OVERLAP_METERS = 0.32;
const TUNNEL_A_OVERLAP_METERS = 0.32;
const ENDPOINT_BAND_METERS = 0.18;
const MAXIMUM_CENTERLINE_ERROR_METERS = 0.005;
const MAXIMUM_CROSS_SECTION_ERROR_METERS = 0.02;

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

// The passenger opening must be measured at the Rotunda-facing END of Tunnel A.
// Neither the Rotunda Box3 center (contaminated by its pedestal) nor Tunnel A's
// whole-object center (contaminated by tunnel slope) is a valid seam height.
// Select only vertices in a thin band at Tunnel A's Rotunda-facing end, then
// derive the actual opening min/max Y and width from those exact supplied GLB
// vertices. The generated fixed terminal leg must match that opening exactly.
const tunnelSurfaceNeedle = `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`;
const tunnelSurfaceReplacement = `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n  const tunnelRotundaEndpointVertices = tunnelVertices.filter((vertex) => {\n    const projection = vertex.clone().sub(tunnelCenterAfter).dot(tunnelRotundaDirection);\n    return tunnelRotundaSurfaceMeters - projection <= ${ENDPOINT_BAND_METERS.toFixed(2)};\n  });\n  if (tunnelRotundaEndpointVertices.length < 8) {\n    throw new Error(\`A1 Tunnel A Rotunda-facing endpoint band is too sparse: \${tunnelRotundaEndpointVertices.length}\`);\n  }\n  let tunnelRotundaEndpointMinY = Number.POSITIVE_INFINITY;\n  let tunnelRotundaEndpointMaxY = Number.NEGATIVE_INFINITY;\n  for (const vertex of tunnelRotundaEndpointVertices) {\n    tunnelRotundaEndpointMinY = Math.min(tunnelRotundaEndpointMinY, vertex.y);\n    tunnelRotundaEndpointMaxY = Math.max(tunnelRotundaEndpointMaxY, vertex.y);\n  }\n  const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;\n  const passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterY - rotundaCenter.y;\n  tunnelRotundaSurfacePoint.y = passengerCenterY;\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`;

if (source.includes("const passengerCenterY = tunnelRotundaSurfacePoint.y;")) {
  source = source.replace(
    /  const passengerCenterY = tunnelRotundaSurfacePoint\.y;\n  const passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterY - rotundaCenter\.y;/,
    `  const tunnelRotundaEndpointVertices = tunnelVertices.filter((vertex) => {\n    const projection = vertex.clone().sub(tunnelCenterAfter).dot(tunnelRotundaDirection);\n    return tunnelRotundaSurfaceMeters - projection <= ${ENDPOINT_BAND_METERS.toFixed(2)};\n  });\n  if (tunnelRotundaEndpointVertices.length < 8) {\n    throw new Error(\`A1 Tunnel A Rotunda-facing endpoint band is too sparse: \${tunnelRotundaEndpointVertices.length}\`);\n  }\n  let tunnelRotundaEndpointMinY = Number.POSITIVE_INFINITY;\n  let tunnelRotundaEndpointMaxY = Number.NEGATIVE_INFINITY;\n  for (const vertex of tunnelRotundaEndpointVertices) {\n    tunnelRotundaEndpointMinY = Math.min(tunnelRotundaEndpointMinY, vertex.y);\n    tunnelRotundaEndpointMaxY = Math.max(tunnelRotundaEndpointMaxY, vertex.y);\n  }\n  const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;\n  const passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterY - rotundaCenter.y;\n  tunnelRotundaSurfacePoint.y = passengerCenterY;`,
  );
} else if (!source.includes("const tunnelRotundaEndpointVertices = tunnelVertices.filter")) {
  if (!source.includes(tunnelSurfaceNeedle)) {
    throw new Error(`${sourcePath}: Tunnel-A endpoint cross-section insertion anchor is missing`);
  }
  source = source.replace(tunnelSurfaceNeedle, tunnelSurfaceReplacement);
}

// Cross-section dimensions must come from the same endpoint band, not the full
// sloped Tunnel A. A whole-object Y span can be taller simply because one end of
// the tunnel is higher than the other.
source = source.replace(
  "  const tunnelCrossSectionWidthMeters = projectedSpan(tunnelVertices, tunnelCenterAfter, bridgeSideAxis);",
  "  const tunnelCrossSectionWidthMeters = projectedSpan(tunnelRotundaEndpointVertices, tunnelRotundaSurfacePoint, bridgeSideAxis);",
);
source = source.replace(
  "  const tunnelCrossSectionHeightMeters = projectedSpan(tunnelVertices, tunnelCenterAfter, new THREE.Vector3(0, 1, 0));",
  "  const tunnelCrossSectionHeightMeters = projectedSpan(tunnelRotundaEndpointVertices, tunnelRotundaSurfacePoint, new THREE.Vector3(0, 1, 0));",
);

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

// The short closure at the Rotunda is exterior shell, not an oversized mask.
const bridgeMaterialNeedle = `    materials.bellows,\n    bridgeSealStartLocal,`;
if (source.includes(bridgeMaterialNeedle)) {
  source = source.replace(bridgeMaterialNeedle, `    materials.shell,\n    bridgeSealStartLocal,`);
}

// Match the terminal-side fixed leg to the exact Tunnel-A endpoint dimensions.
// Do not use the old guessed dimensions and do not use the 2%-oversized bellows
// envelope for the fixed passage itself.
source = source.replace(
  /  const width = (?:2\.58|bridgeBellowsWidthMeters);\n  const height = (?:2\.44|bridgeBellowsHeightMeters);/,
  `  const width = tunnelCrossSectionWidthMeters;\n  const height = tunnelCrossSectionHeightMeters;`,
);

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
    `${connectorTelemetryAnchor}\n  connector.userData.passengerCenterlineAuthority = "${authority}";\n  connector.userData.passengerCenterY = passengerCenterY;\n  connector.userData.passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  connector.userData.crossSectionWidthMeters = width;\n  connector.userData.crossSectionHeightMeters = height;\n  connector.userData.tunnelEndpointMinY = tunnelRotundaEndpointMinY;\n  connector.userData.tunnelEndpointMaxY = tunnelRotundaEndpointMaxY;`,
  );
}

const groupTelemetryAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes("uploadedJetwayA1PassengerCenterlineAuthority")) {
  if (!source.includes(groupTelemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 group telemetry anchor is missing`);
  }
  source = source.replace(
    groupTelemetryAnchor,
    `${groupTelemetryAnchor}\n  group.userData.uploadedJetwayA1PassengerCenterlineAuthority = "${authority}";\n  group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1PassengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  group.userData.uploadedJetwayA1TunnelEndpointMinY = tunnelRotundaEndpointMinY;\n  group.userData.uploadedJetwayA1TunnelEndpointMaxY = tunnelRotundaEndpointMaxY;\n  group.userData.uploadedJetwayA1TerminalCenterlineErrorMeters = Math.abs(shellStart.y - passengerCenterY);\n  group.userData.uploadedJetwayA1TerminalCrossSectionWidthMeters = width;\n  group.userData.uploadedJetwayA1TerminalCrossSectionHeightMeters = height;`,
  );
}

const failClosedAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes("A1 fixed terminal endpoint cross-section mismatch")) {
  source = source.replace(
    failClosedAnchor,
    `  const terminalCenterlineErrorMeters = Math.abs(shellStart.y - passengerCenterY);\n  const terminalBottomY = passengerCenterY - height * 0.5;\n  const terminalTopY = passengerCenterY + height * 0.5;\n  const terminalBottomErrorMeters = Math.abs(terminalBottomY - tunnelRotundaEndpointMinY);\n  const terminalTopErrorMeters = Math.abs(terminalTopY - tunnelRotundaEndpointMaxY);\n  if (terminalCenterlineErrorMeters > ${MAXIMUM_CENTERLINE_ERROR_METERS.toFixed(3)}\n    || terminalBottomErrorMeters > ${MAXIMUM_CROSS_SECTION_ERROR_METERS.toFixed(2)}\n    || terminalTopErrorMeters > ${MAXIMUM_CROSS_SECTION_ERROR_METERS.toFixed(2)}) {\n    throw new Error(\`A1 fixed terminal endpoint cross-section mismatch: center=\${terminalCenterlineErrorMeters} bottom=\${terminalBottomErrorMeters} top=\${terminalTopErrorMeters}\`);\n  }\n  group.userData.uploadedJetwayA1TerminalBottomErrorMeters = terminalBottomErrorMeters;\n  group.userData.uploadedJetwayA1TerminalTopErrorMeters = terminalTopErrorMeters;\n${failClosedAnchor}`,
  );
}

for (const forbidden of [
  "UploadedAirportJetwayA1TerminalRotundaOuterShroud",
  "rotundaOuterShroud",
  "rendered-a1-terminal-rotunda-tunnel-a-continuous-exterior-v1",
  "const passengerCenterY = tunnelRotundaSurfacePoint.y;",
  "const width = bridgeBellowsWidthMeters;\n  const height = bridgeBellowsHeightMeters;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: obsolete mismatch-masking/whole-tunnel geometry remains: ${forbidden}`);
  }
}

for (const required of [
  `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  "const tunnelRotundaEndpointVertices = tunnelVertices.filter",
  `tunnelRotundaSurfaceMeters - projection <= ${ENDPOINT_BAND_METERS.toFixed(2)}`,
  "const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;",
  "tunnelRotundaSurfacePoint.y = passengerCenterY;",
  "projectedSpan(tunnelRotundaEndpointVertices, tunnelRotundaSurfacePoint, bridgeSideAxis)",
  "shellStart.y = passengerCenterY;",
  "shellEnd.y = passengerCenterY;",
  "bridgeSealStartFleet.y = passengerCenterY;",
  "bridgeSealEndFleet.y = passengerCenterY;",
  "const width = tunnelCrossSectionWidthMeters;",
  "const height = tunnelCrossSectionHeightMeters;",
  "terminalBellowsCenter.y = passengerCenterY;",
  "materials.shell,\n    bridgeSealStartLocal,",
  `uploadedJetwayA1PassengerCenterlineAuthority = "${authority}"`,
  "A1 fixed terminal endpoint cross-section mismatch",
  "uploadedJetwayA1TerminalBottomErrorMeters",
  "uploadedJetwayA1TerminalTopErrorMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: missing Tunnel-A endpoint continuity requirement ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 endpoint continuity from the actual Rotunda-facing Tunnel-A vertex band: fixed terminal floor/roof/center/width now match the supplied opening under ${authority}.`);
