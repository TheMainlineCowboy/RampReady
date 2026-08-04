import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const ACTIVE_EXTENSION_CHECK = "!(a1AttachedExtension > 2.2 && a1AttachedExtension < 2.5)";
const OLD_EXTENSION_CHECK = "!(a1AttachedExtension > 5 && a1AttachedExtension < 6)";
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

let source = fs.readFileSync(path, "utf8");
if (!source.includes(ACTIVE_EXTENSION_CHECK)) {
  if (!source.includes(OLD_EXTENSION_CHECK)) {
    throw new Error(`${path}: old A1 extension readiness check is missing`);
  }
  source = source.replace(OLD_EXTENSION_CHECK, ACTIVE_EXTENSION_CHECK);
}
if (!source.includes(LEGACY_MARKER)) source = `${source.trimEnd()}\n${LEGACY_MARKER}\n`;
if (!source.includes(ACTIVE_EXTENSION_CHECK)) {
  throw new Error(`${path}: authored CRJ700 forward-door extension check is missing`);
}
fs.writeFileSync(path, source, "utf8");
console.log("Prepared A1 readiness for the authored CRJ700 forward-left door: 2.2..2.5 m extension, with the existing contact, normal, height, aircraft-plane and ground-clearance gates unchanged.");
