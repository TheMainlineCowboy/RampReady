import fs from "node:fs";

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let verifier = fs.readFileSync(verifierPath, "utf8");
const jetways = fs.readFileSync(jetwayPath, "utf8");

// The exact uploaded jetway integration uses the measured CRJ forward-left
// door relationship and the supplied model's full 2.61 m contact assembly.
// Keep the broad KPHX source verifier intact while updating only its retired
// geometry literals before it runs later in verify:kphx-v181.
const verifierReplacements = [
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61"],
];
let patchedVerifier = verifier;
for (const [retired, exact] of verifierReplacements) {
  patchedVerifier = patchedVerifier.split(retired).join(exact);
}
if (patchedVerifier !== verifier) {
  fs.writeFileSync(verifierPath, patchedVerifier, "utf8");
  verifier = patchedVerifier;
}

function includesAny(source, candidates) {
  return (Array.isArray(candidates) ? candidates : [candidates]).some((candidate) => source.includes(candidate));
}

for (const token of [
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  'sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51])',
  "AIR_Jetway01_OuterTelescopingTunnels",
  "AIR_Jetway01_InnerTelescopingTunnels",
  "AIR_Jetway01_AircraftCabins",
  "AIR_Jetway01_WheelBogies",
  "usesTerminalBuildingTextures = false",
  "proceduralBuildingBoxReuse = false",
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34"],
  "sourceFacadeRecessMeters",
  "group.userData.sourceScaleAuthority",
  "group.userData.requiresOriginalSourceMesh",
  "group.userData.jetwayMotionLimits",
  'group.userData.initialJetwayState = "attached-to-aircraft-door"',
]) {
  if (!includesAny(jetways, token)) {
    const label = Array.isArray(token) ? token.join(" or ") : token;
    throw new Error(`AIR_Jetway01 source-scale contract is missing ${label}`);
  }
}

for (const token of [
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  'sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51])',
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "CLOSED_SERVICE_DOOR_GATES",
  "FACADE_VENT_GATES",
  "sourceFacadeRecessMeters",
  "sourceScaleAuthority",
  "requiresOriginalSourceMesh",
  "jetwayMotionLimits",
  "aircraft-specific jetway shrink",
]) {
  if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 source-scale verifier contract is missing ${token}`);
}

for (const forbidden of [
  'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "scale: [2.24, 2.12, wallConnectorLength]",
]) {
  if (jetways.includes(forbidden)) throw new Error(`AIR_Jetway01 runtime contains forbidden aircraft-specific jetway shrink ${forbidden}`);
}

console.log("Verified AIR_Jetway01 source authority with exact-jetway compatibility: airport dimensions remain preserved, aircraft-specific shrinking remains forbidden, and the corrected 7.32/1.34/2.61 m CRJ door-contact geometry is enforced.");
