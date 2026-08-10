import fs from "node:fs";

const connectorPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const AUTHORITY = "a1-current-transformed-rotunda-terminal-leg-v1";
const PASSENGER_AUTHORITY = "a1-tunnel-a-rotunda-end-passenger-envelope-v1";
const MAX_VISIBLE_LEG_METERS = 6.0;
const MAX_WALL_DISTANCE_METERS = 5.8;
const MIN_WALL_DISTANCE_METERS = 2.9;

let source = fs.readFileSync(connectorPath, "utf8");

// The connector must originate at the CURRENT transformed Rotunda. placement.x/z
// are decoded source-placement coordinates and become stale after the final A1
// anchor relocation. Using those stale values generated an 18+ metre second
// tunnel on top of the supplied jetway.
const staleTerminalPoint = `  const terminalPoint = new THREE.Vector3(\n    placement.x + terminalDirection.x * terminalDistance,\n    rotundaOpening.centerY,\n    placement.z + terminalDirection.z * terminalDistance,\n  );`;
const currentTerminalPoint = `  const terminalPoint = new THREE.Vector3(\n    rotundaOpening.centerX + terminalDirection.x * terminalDistance,\n    rotundaOpening.centerY,\n    rotundaOpening.centerZ + terminalDirection.z * terminalDistance,\n  );`;
if (source.includes(staleTerminalPoint)) {
  source = source.replace(staleTerminalPoint, currentTerminalPoint);
} else if (!source.includes(currentTerminalPoint)) {
  throw new Error(`${connectorPath}: A1 terminal-point origin anchor is missing`);
}

// Derive the passenger vertical center and cross-section from the Rotunda-facing
// end of supplied Tunnel A. The Rotunda mesh includes the pedestal/support below
// the passenger tube, so its whole-mesh Y centroid is not the tunnel centerline.
const bridgeNormalizeAnchor = `  bridgeDirection.normalize();\n\n  // The terminal opening is the authored side of the Rotunda opposite Tunnel A.`;
const passengerEnvelopeBlock = `  bridgeDirection.normalize();\n\n  const tunnelRotundaDirection = bridgeDirection.clone().multiplyScalar(-1);\n  let tunnelRotundaSurfaceProjection = Number.NEGATIVE_INFINITY;\n  for (const vertex of tunnelVertices) {\n    tunnelRotundaSurfaceProjection = Math.max(\n      tunnelRotundaSurfaceProjection,\n      vertex.clone().sub(tunnelCenter).dot(tunnelRotundaDirection),\n    );\n  }\n  const tunnelEndpointVertices = tunnelVertices.filter((vertex) => {\n    const projection = vertex.clone().sub(tunnelCenter).dot(tunnelRotundaDirection);\n    return tunnelRotundaSurfaceProjection - projection <= 0.60;\n  });\n  if (tunnelEndpointVertices.length < 8) {\n    throw new Error("A1 supplied Tunnel A Rotunda endpoint has too few vertices for passenger-envelope measurement");\n  }\n  let tunnelEndpointMinY = Number.POSITIVE_INFINITY;\n  let tunnelEndpointMaxY = Number.NEGATIVE_INFINITY;\n  const tunnelSideAxis = new THREE.Vector3(bridgeDirection.z, 0, -bridgeDirection.x).normalize();\n  let tunnelEndpointMinSide = Number.POSITIVE_INFINITY;\n  let tunnelEndpointMaxSide = Number.NEGATIVE_INFINITY;\n  for (const vertex of tunnelEndpointVertices) {\n    tunnelEndpointMinY = Math.min(tunnelEndpointMinY, vertex.y);\n    tunnelEndpointMaxY = Math.max(tunnelEndpointMaxY, vertex.y);\n    const sideProjection = vertex.clone().sub(tunnelCenter).dot(tunnelSideAxis);\n    tunnelEndpointMinSide = Math.min(tunnelEndpointMinSide, sideProjection);\n    tunnelEndpointMaxSide = Math.max(tunnelEndpointMaxSide, sideProjection);\n  }\n  const passengerCenterY = (tunnelEndpointMinY + tunnelEndpointMaxY) * 0.5;\n  const passengerHeightMeters = tunnelEndpointMaxY - tunnelEndpointMinY;\n  const passengerWidthMeters = tunnelEndpointMaxSide - tunnelEndpointMinSide;\n  if (!(passengerHeightMeters > 1.8 && passengerHeightMeters < 4.8)) {\n    throw new Error(\`A1 supplied Tunnel A passenger height is invalid: \${passengerHeightMeters}\`);\n  }\n  if (!(passengerWidthMeters > 1.8 && passengerWidthMeters < 5.5)) {\n    throw new Error(\`A1 supplied Tunnel A passenger width is invalid: \${passengerWidthMeters}\`);\n  }\n\n  // The terminal opening is the authored side of the Rotunda opposite Tunnel A.`;
if (!source.includes("const passengerCenterY = (tunnelEndpointMinY + tunnelEndpointMaxY) * 0.5;")) {
  if (!source.includes(bridgeNormalizeAnchor)) {
    throw new Error(`${connectorPath}: Tunnel A passenger-envelope insertion anchor is missing`);
  }
  source = source.replace(bridgeNormalizeAnchor, passengerEnvelopeBlock);
}

source = source.replace(
  "    centerY: rotundaCenter.y,",
  "    centerY: passengerCenterY,\n    passengerEnvelopeAuthority: \"" + PASSENGER_AUTHORITY + "\",\n    passengerWidthMeters,\n    passengerHeightMeters,",
);

source = source.replace(
  /  const width = (?:3\.08|[A-Za-z0-9_.]+);\n  const height = (?:2\.68|[A-Za-z0-9_.]+);/,
  "  const width = rotundaOpening.passengerWidthMeters;\n  const height = rotundaOpening.passengerHeightMeters;",
);

// Do not rewrite the historical source-guard text here. The dedicated browser
// workflow intentionally runs verify and then build in the same checkout, and
// older preparers still use those exact guards as regeneration anchors. Physical
// rejection of the old 18+ metre duplicate leg belongs in final readiness below.
for (const required of [
  currentTerminalPoint,
  `passengerEnvelopeAuthority: "${PASSENGER_AUTHORITY}"`,
  "const passengerCenterY = (tunnelEndpointMinY + tunnelEndpointMaxY) * 0.5;",
  "const width = rotundaOpening.passengerWidthMeters;",
  "const height = rotundaOpening.passengerHeightMeters;",
]) {
  if (!source.includes(required)) {
    throw new Error(`${connectorPath}: current-Rotunda A1 connector requirement is missing: ${required}`);
  }
}
if (source.includes(staleTerminalPoint)) {
  throw new Error(`${connectorPath}: stale placement-based A1 terminal origin remains`);
}
fs.writeFileSync(connectorPath, source, "utf8");

// Final readiness must fail closed on the same physical limits. Earlier legacy
// compatibility scripts deliberately broadened both values to 44 m, which is
// exactly how the bad duplicate tunnel reached a green workflow.
let readiness = fs.readFileSync(readinessPath, "utf8");
readiness = readiness
  .replace(/a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
    `a1TerminalWallDistance > ${MIN_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE_METERS}`)
  .replace(/connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
    `connectorVisibleLength > 0.25 && connectorVisibleLength < ${MAX_VISIBLE_LEG_METERS}`);
for (const required of [
  `a1TerminalWallDistance > ${MIN_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_WALL_DISTANCE_METERS}`,
  `connectorVisibleLength > 0.25 && connectorVisibleLength < ${MAX_VISIBLE_LEG_METERS}`,
]) {
  if (!readiness.includes(required)) {
    throw new Error(`${readinessPath}: current-Rotunda A1 readiness guard is missing ${required}`);
  }
}
for (const forbidden of [
  "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44",
  "connectorVisibleLength > 0.15 && connectorVisibleLength < 44",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: broad stale-coordinate A1 readiness survived: ${forbidden}`);
  }
}
fs.writeFileSync(readinessPath, readiness, "utf8");

console.log(`Prepared ${AUTHORITY}: A1 terminal geometry starts at the current transformed Rotunda, uses the supplied Tunnel A passenger envelope, and final readiness rejects the old 28/44 m duplicate-leg envelope.`);
