import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

const animatedImport = 'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";';
const exactImport = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js";';
if (!source.includes(exactImport)) {
  if (!source.includes(animatedImport)) throw new Error(`${path}: animated A1 import anchor is missing`);
  source = source.replace(animatedImport, `${animatedImport}\n${exactImport}`);
}

source = source
  .replace("const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25;", "const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32;")
  .replace("const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35;", "const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34;")
  .replace("const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55;", "const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61;");

const declarationAnchor = "  let a1AnimatedLayout = null;\n\n  for (const jetway of jetways) {";
const declarationReplacement = "  let a1AnimatedLayout = null;\n  const uploadedJetwayPlacements = [];\n\n  for (const jetway of jetways) {";
if (!source.includes("const uploadedJetwayPlacements = []")) {
  if (!source.includes(declarationAnchor)) throw new Error(`${path}: gate-loop declaration anchor is missing`);
  source = source.replace(declarationAnchor, declarationReplacement);
}

const connectorAnchor = "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);";
const placementBlock = `${connectorAnchor}
    const parkedGateCode = [...jetway.g].reduce(
      (value, character) => value + character.charCodeAt(0),
      0,
    );
    const exactBridgeEnd = jetway.g === "A1"
      ? bridgeEnd
      : 11.9 + (parkedGateCode % 4) * 0.65;
    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      aircraftDoorDistance: distance,
      aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS,
      bridgeStart,
      bridgeEnd: exactBridgeEnd,
      rotundaY,
      cabinY,
      wallConnectorLength,
      connectorTowardX,
      connectorTowardZ,
    });`;
if (!source.includes("uploadedJetwayPlacements.push({")) {
  if (!source.includes(connectorAnchor)) throw new Error(`${path}: measured connector anchor is missing`);
  source = source.replace(connectorAnchor, placementBlock);
}

const oldController = "  group.userData.a1JetwayController = animatedA1Jetway.userData.controller;";
const exactController = `  if (uploadedJetwayPlacements.length !== 58) {
    throw new Error(\`Expected 58 exact Airport Jetway placements, received \${uploadedJetwayPlacements.length}\`);
  }
  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures);
  group.userData.uploadedJetwayMeasuredTerminalConnectorCount = uploadedJetwayPlacements.filter(
    (placement) => Number(placement.wallConnectorLength) > 0,
  ).length;
  group.userData.a1JetwayController = uploadedJetwayController;`;
if (!source.includes("const uploadedJetwayController = installUploadedAirportJetwayFleet(")) {
  if (!source.includes(oldController)) throw new Error(`${path}: A1 controller replacement anchor is missing`);
  source = source.replace(oldController, exactController);
}

for (const token of [
  exactImport,
  "const uploadedJetwayPlacements = []",
  "uploadedJetwayPlacements.push({",
  "aircraftDoorDistance: distance",
  "bridgeEnd: exactBridgeEnd",
  "wallConnectorLength",
  "connectorTowardX",
  "connectorTowardZ",
  "uploadedJetwayPlacements.length !== 58",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
  "group.userData.a1JetwayController = uploadedJetwayController",
  "uploadedJetwayMeasuredTerminalConnectorCount",
]) {
  if (!source.includes(token)) throw new Error(`${path}: exact Airport Jetway source wiring is missing ${token}`);
}
fs.writeFileSync(path, source, "utf8");
console.log("Prepared 58 measured Terminal 4 placements for the exact Airport_Jetway.glb: 57 parked articulated instances and individually controlled A1 door alignment.");
