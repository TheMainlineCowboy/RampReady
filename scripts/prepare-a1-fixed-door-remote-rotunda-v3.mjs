import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v3";
const photoAuthority = "a1-aug15-photo-genuinely-remote-rotunda-placement-v2";
const fixedDoorAuthority = "exact-authored-crj-forward-left-door-component-v1";

const fixedRenderedDoorX = -1.2725916110988955;
const fixedRenderedDoorZ = 8.45173366527876;

let source = fs.readFileSync(sourcePath, "utf8");

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

// This pass is a legacy A1 rewrite. It must never prevent the complete airport
// from building merely because later source generation has already replaced its
// old text anchors. In that case preserve the current tracked A1 geometry and
// let the dedicated A1 acceptance suites judge it separately.
if (!hasPhotoAuthorityMarker && !hasStructuralPhotoAuthority && !hasRegeneratedPhotoAuthority) {
  console.warn(`${sourcePath}: fixed-door Rotunda pass skipped; no current Aug. 15 rewrite authority is present.`);
  process.exit(0);
}

if (!source.includes(marker)) {
  const replacements = [
    [
      "  const rawTargetXForRotunda = Number(placement.targetX);",
      `  // ${marker}\n  // ${fixedDoorAuthority}\n  const rawTargetXForRotunda = ${fixedRenderedDoorX};`,
    ],
    ["  const rawTargetZForRotunda = Number(placement.targetZ);", `  const rawTargetZForRotunda = ${fixedRenderedDoorZ};`],
    ["  const rawTargetX = Number(placement.targetX);", `  const rawTargetX = ${fixedRenderedDoorX};`],
    ["  const rawTargetZ = Number(placement.targetZ);", `  const rawTargetZ = ${fixedRenderedDoorZ};`],
  ];

  // If late regeneration has already changed any of these old rewrite anchors,
  // do not partially rewrite the file. Preserve the current generated geometry.
  const missingAnchor = replacements.find(([before]) => !source.includes(before));
  if (missingAnchor) {
    console.warn(`${sourcePath}: fixed-door Rotunda pass skipped; legacy replacement anchor is no longer present: ${missingAnchor[0]}`);
    process.exit(0);
  }

  for (const [before, after] of replacements) source = source.replace(before, after);
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
console.log(`Prepared ${marker}: fixed rendered CRJ door target retained without moving terminal or aircraft.`);
