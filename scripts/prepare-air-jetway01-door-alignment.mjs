import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");

const replaceHistorical = (source, candidates, replacement, label) => {
  if (source.includes(replacement)) return source;
  const match = candidates.find((candidate) => source.includes(candidate));
  if (!match) throw new Error(`AIR_Jetway01 ${label} anchor is missing`);
  return source.replace(match, replacement);
};

jetways = replaceHistorical(
  jetways,
  [
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.6",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  ],
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ700 forward-door longitudinal station",
);
jetways = replaceHistorical(
  jetways,
  [
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.25",
  ],
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CRJ700 forward-door lateral station",
);
jetways = replaceHistorical(
  jetways,
  [
    "  const cabin = createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28);",
    "  const cabin = createArchedTunnelGeometry(THREE, 3.45, 2.82, 0.3);",
    "  const cabin = createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22);",
  ],
  "  const cabin = createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18);",
  "CRJ700 cabin geometry",
);

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "a1DoorContactErrorMeters",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 CRJ700 source is missing ${token}`);
}
fs.writeFileSync(jetwayPath, jetways, "utf8");

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
for (const [oldToken, newToken] of [
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28"],
  ["createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)", "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)"],
]) verifier = verifier.replaceAll(oldToken, newToken);

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
]) if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 verifier is missing CRJ700 token ${token}`);

fs.writeFileSync(verifierPath, verifier, "utf8");
console.log("Prepared AIR_Jetway01 v5 alignment: CRJ700 forward-door station, compact contact cabin, and measured A1 contact evidence.");
