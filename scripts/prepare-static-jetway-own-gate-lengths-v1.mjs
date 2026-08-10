import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

const randomLengthBlock = `    const exactBridgeEnd = jetway.g === "A1"
      ? bridgeEnd
      : 11.9 + (exactUploadedGateCode % 4) * 0.65;`;
const ownGateLengthBlock = `    // The replacement GLB must use the decoded gate geometry that already drove
    // the source AIR_Jetway01 bridge. The former 11.9-13.85 m gate-code formula
    // was arbitrary and made all 57 static replacement jetways unrelated to
    // their actual stands. Keep the real per-gate bridgeEnd; the exact GLB may
    // telescope inward to this value but may never stretch its sibling parts
    // outward and open gaps.
    const exactBridgeEnd = bridgeEnd;`;

if (source.includes(randomLengthBlock)) {
  source = source.replace(randomLengthBlock, ownGateLengthBlock);
} else if (!source.includes("const exactBridgeEnd = bridgeEnd;")) {
  throw new Error(`${path}: static exact-jetway per-gate length anchor is missing`);
}

for (const forbidden of [
  "11.9 + (exactUploadedGateCode % 4) * 0.65",
  "11.9 + (exactUploadedGateCode%4)*0.65",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${path}: arbitrary static jetway length formula survived: ${forbidden}`);
  }
}
for (const required of [
  "const exactBridgeEnd = bridgeEnd;",
  "aircraftContactClearanceMeters: AIR_JETWAY01_CONTACT_CLEARANCE_METERS",
  "bridgeEnd: exactBridgeEnd",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: own-gate static jetway length wiring is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Replaced the arbitrary gate-code static jetway lengths with each gate's decoded source bridge distance; exact replacement bridges may telescope inward from their supplied connected maximum, never stretch outward.");
