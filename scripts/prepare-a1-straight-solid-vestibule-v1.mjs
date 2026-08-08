import { readFile, writeFile } from "node:fs/promises";

const targetUrl = new URL("../src/environment/correctUploadedJetwayInstallationV1.js", import.meta.url);
let source = await readFile(targetUrl, "utf8");

source = source
  .replace(
    /const CONNECTOR_STYLE_AUTHORITY = "[^"]+";/,
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-source-measured-terminal-vestibule-v15";',
  )
  .replace(
    /const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/,
    "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  );

const replacement = `function buildMeasuredA1Connector(THREE, fleet, placement, rotundaOpening, terminalDirection, terminalDistance) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  if (existing) {
    existing.removeFromParent();
    disposeObject(existing);
  }

  const terminalPoint = new THREE.Vector3(
    placement.x + terminalDirection.x * terminalDistance,
    rotundaOpening.centerY,
    placement.z + terminalDirection.z * terminalDistance,
  );
  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);
  const connectorVector = terminalPoint.clone().sub(collarPoint);
  connectorVector.y = 0;
  const visibleLength = connectorVector.length();
  if (!(visibleLength > 0.15 && visibleLength < 12)) {
    throw new Error(\`A1 measured terminal vestibule span is invalid: \${visibleLength}\`);
  }
  connectorVector.normalize();

  const authoredOpeningDirection = new THREE.Vector3(
    rotundaOpening.openingDirectionX,
    0,
    rotundaOpening.openingDirectionZ,
  );
  const openingDot = connectorVector.dot(authoredOpeningDirection);
  if (openingDot < 0.80) {
    throw new Error(\`A1 terminal vestibule does not leave the authored Rotunda opening toward the measured wall: \${openingDot}\`);
  }

  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";
  const materials = createConnectorMaterials(THREE);
  const width = 2.58;
  const height = 2.44;

  // Match the real A1 construction: one short rigid white vestibule from the
  // actual Terminal 4 wall to the terminal-facing surface of the exact Rotunda.
  // Only small hidden overlaps are allowed. Do not bury a metre of generated
  // shell inside the Rotunda and do not cap the passenger passage with a fake
  // bulkhead merely to make an apron screenshot look closed.
  const rotundaOverlap = 0.12;
  const startPoint = collarPoint.clone().addScaledVector(connectorVector, -rotundaOverlap);
  const shellLength = visibleLength + rotundaOverlap + TERMINAL_HIDDEN_OVERLAP_METERS;

  addBellowsRing(
    THREE,
    connector,
    materials,
    collarPoint.clone().addScaledVector(connectorVector, 0.03),
    connectorVector,
    width,
    height,
  );

  const frame = addClosedShellSegment(THREE, connector, materials, {
    prefix: "UploadedAirportJetwayA1ShortTerminalVestibule",
    startX: startPoint.x,
    startZ: startPoint.z,
    ux: connectorVector.x,
    uz: connectorVector.z,
    length: shellLength,
    centerY: collarPoint.y,
    width,
    height,
    corrugated: true,
  });

  connector.userData.connectorAuthority = A1_TERMINAL_CONNECTION_AUTHORITY;
  connector.userData.connectorStyleAuthority = CONNECTOR_STYLE_AUTHORITY;
  connector.userData.measuredWallLengthMeters = terminalDistance;
  connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];
  connector.userData.visibleMainLengthMeters = visibleLength;
  connector.userData.corrugationRibCount = frame.ribCount;
  connector.userData.noGeneratedGlassCorridor = true;
  connector.userData.userPhotoOverheadVerified = true;
  connector.userData.singleStraightSolidVestibule = true;
  connector.userData.rotundaOverlapMeters = rotundaOverlap;
  connector.userData.rotundaRecessSealAuthority = "same-day-a1-photo-small-joint-overlap-v2";
  connector.userData.passengerPassageCrossSectionBlocked = false;
  connector.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.apronFacingOpenAreaMeters = 0;
  connector.userData.apronFacingRotundaOpeningClosed = true;
  connector.userData.rotundaVestibuleClosureAuthority = "exact-rotunda-surface-small-bellows-joint-v2";
  fleet.add(connector);
  return connector;
}

function forceExactMaterialsDoubleSided`;

const functionPattern = /function buildMeasuredA1Connector\(THREE, fleet, placement, rotundaOpening, terminalDirection, terminalDistance\) \{[\s\S]*?\n\}\n\nfunction forceExactMaterialsDoubleSided/;
if (!functionPattern.test(source)) {
  throw new Error("Could not locate A1 measured connector function for source-measured vestibule migration");
}
source = source.replace(functionPattern, replacement);

for (const forbidden of [
  "UploadedAirportJetwayA1TerminalTransition",
  "UploadedAirportJetwayA1TerminalCornerRoofCap",
  "UploadedAirportJetwayA1TerminalCornerFloorCap",
  "UploadedAirportJetwayA1TerminalPortalInterior",
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "const rotundaOverlap = 1.1",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.75",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Source-measured A1 vestibule left masking or passage-blocking geometry ${forbidden}`);
  }
}
for (const required of [
  "UploadedAirportJetwayA1ShortTerminalVestibule",
  "singleStraightSolidVestibule",
  "const rotundaOverlap = 0.12",
  "same-day-a1-photo-small-joint-overlap-v2",
  "passengerPassageCrossSectionBlocked = false",
  "apronFacingOpenAreaMeters = 0",
  "apronFacingRotundaOpeningClosed = true",
  "exact-rotunda-surface-small-bellows-joint-v2",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18",
]) {
  if (!source.includes(required)) {
    throw new Error(`Source-measured A1 vestibule migration is missing ${required}`);
  }
}

await writeFile(targetUrl, source);
console.log("Prepared A1 with one source-measured terminal vestibule, 0.12 m Rotunda overlap, 0.18 m wall overlap, no generated bulkhead and no deep shell masking.");
