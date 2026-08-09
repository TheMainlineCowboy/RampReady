import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const GROUND_AUTHORITY = "all-58-exact-glb-authored-ground-offset-preserved-v2";
let source = fs.readFileSync(registrationPath, "utf8");

source = source.replace(
  'const GROUND_AUTHORITY = "a1-anchor-only-grounding-static-fleet-pavement-zero-v1";',
  `const GROUND_AUTHORITY = "${GROUND_AUTHORITY}";`,
);

const a1OnlyGroundingBlock = `  const inheritedFleetYOffset = Number(fleet.position.y);
  if (!Number.isFinite(inheritedFleetYOffset) || Math.abs(inheritedFleetYOffset) > 3) {
    throw new Error(\`Exact jetway fleet inherited an invalid vertical offset: \${inheritedFleetYOffset}\`);
  }
  a1Anchor.position.y += inheritedFleetYOffset;
  fleet.position.y = 0;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);`;

const wholeFleetGroundingBlock = `  const inheritedFleetYOffset = Number(fleet.position.y);
  if (!Number.isFinite(inheritedFleetYOffset) || Math.abs(inheritedFleetYOffset) > 3) {
    throw new Error(\`Exact jetway fleet inherited an invalid vertical offset: \${inheritedFleetYOffset}\`);
  }
  // The exact-model installation pass measures the authored tire-contact offset
  // once for the supplied GLB. Preserve that same parent Y on the complete fleet.
  // The retired implementation transferred the offset to A1 alone and reset the
  // 57 static instances to Y=0, visibly lifting their bogies/supports off the ramp.
  // Keeping the correction on the shared fleet parent grounds every rigid source
  // assembly without changing a single supplied child transform.
  if (Math.abs(inheritedFleetYOffset) < 0.001) {
    throw new Error(\`Exact jetway fleet lost its measured authored ground offset before static registration: \${inheritedFleetYOffset}\`);
  }
  group.userData.uploadedJetwayWholeFleetGroundOffsetMeters = inheritedFleetYOffset;
  group.userData.uploadedJetwayWholeFleetGroundAuthority = GROUND_AUTHORITY;
  group.userData.uploadedJetwayStaticGroundedGateCount = 57;
  group.userData.uploadedJetwayA1GroundedGateCount = 1;
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);`;

if (source.includes(a1OnlyGroundingBlock)) {
  source = source.replace(a1OnlyGroundingBlock, wholeFleetGroundingBlock);
} else if (!source.includes("uploadedJetwayWholeFleetGroundOffsetMeters")) {
  throw new Error(`${registrationPath}: retired A1-only grounding block is missing`);
}

for (const required of [
  `const GROUND_AUTHORITY = "${GROUND_AUTHORITY}";`,
  "uploadedJetwayWholeFleetGroundOffsetMeters",
  "uploadedJetwayStaticGroundedGateCount = 57",
  "uploadedJetwayA1GroundedGateCount = 1",
]) {
  if (!source.includes(required)) throw new Error(`${registrationPath}: whole-fleet grounding is missing ${required}`);
}
for (const forbidden of [
  "a1Anchor.position.y += inheritedFleetYOffset;",
  "fleet.position.y = 0;",
  "a1-anchor-only-grounding-static-fleet-pavement-zero-v1",
]) {
  if (source.includes(forbidden)) throw new Error(`${registrationPath}: A1-only/static-floating grounding survived: ${forbidden}`);
}

fs.writeFileSync(registrationPath, source, "utf8");
console.log(`Preserved the exact supplied jetway authored ground-contact parent offset on A1 and all 57 static Terminal 4 bridges instead of lifting the static fleet back to pavement-zero (${GROUND_AUTHORITY}).`);
