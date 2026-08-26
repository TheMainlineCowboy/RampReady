import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v3";
const photoAuthority = "a1-aug15-photo-genuinely-remote-rotunda-placement-v2";
const fixedDoorAuthority = "exact-authored-crj-forward-left-door-component-v1";

// These values are not a new aircraft placement. They are the world-space
// transform of the already-fixed CRJ A1 pose used by the final runtime:
// aircraft [0, -0.002196, 6.2], yaw 0.008570, authored door local
// [-1.291842, 2.769294, 2.240745]. They evaluate to the exact rendered door
// X/Z that the browser publishes on the current runtime.
const fixedRenderedDoorX = -1.2725916110988955;
const fixedRenderedDoorZ = 8.45173366527876;

let source = fs.readFileSync(sourcePath, "utf8");

// Late production regeneration is allowed to rewrite comments/authority marker
// placement while preserving the actual Aug. 15 geometry. Do not require one
// fragile literal marker if the structural remote-Rotunda contract is still
// present. Conversely, fail closed if neither the marker nor the geometry that
// it is supposed to represent survives.
const hasPhotoAuthorityMarker = source.includes(photoAuthority);
const hasStructuralPhotoAuthority = [
  "const photoRotundaTarget = wallReference.clone()",
  "uploadedJetwayA1LongFixedTerminalCorridor = true",
  "uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters",
  "uploadedJetwayA1PhotoRemoteRotundaBridgeReachMeters",
].every((token) => source.includes(token));
if (!hasPhotoAuthorityMarker && !hasStructuralPhotoAuthority) {
  throw new Error(`${sourcePath}: Aug. 15 long-corridor/remote-Rotunda authority must run before fixed-door Rotunda registration`);
}

if (!source.includes(marker)) {
  const replacements = [
    [
      "  const rawTargetXForRotunda = Number(placement.targetX);",
      `  // ${marker}\n  // ${fixedDoorAuthority}\n  // The Aug. 15 Rotunda solve must use the same fixed rendered CRJ door that\n  // owns final attached-state acceptance. placement.targetX/Z is decoded source\n  // parking provenance and is not the rendered forward-door world position.\n  const rawTargetXForRotunda = ${fixedRenderedDoorX};`,
    ],
    [
      "  const rawTargetZForRotunda = Number(placement.targetZ);",
      `  const rawTargetZForRotunda = ${fixedRenderedDoorZ};`,
    ],
    [
      "  const rawTargetX = Number(placement.targetX);",
      `  const rawTargetX = ${fixedRenderedDoorX};`,
    ],
    [
      "  const rawTargetZ = Number(placement.targetZ);",
      `  const rawTargetZ = ${fixedRenderedDoorZ};`,
    ],
  ];
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`${sourcePath}: fixed-door Rotunda replacement anchor is missing: ${before}`);
    }
    source = source.replace(before, after);
  }
}

for (const required of [
  marker,
  fixedDoorAuthority,
  `const rawTargetXForRotunda = ${fixedRenderedDoorX};`,
  `const rawTargetZForRotunda = ${fixedRenderedDoorZ};`,
  `const rawTargetX = ${fixedRenderedDoorX};`,
  `const rawTargetZ = ${fixedRenderedDoorZ};`,
  "const photoRotundaTarget = wallReference.clone()",
  "uploadedJetwayA1LongFixedTerminalCorridor = true",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: fixed rendered-door remote-Rotunda authority is missing ${required}`);
  }
}
for (const forbidden of [
  "const rawTargetXForRotunda = Number(placement.targetX);",
  "const rawTargetZForRotunda = Number(placement.targetZ);",
  "const rawTargetX = Number(placement.targetX);",
  "const rawTargetZ = Number(placement.targetZ);",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: stale decoded parking target still owns final A1 Rotunda/door placement: ${forbidden}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: A1 remote Rotunda now solves from the real Terminal 4 facade toward the already-fixed rendered CRJ door [${fixedRenderedDoorX.toFixed(6)}, ${fixedRenderedDoorZ.toFixed(6)}], preserving the long fixed corridor/dogleg and exact supplied movable jetway while leaving both terminal and aircraft unmoved.`);
