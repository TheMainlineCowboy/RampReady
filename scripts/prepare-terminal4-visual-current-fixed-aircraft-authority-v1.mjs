import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
const CURRENT_AUTHORITY = 'fixed-source-a1-parking-center-exact-authored-door-v2';
const marker = 'terminal4-visual-fixed-source-a1-parking-center-authority-v1';

let source = fs.readFileSync(path, 'utf8');
const authorityPattern = /const A1_FIXED_SOURCE_GATE_AUTHORITY = '[^']+';/;
if (!authorityPattern.test(source)) {
  throw new Error(`${path}: A1 fixed-source authority declaration is missing`);
}
source = source.replace(
  authorityPattern,
  `const A1_FIXED_SOURCE_GATE_AUTHORITY = '${CURRENT_AUTHORITY}';`,
);
if (!source.includes(marker)) {
  source = source.replace(
    `const A1_FIXED_SOURCE_GATE_AUTHORITY = '${CURRENT_AUTHORITY}';`,
    `// ${marker}\nconst A1_FIXED_SOURCE_GATE_AUTHORITY = '${CURRENT_AUTHORITY}';`,
  );
}
for (const required of [marker, CURRENT_AUTHORITY]) {
  if (!source.includes(required)) throw new Error(`${path}: current fixed-aircraft visual authority is missing ${required}`);
}
if (source.includes("const A1_FIXED_SOURCE_GATE_AUTHORITY = 'final-live-cab-mesh-visible-door-registration-v7';")) {
  throw new Error(`${path}: retired Cab-relocated aircraft authority survived visual normalization`);
}
fs.writeFileSync(path, source);
console.log(`Prepared ${marker}: Terminal 4 visual evidence now requires the decoded A1 stand-center aircraft authority and cannot reward moving the CRJ to the Cab.`);
