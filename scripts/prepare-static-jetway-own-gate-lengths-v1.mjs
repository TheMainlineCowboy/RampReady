import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
const compactLengthMarker = "static-a3plus-photo-compact-gate-specific-bridge-end-v1";
let source = fs.readFileSync(path, "utf8");

const randomLengthBlock = `    const exactBridgeEnd = jetway.g === "A1"
      ? bridgeEnd
      : 11.9 + (exactUploadedGateCode % 4) * 0.65;`;
const decodedSourceLengthBlock = "    const exactBridgeEnd = bridgeEnd;";
const photoCompactLengthBlock = `    const exactBridgeEnd = jetway.g === "A1"
      ? bridgeEnd
      // ${compactLengthMarker}
      : 8.2 + (exactUploadedGateCode % 5) * 0.45;`;

// This is intentionally a FINAL length-authority pass, not a source-distance
// restoration pass. The decoded AIR_Jetway01 bridgeEnd remains useful source
// provenance and A1 still uses it, but Aug. 15 visual authority requires A3+
// to remain short/direct. A later production stage must therefore never replace
// the already-derived compact A3+ target with decoded connected/full reach.
if (source.includes(photoCompactLengthBlock)) {
  // Already authoritative and idempotent.
} else if (source.includes(randomLengthBlock)) {
  source = source.replace(randomLengthBlock, photoCompactLengthBlock);
} else if (source.includes(decodedSourceLengthBlock)) {
  source = source.replace(decodedSourceLengthBlock, photoCompactLengthBlock);
} else {
  throw new Error(`${path}: final static A3+ photo-compact length authority anchor is missing`);
}

for (const forbidden of [
  "11.9 + (exactUploadedGateCode % 4) * 0.65",
  "11.9 + (exactUploadedGateCode%4)*0.65",
  decodedSourceLengthBlock,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${path}: stale static jetway length authority survived: ${forbidden}`);
  }
}
for (const required of [
  compactLengthMarker,
  'const exactBridgeEnd = jetway.g === "A1"',
  ': 8.2 + (exactUploadedGateCode % 5) * 0.45;',
  "aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "bridgeEnd: exactBridgeEnd",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final photo-compact static jetway length wiring is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Preserved final A3+ photo-compact 8.2-10.0 m inward telescope targets through the late own-gate length stage; decoded source bridge distance remains provenance/A1 authority and can no longer re-extend the 57 static bridges to connected maximum reach.");
