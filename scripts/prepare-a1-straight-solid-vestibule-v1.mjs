import { readFile, writeFile } from "node:fs/promises";

const targetUrl = new URL("../src/environment/correctUploadedJetwayInstallationV1.js", import.meta.url);
let source = await readFile(targetUrl, "utf8");

source = source
  .replace(
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-short-solid-terminal-vestibule-v6";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-single-solid-terminal-vestibule-v15";',
  )
  .replace(
    "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.3;",
    "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.75;",
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
  if (!(visibleLength > 0.25 && visibleLength < 6)) {
    throw new Error(\`A1 measured straight terminal vestibule span is invalid: \${visibleLength}\`);
  }
  connectorVector.normalize();

  const authoredOpeningDirection = new THREE.Vector3(
    rotundaOpening.openingDirectionX,
    0,
    rotundaOpening.openingDirectionZ,
  );
  const openingDot = connectorVector.dot(authoredOpeningDirection);
  if (openingDot < 0.55) {
    throw new Error(\`A1 straight terminal vestibule does not leave the authored Rotunda opening: \${openingDot}\`);
  }

  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";
  const materials = createConnectorMaterials(THREE);
  const width = 3.08;
  const height = 2.68;

  // Preserve the authored Rotunda as the visible terminal-side joint. The
  // generated vestibule only overlaps the authored collar enough to eliminate
  // a seam; it must not bury the Rotunda inside a fabricated box or add a
  // second generated bellows ring in front of the supplied geometry.
  const rotundaOverlap = 0.22;
  const startPoint = collarPoint.clone().addScaledVector(connectorVector, -rotundaOverlap);
  const shellLength = visibleLength + rotundaOverlap + TERMINAL_HIDDEN_OVERLAP_METERS;

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

  const terminalCapPoint = terminalPoint.clone().addScaledVector(connectorVector, TERMINAL_HIDDEN_OVERLAP_METERS - 0.08);
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalSolidBulkhead",
    [width, height, 0.16],
    [terminalCapPoint.x, collarPoint.y, terminalCapPoint.z],
    frame.yaw,
    false,
  );

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
  connector.userData.rotundaRecessSealAuthority = "same-day-a1-photo-shallow-collar-overlap-authored-rotunda-visible-v2";
  connector.userData.authoredRotundaVisuallyExposed = true;
  connector.userData.generatedRotundaBellows = false;
  connector.userData.passengerPassageCrossSectionBlocked = false;
  connector.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.apronFacingOpenAreaMeters = 0;
  connector.userData.apronFacingRotundaOpeningClosed = true;
  connector.userData.rotundaVestibuleClosureAuthority = "same-day-a1-photo-continuous-solid-shell-at-authored-collar-v2";
  fleet.add(connector);
  return connector;
}

function forceExactMaterialsDoubleSided`;

const functionPattern = /function buildMeasuredA1Connector\(THREE, fleet, placement, rotundaOpening, terminalDirection, terminalDistance\) \{[\s\S]*?\n\}\n\nfunction forceExactMaterialsDoubleSided/;
if (!functionPattern.test(source)) {
  throw new Error("Could not locate A1 measured connector function for straight-solid vestibule migration");
}
source = source.replace(functionPattern, replacement);

for (const forbidden of [
  "UploadedAirportJetwayA1TerminalTransition",
  "UploadedAirportJetwayA1TerminalCornerRoofCap",
  "UploadedAirportJetwayA1TerminalCornerFloorCap",
  "UploadedAirportJetwayA1TerminalPortalInterior",
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "UploadedAirportJetwayA1TerminalBellowsHeader",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Straight-solid A1 vestibule migration left retired, Rotunda-obscuring, or passage-blocking geometry ${forbidden}`);
  }
}
for (const required of [
  "UploadedAirportJetwayA1ShortTerminalVestibule",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
  "singleStraightSolidVestibule",
  "authoredRotundaVisuallyExposed",
  "generatedRotundaBellows = false",
  "same-day-a1-photo-shallow-collar-overlap-authored-rotunda-visible-v2",
  "passengerPassageCrossSectionBlocked = false",
  "apronFacingOpenAreaMeters = 0",
  "apronFacingRotundaOpeningClosed = true",
]) {
  if (!source.includes(required)) {
    throw new Error(`Straight-solid A1 vestibule migration is missing ${required}`);
  }
}

await writeFile(targetUrl, source);
console.log("Prepared A1 as one short straight solid white terminal vestibule with only a shallow seam overlap at the authored Rotunda collar, no generated Rotunda bellows or deep box overlap, hidden overlap into the real terminal wall, and zero apron-facing open area.");
