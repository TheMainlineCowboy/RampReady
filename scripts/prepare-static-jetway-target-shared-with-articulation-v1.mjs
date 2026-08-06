import fs from "node:fs";

const path = "src/environment/staticJetwayPortalClosures.js";
let source = fs.readFileSync(path, "utf8");

const TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const marker = "static-cab-target-shared-with-articulation-v1";

const fallbackBlock = `    const gateCode = [...String(placement.gate)].reduce((value, character) => value + character.charCodeAt(0), 0);
    const bridgeEnd = Number(placement.bridgeEnd ?? (11.9 + (gateCode % 4) * 0.65));
    if (!Number.isFinite(placement.bridgeEnd)) targetFallbackCount += 1;`;
const exactBlock = `    // ${marker}
    const bridgeEnd = Number(placement.bridgeEnd);
    if (!Number.isFinite(bridgeEnd)) {
      throw new Error(\`Static Cab closure \${placement.gate} is missing the exact placement.bridgeEnd shared with articulation\`);
    }`;

if (source.includes(fallbackBlock)) {
  source = source.replace(fallbackBlock, exactBlock);
} else if (!source.includes(marker)) {
  throw new Error(`${path}: static Cab bridgeEnd fallback block is missing`);
}

source = source.replaceAll(
  'fleet.userData.uploadedJetwayStaticCabTargetAuthority = "placement-bridgeEnd-shared-with-static-articulation-v1";',
  `fleet.userData.uploadedJetwayStaticCabTargetAuthority = "${TARGET_AUTHORITY}";`,
);
source = source.replaceAll(
  'targetAuthority: "placement-bridgeEnd-shared-with-static-articulation-v1",',
  `targetAuthority: "${TARGET_AUTHORITY}",`,
);

for (const token of [
  marker,
  "const bridgeEnd = Number(placement.bridgeEnd)",
  "missing the exact placement.bridgeEnd shared with articulation",
  `uploadedJetwayStaticCabTargetAuthority = "${TARGET_AUTHORITY}"`,
  `targetAuthority: "${TARGET_AUTHORITY}"`,
  "targetFallbackCount = 0",
]) {
  if (!source.includes(token)) {
    throw new Error(`${path}: shared static Cab target contract is missing ${token}`);
  }
}
for (const forbidden of [
  "placement.bridgeEnd ??",
  "targetFallbackCount += 1",
  "11.9 + (gateCode % 4) * 0.65",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${path}: static Cab target fallback remains: ${forbidden}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Required all 57 static Cab closures to use the exact placement.bridgeEnd already used by articulation, with zero fallback targets.");
