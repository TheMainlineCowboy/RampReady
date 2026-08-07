import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

// Measured directly from the authored crj700-user.glb used by production:
// nose-gear center is approximately model Z=0.00 m; the forward-left door
// outline center is model Z=3.87 m and X=+1.27 m. The retired 7.32/1.34 values
// target the mid-cabin/wing region and visibly drive the jetway over the wing.
const MEASURED_DOOR_AFT_METERS = 3.87;
const MEASURED_DOOR_LEFT_METERS = 1.27;
const GEOMETRY_AUTHORITY = "authored-crj700-user-glb-forward-left-door-center-v1";

source = source
  .replace(
    /const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = [^;]+;/,
    `const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = ${MEASURED_DOOR_AFT_METERS};`,
  )
  .replace(
    /const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = [^;]+;/,
    `const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = ${MEASURED_DOOR_LEFT_METERS};`,
  );

if (!source.includes("CRJ_FORWARD_DOOR_GEOMETRY_AUTHORITY")) {
  const anchor = `const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = ${MEASURED_DOOR_LEFT_METERS};`;
  if (!source.includes(anchor)) {
    throw new Error(`${jetwayPath}: measured forward-left door constants were not applied`);
  }
  source = source.replace(
    anchor,
    `${anchor}\nconst CRJ_FORWARD_DOOR_GEOMETRY_AUTHORITY = "${GEOMETRY_AUTHORITY}";`,
  );
}

const evidenceAnchor = '  group.userData.initialJetwayState = "attached-to-aircraft-door";';
if (!source.includes("group.userData.crjForwardDoorGeometryAuthority")) {
  if (!source.includes(evidenceAnchor)) {
    throw new Error(`${jetwayPath}: jetway evidence anchor is missing`);
  }
  source = source.replace(
    evidenceAnchor,
    `${evidenceAnchor}\n  group.userData.crjForwardDoorGeometryAuthority = CRJ_FORWARD_DOOR_GEOMETRY_AUTHORITY;\n  group.userData.crjForwardDoorAftOfNoseGearMeters = CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS;\n  group.userData.crjForwardDoorLeftOfCenterlineMeters = CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;`,
  );
}

for (const token of [
  `CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = ${MEASURED_DOOR_AFT_METERS}`,
  `CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = ${MEASURED_DOOR_LEFT_METERS}`,
  `CRJ_FORWARD_DOOR_GEOMETRY_AUTHORITY = "${GEOMETRY_AUTHORITY}"`,
  "group.userData.crjForwardDoorGeometryAuthority",
  "group.userData.crjForwardDoorAftOfNoseGearMeters",
  "group.userData.crjForwardDoorLeftOfCenterlineMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: measured CRJ forward-door output is missing ${token}`);
  }
}

for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: retired CRJ door geometry survived production preparation: ${forbidden}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log(`Prepared the production jetway target from the authored CRJ model: forward-left door ${MEASURED_DOOR_AFT_METERS.toFixed(2)} m aft of nose gear and ${MEASURED_DOOR_LEFT_METERS.toFixed(2)} m left of centerline; the retired wing-area target is absent.`);
