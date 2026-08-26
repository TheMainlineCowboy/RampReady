import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v4";
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

if (!hasPhotoAuthorityMarker && !hasStructuralPhotoAuthority && !hasRegeneratedPhotoAuthority) {
  throw new Error(`${sourcePath}: fixed rendered-door Rotunda pass cannot find the Aug. 15 long-corridor/remote-Rotunda authority`);
}

if (!source.includes(marker)) {
  // Late generation legitimately rewrites the raw target declarations, so do
  // not key final physical authority to those declarations. Rewrite the three
  // calculations that actually consume the aircraft endpoint instead. The raw
  // placement target may remain as provenance/diagnostic telemetry only.
  const calculationReplacements = [
    [
      "  const aircraftReference = new THREE.Vector3(rawTargetXForRotunda, 0, rawTargetZForRotunda);",
      `  // ${marker}\n  // ${fixedDoorAuthority}\n  // The fixed rendered CRJ forward-left door, not decoded placement.targetX/Z,\n  // owns the aircraft endpoint used by the Aug. 15 remote-Rotunda solve.\n  const aircraftReference = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ});`,
    ],
    [
      "  const photoBridgeTargetDistanceMeters = Math.hypot(rawTargetXForRotunda - fixedRotundaCenter.x, rawTargetZForRotunda - fixedRotundaCenter.z);",
      `  const photoBridgeTargetDistanceMeters = Math.hypot(${fixedRenderedDoorX} - fixedRotundaCenter.x, ${fixedRenderedDoorZ} - fixedRotundaCenter.z);`,
    ],
    [
      "  const targetPoint = new THREE.Vector3(rawTargetX, fixedRotundaCenter.y, rawTargetZ);",
      `  const targetPoint = new THREE.Vector3(${fixedRenderedDoorX}, fixedRotundaCenter.y, ${fixedRenderedDoorZ});`,
    ],
  ];

  for (const [before, after] of calculationReplacements) {
    if (source.includes(before)) {
      source = source.replace(before, after);
    } else if (!source.includes(after)) {
      throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find current generated calculation anchor: ${before}`);
    }
  }
}

for (const required of [
  marker,
  fixedDoorAuthority,
  `const aircraftReference = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ});`,
  `const photoBridgeTargetDistanceMeters = Math.hypot(${fixedRenderedDoorX} - fixedRotundaCenter.x, ${fixedRenderedDoorZ} - fixedRotundaCenter.z);`,
  `const targetPoint = new THREE.Vector3(${fixedRenderedDoorX}, fixedRotundaCenter.y, ${fixedRenderedDoorZ});`,
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

// Fail closed if the actual physical calculations ever retake decoded target
// authority. Raw placement-target declarations may survive only as provenance.
for (const forbidden of [
  "const aircraftReference = new THREE.Vector3(rawTargetXForRotunda, 0, rawTargetZForRotunda);",
  "const photoBridgeTargetDistanceMeters = Math.hypot(rawTargetXForRotunda - fixedRotundaCenter.x, rawTargetZForRotunda - fixedRotundaCenter.z);",
  "const targetPoint = new THREE.Vector3(rawTargetX, fixedRotundaCenter.y, rawTargetZ);",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: decoded parking target retook final A1 Rotunda/door placement: ${forbidden}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: Aug. 15 remote Rotunda now solves against the fixed rendered CRJ door without moving terminal or aircraft.`);
