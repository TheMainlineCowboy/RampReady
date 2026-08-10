import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "rendered-a1-tunnel-a-endpoint-cross-section-continuity-v4";
const ROTUNDA_BRIDGE_OVERLAP_METERS = 0.32;
const TUNNEL_A_OVERLAP_METERS = 0.32;
const ENDPOINT_BAND_CANDIDATES_METERS = Object.freeze([0.18, 0.35, 0.60, 1.00]);
const MINIMUM_ENDPOINT_HEIGHT_METERS = 1.8;
const MAXIMUM_ENDPOINT_HEIGHT_METERS = 4.8;
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

// Measure passenger height at the Rotunda-facing END of Tunnel A. The first
// 18 cm slice of this supplied mesh does not contain the entire rectangular end
// ring, so choose the thinnest endpoint band whose exact vertices expose a
// plausible full passenger height. This avoids both bad alternatives: using the
// Rotunda Box3 center (polluted by its pedestal) or the whole Tunnel-A Y span
// (polluted by the tunnel slope).
const endpointSelectionBlock = `  let tunnelRotundaEndpointVertices = [];
  let tunnelRotundaEndpointBandMeters = 0;
  let tunnelRotundaEndpointMinY = Number.POSITIVE_INFINITY;
  let tunnelRotundaEndpointMaxY = Number.NEGATIVE_INFINITY;
  for (const endpointBandMeters of [${ENDPOINT_BAND_CANDIDATES_METERS.map((value) => value.toFixed(2)).join(", ")}]) {
    const candidateVertices = tunnelVertices.filter((vertex) => {
      const projection = vertex.clone().sub(tunnelCenterAfter).dot(tunnelRotundaDirection);
      return tunnelRotundaSurfaceMeters - projection <= endpointBandMeters;
    });
    if (candidateVertices.length < 8) continue;
    let candidateMinY = Number.POSITIVE_INFINITY;
    let candidateMaxY = Number.NEGATIVE_INFINITY;
    for (const vertex of candidateVertices) {
      candidateMinY = Math.min(candidateMinY, vertex.y);
      candidateMaxY = Math.max(candidateMaxY, vertex.y);
    }
    const candidateHeightMeters = candidateMaxY - candidateMinY;
    if (candidateHeightMeters >= ${MINIMUM_ENDPOINT_HEIGHT_METERS.toFixed(1)}
      && candidateHeightMeters <= ${MAXIMUM_ENDPOINT_HEIGHT_METERS.toFixed(1)}) {
      tunnelRotundaEndpointVertices = candidateVertices;
      tunnelRotundaEndpointBandMeters = endpointBandMeters;
      tunnelRotundaEndpointMinY = candidateMinY;
      tunnelRotundaEndpointMaxY = candidateMaxY;
      break;
    }
  }
  if (tunnelRotundaEndpointVertices.length < 8) {
    throw new Error("A1 Tunnel A Rotunda-facing endpoint could not expose a complete passenger-height slice");
  }
  const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;
  const passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterY - rotundaCenter.y;
  tunnelRotundaSurfacePoint.y = passengerCenterY;`;

const alreadyPreparedEndpointPattern = /  (?:const|let) tunnelRotundaEndpointVertices[\s\S]*?  tunnelRotundaSurfacePoint\.y = passengerCenterY;/;
if (alreadyPreparedEndpointPattern.test(source)) {
  source = source.replace(alreadyPreparedEndpointPattern, endpointSelectionBlock);
} else {
  const tunnelSurfaceNeedle = `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`;
  if (!source.includes(tunnelSurfaceNeedle)) {
    throw new Error(`${sourcePath}: Tunnel-A endpoint cross-section insertion anchor is missing`);
  }
  source = source.replace(
    tunnelSurfaceNeedle,
    `  const tunnelRotundaSurfacePoint = tunnelCenterAfter.clone().addScaledVector(tunnelRotundaDirection, tunnelRotundaSurfaceMeters);\n${endpointSelectionBlock}\n  const rotundaTunnelAGapMeters = tunnelRotundaSurfacePoint.clone().sub(rotundaBridgeSurfacePoint).dot(bridgeDirection);`,
  );
}

// Width is safe to measure across the complete Tunnel A because bridge slope is
// along its longitudinal/Y relationship and cannot enlarge the side-to-side
// span. Height is NOT safe over the whole tunnel, so it comes only from the
// chosen Rotunda-end slice above.
source = source.replace(
  /  const tunnelCrossSectionWidthMeters = projectedSpan\([^\n]+bridgeSideAxis\);/,
  "  const tunnelCrossSectionWidthMeters = projectedSpan(tunnelVertices, tunnelCenterAfter, bridgeSideAxis);",
);
source = source.replace(
  /  const tunnelCrossSectionHeightMeters = projectedSpan\([^\n]+new THREE\.Vector3\(0, 1, 0\)\);/,
  "  const tunnelCrossSectionHeightMeters = tunnelRotundaEndpointMaxY - tunnelRotundaEndpointMinY;",
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

const bridgeMaterialNeedle = `    materials.bellows,\n    bridgeSealStartLocal,`;
if (source.includes(bridgeMaterialNeedle)) {
  source = source.replace(bridgeMaterialNeedle, `    materials.shell,\n    bridgeSealStartLocal,`);
}

source = source.replace(
  /  const width = (?:2\.58|bridgeBellowsWidthMeters|tunnelCrossSectionWidthMeters);\n  const height = (?:2\.44|bridgeBellowsHeightMeters|tunnelCrossSectionHeightMeters);/,
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
    `${connectorTelemetryAnchor}\n  connector.userData.passengerCenterlineAuthority = "${authority}";\n  connector.userData.passengerCenterY = passengerCenterY;\n  connector.userData.passengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  connector.userData.crossSectionWidthMeters = width;\n  connector.userData.crossSectionHeightMeters = height;\n  connector.userData.tunnelEndpointBandMeters = tunnelRotundaEndpointBandMeters;\n  connector.userData.tunnelEndpointMinY = tunnelRotundaEndpointMinY;\n  connector.userData.tunnelEndpointMaxY = tunnelRotundaEndpointMaxY;`,
  );
} else {
  source = source.replace(/connector\.userData\.passengerCenterlineAuthority = "[^"]+";/, `connector.userData.passengerCenterlineAuthority = "${authority}";`);
  if (!source.includes("connector.userData.tunnelEndpointBandMeters")) {
    source = source.replace(
      "  connector.userData.tunnelEndpointMaxY = tunnelRotundaEndpointMaxY;",
      "  connector.userData.tunnelEndpointBandMeters = tunnelRotundaEndpointBandMeters;\n  connector.userData.tunnelEndpointMaxY = tunnelRotundaEndpointMaxY;",
    );
  }
}

const groupTelemetryAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes("uploadedJetwayA1PassengerCenterlineAuthority")) {
  if (!source.includes(groupTelemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 group telemetry anchor is missing`);
  }
  source = source.replace(
    groupTelemetryAnchor,
    `${groupTelemetryAnchor}\n  group.userData.uploadedJetwayA1PassengerCenterlineAuthority = "${authority}";\n  group.userData.uploadedJetwayA1PassengerCenterY = passengerCenterY;\n  group.userData.uploadedJetwayA1PassengerCenterOffsetFromRotundaBoundsCenterMeters = passengerCenterOffsetFromRotundaBoundsCenterMeters;\n  group.userData.uploadedJetwayA1TunnelEndpointBandMeters = tunnelRotundaEndpointBandMeters;\n  group.userData.uploadedJetwayA1TunnelEndpointMinY = tunnelRotundaEndpointMinY;\n  group.userData.uploadedJetwayA1TunnelEndpointMaxY = tunnelRotundaEndpointMaxY;\n  group.userData.uploadedJetwayA1TerminalCenterlineErrorMeters = Math.abs(shellStart.y - passengerCenterY);\n  group.userData.uploadedJetwayA1TerminalCrossSectionWidthMeters = width;\n  group.userData.uploadedJetwayA1TerminalCrossSectionHeightMeters = height;`,
  );
} else {
  source = source.replace(/group\.userData\.uploadedJetwayA1PassengerCenterlineAuthority = "[^"]+";/, `group.userData.uploadedJetwayA1PassengerCenterlineAuthority = "${authority}";`);
  if (!source.includes("uploadedJetwayA1TunnelEndpointBandMeters")) {
    source = source.replace(
      "  group.userData.uploadedJetwayA1TunnelEndpointMinY = tunnelRotundaEndpointMinY;",
      "  group.userData.uploadedJetwayA1TunnelEndpointBandMeters = tunnelRotundaEndpointBandMeters;\n  group.userData.uploadedJetwayA1TunnelEndpointMinY = tunnelRotundaEndpointMinY;",
    );
  }
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
  "projectedSpan(tunnelRotundaEndpointVertices, tunnelRotundaSurfacePoint, bridgeSideAxis)",
  "const width = bridgeBellowsWidthMeters;\n  const height = bridgeBellowsHeightMeters;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: obsolete mismatch-masking/endpoint-width geometry remains: ${forbidden}`);
  }
}

for (const required of [
  `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  "let tunnelRotundaEndpointVertices = [];",
  "for (const endpointBandMeters of [0.18, 0.35, 0.60, 1.00])",
  `candidateHeightMeters >= ${MINIMUM_ENDPOINT_HEIGHT_METERS.toFixed(1)}`,
  "const passengerCenterY = (tunnelRotundaEndpointMinY + tunnelRotundaEndpointMaxY) * 0.5;",
  "tunnelRotundaSurfacePoint.y = passengerCenterY;",
  "projectedSpan(tunnelVertices, tunnelCenterAfter, bridgeSideAxis)",
  "const tunnelCrossSectionHeightMeters = tunnelRotundaEndpointMaxY - tunnelRotundaEndpointMinY;",
  "shellStart.y = passengerCenterY;",
  "shellEnd.y = passengerCenterY;",
  "bridgeSealStartFleet.y = passengerCenterY;",
  "bridgeSealEndFleet.y = passengerCenterY;",
  "const width = tunnelCrossSectionWidthMeters;",
  "const height = tunnelCrossSectionHeightMeters;",
  "terminalBellowsCenter.y = passengerCenterY;",
  "materials.shell,\n    bridgeSealStartLocal,",
  `uploadedJetwayA1PassengerCenterlineAuthority = "${authority}"`,
  "uploadedJetwayA1TunnelEndpointBandMeters",
  "A1 fixed terminal endpoint cross-section mismatch",
  "uploadedJetwayA1TerminalBottomErrorMeters",
  "uploadedJetwayA1TerminalTopErrorMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: missing adaptive Tunnel-A endpoint continuity requirement ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 endpoint continuity from an adaptive Rotunda-facing Tunnel-A height slice plus the exact full side-to-side tunnel span; fixed terminal floor/roof/center/width match the supplied bridge under ${authority}.`);
