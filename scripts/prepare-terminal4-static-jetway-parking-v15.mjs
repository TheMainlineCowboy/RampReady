import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");
const authority = "source-rotunda-stand-facing-retracted-static-parking-v15";

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`${jetwayPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

if (!source.includes(authority)) {
  replaceRequired(
    "    const bridgeEnd = clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5);",
    `    const parkedGateCode = [...jetway.g].reduce((value, character) => value + character.charCodeAt(0), 0);
    // A1 is the active training gate and starts attached to the aircraft. Every
    // other stand is currently unoccupied, so its bridge remains telescoped in
    // near the source rotunda rather than pretending an aircraft is parked at
    // all 57 gates. Length variation avoids a cloned row while remaining within
    // the stock AIR_Jetway01 articulation envelope.
    const bridgeEnd = jetway.g === "A1"
      ? clamp(distance - AIR_JETWAY01_CONTACT_CLEARANCE_METERS, 11.5, 29.5)
      : 11.9 + (parkedGateCode % 4) * 0.65;`,
    "bridge extension",
  );

  replaceRequired(
    `    const outerLength = clamp(bridgeLength * 0.62, 8.5, 18.8);
    const innerStart = bridgeStart + outerLength * 0.48;
    const innerLength = Math.max(7.2, bridgeEnd - innerStart);`,
    `    const outerLength = clamp(bridgeLength * 0.62, 7.2, 18.8);
    const innerStart = bridgeStart + outerLength * 0.48;
    const innerLength = Math.max(6.2, bridgeEnd - innerStart);`,
    "static telescoping sections",
  );

  replaceRequired(
    `  group.userData.initialJetwayState = "attached-to-aircraft-door";
  group.userData.requiredPrePushSequence = "retract-bellows-clear-door-telescope-in-rotate-to-park";`,
    `  group.userData.initialJetwayState = "attached-to-aircraft-door";
  group.userData.requiredPrePushSequence = "retract-bellows-clear-door-telescope-in-rotate-to-park";
  group.userData.staticJetwayParkingAuthority = "${authority}";
  group.userData.staticJetwayParkedCount = jetways.length - 1;
  group.userData.staticJetwayParkedExtensionRangeMeters = Object.freeze([11.9, 13.85]);`,
    "static parking evidence",
  );
}

for (const token of [
  authority,
  "const parkedGateCode = [...jetway.g]",
  'const bridgeEnd = jetway.g === "A1"',
  "staticJetwayParkedCount = jetways.length - 1",
  "staticJetwayParkedExtensionRangeMeters = Object.freeze([11.9, 13.85])",
  "clamp(bridgeLength * 0.62, 7.2, 18.8)",
  "Math.max(6.2, bridgeEnd - innerStart)",
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: missing static parking v15 token ${token}`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared 57 unoccupied Terminal 4 jetways in varied retracted parking positions while preserving A1 attached training geometry.");
