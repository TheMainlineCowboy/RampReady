import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");

if (!jetways.includes("const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS")) {
  const anchor = "const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));\n";
  const insertion = `${anchor}
const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1;
const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55;
// The cabin and seven bellows folds extend 2.61 meters beyond bridgeEnd.
// Keep that assembly just outside the aircraft skin instead of driving it
// through the cockpit/fuselage centerline.
const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78;
`;
  if (!jetways.includes(anchor)) throw new Error("AIR_Jetway01 alignment constants anchor is missing");
  jetways = jetways.replace(anchor, insertion);
}

const replacements = [
  [
    "    const targetX = jetway.px - forwardX * 5.6 + leftX * 1.25;\n    const targetZ = jetway.pz - forwardZ * 5.6 + leftZ * 1.25;",
    "    const targetX = jetway.px - forwardX * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftX * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;\n    const targetZ = jetway.pz - forwardZ * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftZ * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;",
  ],
  [
    "    const bridgeEnd = clamp(distance - 2.0, 14.5, 31.5);",
    "    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 13.5, 30.5);",
  ],
  [
    "  const cabin = createArchedTunnelGeometry(THREE, 3.45, 2.82, 0.3);",
    "  const cabin = createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28);",
  ],
  [
    "        position: [endX + px * side * 1.7, cabinY + 0.25, endZ + pz * side * 1.7],",
    "        position: [endX + px * side * 1.49, cabinY + 0.25, endZ + pz * side * 1.49],",
  ],
];
for (const [oldText, newText] of replacements) {
  if (jetways.includes(newText)) continue;
  if (!jetways.includes(oldText)) throw new Error(`AIR_Jetway01 alignment anchor is missing: ${oldText}`);
  jetways = jetways.replace(oldText, newText);
}

for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "createArchedTunnelGeometry(THREE, 3.05, 2.72, 0.28)",
  "px * side * 1.49",
]) {
  if (!jetways.includes(token)) throw new Error(`AIR_Jetway01 aligned source is missing ${token}`);
}
fs.writeFileSync(jetwayPath, jetways, "utf8");

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
const verifierReplacements = [
  [
    '  "const targetX = jetway.px - forwardX * 5.6",\n  "const targetZ = jetway.pz - forwardZ * 5.6",',
    '  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1",\n  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55",\n  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78",\n  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",',
  ],
];
for (const [oldText, newText] of verifierReplacements) {
  if (verifier.includes(newText)) continue;
  if (!verifier.includes(oldText)) throw new Error(`AIR_Jetway01 verifier alignment anchor is missing: ${oldText}`);
  verifier = verifier.replace(oldText, newText);
}
for (const token of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 4.1",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.55",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.78",
  "distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
]) {
  if (!verifier.includes(token)) throw new Error(`AIR_Jetway01 verifier is missing aligned token ${token}`);
}
fs.writeFileSync(verifierPath, verifier, "utf8");
console.log("Prepared AIR_Jetway01 CRJ door alignment: shorter tunnel, narrower cabin, and bellows stop outside the forward-left door.");
