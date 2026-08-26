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
  // Late preparation legitimately rewrites declaration spelling and intermediate
  // variable names. Bind the three physical consumers of the aircraft endpoint
  // structurally instead of depending on one stale generated source string.
  const aircraftReferencePattern = /(^\s*const\s+aircraftReference\s*=\s*new\s+THREE\.Vector3\([^\n;]*\);)/m;
  const bridgeDistancePattern = /(^\s*const\s+photoBridgeTargetDistanceMeters\s*=\s*Math\.hypot\([^\n;]*fixedRotundaCenter\.x[^\n;]*fixedRotundaCenter\.z[^\n;]*\);)/m;
  const targetPointPattern = /(^\s*const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*fixedRotundaCenter\.y[^\n;]*\);)/m;

  const fixedAircraftReference = `  // ${marker}\n  // ${fixedDoorAuthority}\n  // The fixed rendered CRJ forward-left door, not decoded placement.targetX/Z,\n  // owns the aircraft endpoint used by the Aug. 15 remote-Rotunda solve.\n  const aircraftReference = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ});`;
  const fixedBridgeDistance = `  const photoBridgeTargetDistanceMeters = Math.hypot(${fixedRenderedDoorX} - fixedRotundaCenter.x, ${fixedRenderedDoorZ} - fixedRotundaCenter.z);`;
  const fixedTargetPoint = `  const targetPoint = new THREE.Vector3(${fixedRenderedDoorX}, fixedRotundaCenter.y, ${fixedRenderedDoorZ});`;

  for (const [pattern, replacement, label] of [
    [aircraftReferencePattern, fixedAircraftReference, "aircraftReference"],
    [bridgeDistancePattern, fixedBridgeDistance, "photoBridgeTargetDistanceMeters"],
    [targetPointPattern, fixedTargetPoint, "targetPoint"],
  ]) {
    if (pattern.test(source)) {
      source = source.replace(pattern, replacement);
    } else if (!source.includes(replacement)) {
      throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find regenerated ${label} calculation`);
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

// Fail closed if any final physical consumer retakes decoded placement-target
// authority. Raw placement declarations may survive only as provenance.
for (const forbiddenPattern of [
  /const\s+aircraftReference\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
  /const\s+photoBridgeTargetDistanceMeters\s*=\s*Math\.hypot\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
  /const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error(`${sourcePath}: decoded parking target retook final A1 Rotunda/door placement`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: Aug. 15 remote Rotunda now solves against the fixed rendered CRJ door without moving terminal or aircraft.`);
