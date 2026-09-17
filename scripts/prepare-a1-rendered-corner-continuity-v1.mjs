import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "rendered-a1-tunnel-a-endpoint-cross-section-continuity-v4";
const DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
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
const doglegShellNeedle = `  const secondShellEnd = rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, ROTUNDA_SHELL_OVERLAP_METERS);`;
const doglegShellReplacement = `${doglegShellNeedle}\n  // ${authority}: repeated production preparation must preserve the already-photo-authored\n  // two-leg corridor while re-binding both legs to the measured Tunnel-A passenger center.\n  firstShellStart.y = passengerCenterY;\n  firstShellEnd.y = passengerCenterY;\n  secondShellStart.y = passengerCenterY;\n  secondShellEnd.y = passengerCenterY;`;
if (!source.includes("shellStart.y = passengerCenterY;")
  && !source.includes("firstShellStart.y = passengerCenterY;")) {
  if (source.includes(shellNeedle)) {
    source = source.replace(shellNeedle, shellReplacement);
  } else if (source.includes(DOGLEG_AUTHORITY) && source.includes(doglegShellNeedle)) {
    source = source.replace(doglegShellNeedle, doglegShellReplacement);
  } else {
    throw new Error(`${sourcePath}: neither straight nor photo-dogleg fixed terminal shell centerline anchor is available`);
  }
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
if (!source.includes("terminalBellowsCenter.y = passengerCenterY;") && !source.includes(DOGLEG_AUTHORITY)) {
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
      /  connector\.userData\.crossSectionHeightMeters = [^;]+;/,
      (match) => `${match}\n  connector.userData.tunnelEndpointBandMeters = tunnelRotundaEndpointBandMeters;\n  connector.userData.tunnelEndpointMinY = tunnelRotundaEndpointMinY;\n  connector.userData.tunnelEndpointMaxY = tunnelRotundaEndpointMaxY;`,
    );
  }
}

for (const required of [
  authority,
  "const passengerCenterY =",
  "tunnelRotundaSurfacePoint.y = passengerCenterY;",
  "bridgeSealStartFleet.y = passengerCenterY;",
  "bridgeSealEndFleet.y = passengerCenterY;",
  "const tunnelCrossSectionHeightMeters = tunnelRotundaEndpointMaxY - tunnelRotundaEndpointMinY;",
  "connector.userData.passengerCenterlineAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: rendered endpoint continuity is missing ${required}`);
}
if (!(source.includes("shellStart.y = passengerCenterY;") || source.includes("firstShellStart.y = passengerCenterY;"))) {
  throw new Error(`${sourcePath}: no final fixed-corridor passenger centerline binding survived`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 endpoint continuity from an adaptive Rotunda-facing Tunnel-A height slice plus the exact full side-to-side tunnel span; both straight first-pass and already-photo-authored dogleg shells bind idempotently to the same passenger center under ${authority}.`);
