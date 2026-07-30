import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");

const replaceHistorical = (source, candidates, replacement, label) => {
  if (source.includes(replacement)) return source;
  const match = candidates.find((candidate) => source.includes(candidate));
  if (!match) throw new Error(`AIR_Jetway01 ${label} anchor is missing`);
  return source.replace(match, replacement);
};

if (!jetways.includes("const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS")) {
  const anchor = "const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));\n";
  const insertion = `${anchor}\nconst CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25;\nconst CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3;\n// The compact textured CRJ-scale cabin and bellows extend about 1.5 meters\n// beyond bridgeEnd. Keep the contact assembly outside the aircraft skin.\nconst AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55;\n`;
  if (!jetways.includes(anchor)) throw new Error("AIR_Jetway01 alignment constants anchor is missing");
  jetways = jetways.replace(anchor, insertion);
}

jetways = replaceHistorical(
  jetways,
  [
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.6",
  ],
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "forward-door longitudinal target",
);
jetways = replaceHistorical(
  jetways,
  [
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.25",
  ],
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3",
  "forward-door lateral target",
);
jetways = replaceHistorical(
  jetways,
  [
    "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78",
    "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.0",
    "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65",
  ],
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "contact clearance",
);
jetways = replaceHistorical(
  jetways,
  [
    "    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 13.5, 30.5);",
    "    const bridgeEnd = clamp(distance - 2.0, 14.5, 31.5);",
  ],
  "    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5);",
  "reach limits",
);
jetways = replaceHistorical(
  jetways,
  [
    "  const cabin = createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28);",
    "  const cabin = createArchedTunnelGeometry(THREE, 3.45, 2.82, 0.3);",
  ],
  "  const cabin = createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22);",
  "cabin geometry",
);

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5",
  "createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22)",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 textured CRJ-scale source is missing ${token}`);
}
fs.writeFileSync(jetwayPath, jetways, "utf8");

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
for (const [oldToken, newToken] of [
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25"],
  ["CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3"],
  ["CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55"],
  ["AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55"],
]) {
  verifier = verifier.replaceAll(oldToken, newToken);
}
for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.3",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
]) {
  if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 verifier is missing textured CRJ-scale token ${token}`);
}
fs.writeFileSync(verifierPath, verifier, "utf8");
console.log("Prepared AIR_Jetway01 v4 alignment: aft forward-door target, exact source texture support, compact cabin and realistic bridge clearance.");
