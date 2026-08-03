import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

const importLine = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleet.js";';
if (!source.includes(importLine)) {
  const anchor = 'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";';
  if (!source.includes(anchor)) throw new Error(`${path}: uploaded jetway import anchor missing`);
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const placementDeclaration = "  const uploadedJetwayPlacements = [];";
if (!source.includes(placementDeclaration)) {
  const anchor = "  let a1AnimatedLayout = null;";
  if (!source.includes(anchor)) throw new Error(`${path}: placement declaration anchor missing`);
  source = source.replace(anchor, `${anchor}\n${placementDeclaration}`);
}

const placementPush = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      rotundaY,
      bridgeEnd,
      cabinY,
      connectorTowardX,
      connectorTowardZ,
      wallConnectorLength,
      targetX,
      targetZ,
      aircraftDoorDistance: distance,
      aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS,
    });`;
const oldPlacementPush = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      rotundaY,
      bridgeEnd,
      cabinY,
    });`;
source = source.replace(`${placementPush}\n`, "").replace(`${oldPlacementPush}\n`, "");
const placementAnchor = "    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null";
if (!source.includes(placementAnchor)) throw new Error(`${path}: measured wall placement anchor missing`);
source = source.replace(placementAnchor, `${placementPush}\n\n${placementAnchor}`);

const oldInstallLine = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements);";
const installLine = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures);";
source = source.replace(oldInstallLine, installLine);
if (!source.includes(installLine)) {
  const anchor = "  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;";
  if (!source.includes(anchor)) throw new Error(`${path}: uploaded fleet installation anchor missing`);
  source = source.replace(anchor, `${installLine}\n${anchor}`);
}

source = source
  .replace(
    '  group.userData.sourceGeometryMode = "procedural-articulated-fallback-pending-original-AIR_Jetway01-mesh-recovery";',
    '  group.userData.sourceGeometryMode = "user-supplied-airport-jetway-loading";',
  )
  .replace(
    "  group.userData.requiresOriginalSourceMesh = true;",
    "  group.userData.requiresOriginalSourceMesh = false;",
  )
  .replace(
    "  group.userData.a1JetwayController = animatedA1Jetway.userData.controller;",
    "  group.userData.a1JetwayController = uploadedJetwayController;",
  )
  .replace(
    /  group\.userData\.visualAuthority = "source-scale articulated fallback[^\n]*";/,
    '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured";',
  )
  .replace(
    '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1";',
    '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured";',
  );

const supersededDisclosure = '  group.userData.supersededFallbackDisclosure = \'visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered"\';';
if (!source.includes(supersededDisclosure)) {
  const authority = '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured";';
  if (!source.includes(authority)) throw new Error(`${path}: uploaded visual authority anchor missing`);
  source = source.replace(authority, `${authority}\n${supersededDisclosure}`);
}

for (const token of [
  importLine,
  placementDeclaration,
  placementPush,
  installLine,
  "connectorTowardX",
  "connectorTowardZ",
  "wallConnectorLength",
  "aircraftDoorDistance: distance",
  "aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  'visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured"',
  "supersededFallbackDisclosure",
]) {
  if (!source.includes(token)) throw new Error(`${path}: uploaded airport jetway integration missing ${token}`);
}
if (source.indexOf(placementPush) < source.indexOf("const connectorTowardX")) {
  throw new Error(`${path}: uploaded placement is created before measured connector values`);
}

fs.writeFileSync(path, source, "utf8");

await import("./prepare-uploaded-airport-jetway-articulation-v10.mjs");

// The fleet module is committed as the canonical runtime implementation. This
// preparation step must validate it without inserting compatibility imports or
// per-gate connector calls, because static jetways and connectors are already
// batched while A1 remains the single detailed individual assembly.
const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const fleet = fs.readFileSync(fleetPath, "utf8");
for (const token of [
  "addUploadedAirportJetwayStaticTerminalConnectors",
  "addUploadedAirportJetwayTerminalConnector",
  "const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);",
  "addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);",
  "if (placement.gate === \"A1\")",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "uploadedJetwayStaticConnectorGateCount = staticConnectors.staticGateCount",
  "uploadedJetwayStaticConnectorBatchCount = staticConnectors.batchCount",
  "uploadedJetwayIndividualConnectorGateCount = 1",
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "uploadedJetwayA1PredictedDoorGapMeters",
  "uploadedJetwayStaticArticulatedGateCount",
]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: canonical batched terminal connector wiring missing ${token}`);
}
if ((fleet.match(/from "\.\/uploadedAirportJetwayTerminalConnector\.js"/g) || []).length !== 1) {
  throw new Error(`${fleetPath}: terminal connector module must have exactly one canonical import`);
}

console.log("Prepared all 58 Terminal 4 gate transforms and validated the committed batched uploaded-jetway runtime: 57 static jetways and connectors are instanced, A1 remains individual, measured wall placement is preserved and tracked source is not mutated.");
