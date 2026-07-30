import fs from "node:fs";

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const verifier = fs.readFileSync(verifierPath, "utf8");
const jetways = fs.readFileSync(jetwayPath, "utf8");

for (const token of [
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  "AIR_Jetway01_OuterTelescopingTunnels",
  "AIR_Jetway01_InnerTelescopingTunnels",
  "AIR_Jetway01_AircraftCabins",
  "AIR_Jetway01_WheelBogies",
  "usesTerminalBuildingTextures = false",
  "proceduralBuildingBoxReuse = false",
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "sourceFacadeRecessMeters",
  "a1DoorContactErrorMeters",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 v5 source contract is missing ${token}`);
}

for (const token of [
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CLOSED_SERVICE_DOOR_GATES",
  "FACADE_VENT_GATES",
  "sourceFacadeRecessMeters",
  "a1DoorContactErrorMeters",
  "Obsolete box-built, repetitive-facade, or misaligned jetway returned",
]) {
  if (!verifier.includes(token)) throw new Error(`Prepared AIR_Jetway01 v5 verifier contract is missing ${token}`);
}

for (const forbidden of [
  'detailLevel: "fsx-air-jetway01-faithful-articulated-v2"',
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "const targetX = jetway.px - forwardX * 5.6",
  "gateNumber % 3",
  "gateNumber % 2",
]) {
  if (verifier.includes(forbidden)) throw new Error(`Obsolete AIR_Jetway01 verifier token remains ${forbidden}`);
}

console.log("Prepared AIR_Jetway01 v5 source contract: exact source GUID and textures, CRJ700 proportions and door station, terminal attachment, and non-repetitive lower facade.");
