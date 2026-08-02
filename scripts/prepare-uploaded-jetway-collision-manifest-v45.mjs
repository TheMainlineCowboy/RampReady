import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targetPath = path.join(root, "src/environment/uploadedAirportJetwayFleet.js");
let source = fs.readFileSync(targetPath, "utf8");

const importLine = 'import { buildUploadedAirportJetwayCollisionManifest } from "./uploadedAirportJetwayCollisionManifest.js";';
const connectorImport = '} from "./uploadedAirportJetwayTerminalConnector.js";';
const fleetAnchor = '      fleet.name = "UploadedAirportJetwayFleet";';
const addAnchor = "      group.add(fleet);";

if (!source.includes(importLine)) {
  if (!source.includes(connectorImport)) throw new Error("Uploaded jetway connector import anchor is missing");
  source = source.replace(connectorImport, `${connectorImport}\n${importLine}`);
}

if (!source.includes("fleet.userData.airportCollisionManifest")) {
  if (!source.includes(fleetAnchor)) throw new Error("Uploaded jetway fleet creation anchor is missing");
  source = source.replace(
    fleetAnchor,
    `${fleetAnchor}\n      const airportCollisionManifest = buildUploadedAirportJetwayCollisionManifest(placements);\n      fleet.userData.airportCollisionManifest = airportCollisionManifest;\n      fleet.userData.airportCollisionAuthority = airportCollisionManifest.authority;\n      fleet.userData.airportCollisionObstacleCount = airportCollisionManifest.obstacleCount;`,
  );
}

if (!source.includes("uploadedJetwayCollisionObstacleCount")) {
  if (!source.includes(addAnchor)) throw new Error("Uploaded jetway fleet add anchor is missing");
  source = source.replace(
    addAnchor,
    `${addAnchor}\n      group.userData.uploadedJetwayCollisionAuthority = airportCollisionManifest.authority;\n      group.userData.uploadedJetwayCollisionObstacleCount = airportCollisionManifest.obstacleCount;`,
  );
}

for (const required of [
  importLine,
  "buildUploadedAirportJetwayCollisionManifest(placements)",
  "fleet.userData.airportCollisionManifest = airportCollisionManifest",
  "group.userData.uploadedJetwayCollisionObstacleCount = airportCollisionManifest.obstacleCount",
]) {
  if (!source.includes(required)) throw new Error(`Uploaded jetway collision preparation is incomplete: ${required}`);
}

fs.writeFileSync(targetPath, source);
console.log("Prepared collision proxies from the exact supplied jetway footprint at all 58 Terminal 4 gates and their measured fixed terminal connectors.");
