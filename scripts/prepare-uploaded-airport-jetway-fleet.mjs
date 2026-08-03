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
      aircraftHeading: parkingHeading,
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
  .replace("  group.userData.requiresOriginalSourceMesh = true;", "  group.userData.requiresOriginalSourceMesh = false;")
  .replace("  group.userData.a1JetwayController = animatedA1Jetway.userData.controller;", "  group.userData.a1JetwayController = uploadedJetwayController;")
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
  "aircraftHeading: parkingHeading",
  "connectorTowardX",
  "connectorTowardZ",
  "wallConnectorLength",
  "aircraftDoorDistance: distance",
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
]) {
  if (!source.includes(token)) throw new Error(`${path}: uploaded airport jetway integration missing ${token}`);
}
if (source.indexOf(placementPush) < source.indexOf("const connectorTowardX")) {
  throw new Error(`${path}: uploaded placement is created before measured connector values`);
}
fs.writeFileSync(path, source, "utf8");

await import("./prepare-uploaded-airport-jetway-articulation-v10.mjs");
await import("./prepare-uploaded-jetway-full3d-evidence-v11.mjs");

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const fleet = fs.readFileSync(fleetPath, "utf8");
for (const token of [
  "addUploadedAirportJetwayStaticTerminalConnectors",
  "addUploadedAirportJetwayTerminalConnector",
  "const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);",
  "addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "uploadedJetwayStaticConnectorGateCount = staticConnectors.staticGateCount",
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "uploadedJetwayA1CabNormalErrorDegrees",
  "uploadedJetwayStaticMaximumCabNormalErrorDegrees",
]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: canonical full-3D terminal connector wiring missing ${token}`);
}
if ((fleet.match(/from "\.\/uploadedAirportJetwayTerminalConnector\.js"/g) || []).length !== 1) {
  throw new Error(`${fleetPath}: terminal connector module must have exactly one canonical import`);
}

console.log("Prepared all 58 exact supplied Terminal 4 jetways with aircraft headings, full 3D Cab poses, grounded source stair/bogie geometry and measured terminal connectors.");
