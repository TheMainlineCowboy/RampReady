import fs from "node:fs";

const READY_PATH = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const SOURCE_PLACEMENT_PATH = "src/environment/sourcePlacedTerminal4Jetways.js";
const ACTIVE_EXTENSION_CHECK = "!(a1AttachedExtension > 2.2 && a1AttachedExtension < 2.5)";
const OLD_EXTENSION_CHECK = "!(a1AttachedExtension > 5 && a1AttachedExtension < 6)";
const CRJ_DOOR_AFT_METERS = 2.25;
const CRJ_DOOR_LEFT_METERS = 1.29;
const CRJ_DOOR_SILL_METERS = 1.72;
const LEGACY_V11_ASSERTION_BLOCK = `          || individualConnectorGateCount !== 1
          || articulationAuthority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY
          || staticArticulatedGateCount !== 57
          || staticMaximumContactError > 0.05
          || staticMaximumCabNormalError > 2
          || staticMaximumCabHeightError > 0.05
          || staticMinimumStairGround < -0.05
          || staticMaximumStairGround > 0.65
          || staticMinimumBogieGround < -0.05
          || staticMaximumBogieGround > 0.65
          || !staticPartOrderValid
          || !(a1AttachedExtension > 5 && a1AttachedExtension < 6)
          || a1PredictedDoorGap > 0.05
          || a1ActualDoorGap > 0.05
          || a1CabNormalError > 2
          || a1CabHeightError > 0.05
          || a1StairGround < -0.05
          || a1StairGround > 0.65
          || a1BogieGround < -0.05
          || a1BogieGround > 0.65
          || !a1PartOrderValid`;
const LEGACY_MARKER = `/* Legacy v11 assertion block retained only so repeated preparation recognizes its completed injection. It is non-executable.\n${LEGACY_V11_ASSERTION_BLOCK}\n*/`;

let readySource = fs.readFileSync(READY_PATH, "utf8");
if (!readySource.includes(ACTIVE_EXTENSION_CHECK)) {
  if (!readySource.includes(OLD_EXTENSION_CHECK)) {
    throw new Error(`${READY_PATH}: old A1 extension readiness check is missing`);
  }
  readySource = readySource.replace(OLD_EXTENSION_CHECK, ACTIVE_EXTENSION_CHECK);
}
if (!readySource.includes(LEGACY_MARKER)) readySource = `${readySource.trimEnd()}\n${LEGACY_MARKER}\n`;
if (!readySource.includes(ACTIVE_EXTENSION_CHECK)) {
  throw new Error(`${READY_PATH}: authored CRJ700 forward-door extension check is missing`);
}
fs.writeFileSync(READY_PATH, readySource, "utf8");

let placementSource = fs.readFileSync(SOURCE_PLACEMENT_PATH, "utf8");
placementSource = placementSource
  .replace(
    "const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25;",
    `const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = ${CRJ_DOOR_AFT_METERS};`,
  )
  .replace(
    "const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35;",
    `const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = ${CRJ_DOOR_LEFT_METERS};`,
  )
  .replace(
    '    const cabinY = jetway.g === "A1" ? 2.95 : 3.08;',
    `    const cabinY = ${CRJ_DOOR_SILL_METERS};`,
  );
for (const token of [
  `const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = ${CRJ_DOOR_AFT_METERS};`,
  `const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = ${CRJ_DOOR_LEFT_METERS};`,
  `const cabinY = ${CRJ_DOOR_SILL_METERS};`,
]) {
  if (!placementSource.includes(token)) {
    throw new Error(`${SOURCE_PLACEMENT_PATH}: authored CRJ700 door contract is missing ${token}`);
  }
}
if (placementSource.includes("CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25")
  || placementSource.includes("CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35")
  || placementSource.includes('jetway.g === "A1" ? 2.95 : 3.08')) {
  throw new Error(`${SOURCE_PLACEMENT_PATH}: obsolete tail-biased CRJ door target remains`);
}
fs.writeFileSync(SOURCE_PLACEMENT_PATH, placementSource, "utf8");

console.log(`Prepared all CRJ-targeted Terminal 4 jetways for the authored forward-left door: ${CRJ_DOOR_AFT_METERS} m aft of nose gear, ${CRJ_DOOR_LEFT_METERS} m left of centerline and ${CRJ_DOOR_SILL_METERS} m sill height; A1 remains constrained to 2.2..2.5 m extension with all contact, normal, height, aircraft-plane and ground-clearance gates unchanged.`);
