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
// The measured connector values are declared after the old high-detail anchor.
// Always place the fleet record immediately after the wall measurement block.
source = source.replace(`${placementPush}\n`, "").replace(`${oldPlacementPush}\n`, "");
const placementAnchor = "    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null";
if (!source.includes(placementAnchor)) throw new Error(`${path}: measured wall placement anchor missing`);
source = source.replace(placementAnchor, `${placementPush}\n\n${placementAnchor}`);

const installLine = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements);";
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
    '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1";',
  );

const supersededDisclosure = '  group.userData.supersededFallbackDisclosure = \'visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered"\';';
if (!source.includes(supersededDisclosure)) {
  const authority = '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1";';
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
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  'visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1"',
  "supersededFallbackDisclosure",
]) {
  if (!source.includes(token)) throw new Error(`${path}: uploaded airport jetway integration missing ${token}`);
}
if (source.indexOf(placementPush) < source.indexOf("const connectorTowardX")) {
  throw new Error(`${path}: uploaded placement is created before measured connector values`);
}

fs.writeFileSync(path, source, "utf8");

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let fleet = fs.readFileSync(fleetPath, "utf8");
const connectorImport = 'import { addUploadedAirportJetwayTerminalConnector } from "./uploadedAirportJetwayTerminalConnector.js";';
if (!fleet.includes(connectorImport)) fleet = `${connectorImport}\n${fleet}`;
const connectorCall = "        addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);";
if (!fleet.includes(connectorCall)) {
  const anchor = "        fleet.add(anchor);";
  if (!fleet.includes(anchor)) throw new Error(`${fleetPath}: uploaded connector call anchor missing`);
  fleet = fleet.replace(anchor, `${anchor}\n${connectorCall}`);
}
const connectorEvidence = "      group.userData.uploadedJetwayMeasuredTerminalConnectorCount = placements.length;";
if (!fleet.includes(connectorEvidence)) {
  const anchor = "      group.userData.uploadedJetwayCount = placements.length;";
  if (!fleet.includes(anchor)) throw new Error(`${fleetPath}: uploaded connector evidence anchor missing`);
  fleet = fleet.replace(anchor, `${anchor}\n${connectorEvidence}`);
}
for (const token of [connectorImport, connectorCall, connectorEvidence]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: measured terminal connector wiring missing ${token}`);
}
fs.writeFileSync(fleetPath, fleet, "utf8");

console.log("Prepared all 58 Terminal 4 gate transforms for the uploaded Tunnel_A/Tunnel_B/Tunnel_C/Rotunda/Cab jetway replacement with measured authored-wall connectors. Placement records are created only after wall measurements; airport placement remains unchanged.");
