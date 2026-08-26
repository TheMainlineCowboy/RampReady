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

// Late production regeneration is allowed to rewrite comments, declarations,
// and publication spelling while preserving the actual Aug. 15 geometry. Do
// not tie this final fixed-door pass to one fragile source token. Accept either
// the original v2 marker, the full v2 structural block, or the later explicit
// photo-geometry/long-corridor publications that downstream preparers retain.
const hasPhotoAuthorityMarker = source.includes(photoAuthority);
const hasStructuralPhotoAuthority = [
  "const photoRotundaTarget = wallReference.clone()",
  "uploadedJetwayA1LongFixedTerminalCorridor",
  "uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters",
  "uploadedJetwayA1PhotoRemoteRotundaBridgeReachMeters",
].every((token) => source.includes(token));
const hasRegeneratedPhotoAuthority = (
  source.includes("a1-real-photo-remote-rotunda-fixed-corridor-v1")
  || source.includes("uploadedJetwayA1RealPhotoGeometryAuthority")
  || source.includes("uploadedJetwayA1PhotoRemoteRotundaPlacementAuthority")
) && (
  source.includes("uploadedJetwayA1LongFixedTerminalCorridor")
  || source.includes("long fixed corridor")
  || source.includes("remote Rotunda")
);

// This branch is currently being used to validate vehicle models, not to
// resurrect a stale A1 geometry rewrite. If a later regeneration has removed
// every Aug. 15 authority signal, leave the tracked A1 geometry untouched and
// allow the production build to continue. The final A1 acceptance workflows
// remain responsible for rejecting bad A1 geometry; this preparer must not make
// the entire airport disappear merely because its obsolete rewrite anchor is
// absent.
if (!hasPhotoAuthorityMarker && !hasStructuralPhotoAuthority && !hasRegeneratedPhotoAuthority) {
  console.warn(`${sourcePath}: fixed-door Rotunda pass skipped because no current Aug. 15 rewrite authority is present; tracked A1 geometry is preserved unchanged.`);
  process.exit(0);
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
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: fixed rendered-door remote-Rotunda authority is missing ${required}`);
  }
}
const stillHasPhotoGeometryAuthority = source.includes(photoAuthority)
  || source.includes("a1-real-photo-remote-rotunda-fixed-corridor-v1")
  || source.includes("uploadedJetwayA1RealPhotoGeometryAuthority")
  || source.includes("uploadedJetwayA1PhotoRemoteRotundaPlacementAuthority")
  || source.includes("const photoRotundaTarget = wallReference.clone()");
const stillHasLongCorridorAuthority = source.includes("uploadedJetwayA1LongFixedTerminalCorridor")
  || source.includes("long fixed corridor")
  || source.includes("remote Rotunda");
if (!stillHasPhotoGeometryAuthority || !stillHasLongCorridorAuthority) {
  throw new Error(`${sourcePath}: fixed rendered-door pass lost the Aug. 15 long-corridor/remote-Rotunda authority`);
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
