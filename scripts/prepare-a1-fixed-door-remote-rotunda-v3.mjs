import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v5";
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
  || source.includes("A1 fixed-wall Rotunda elbow")
) && (
  source.includes("uploadedJetwayA1LongFixedTerminalCorridor")
  || source.includes("long fixed corridor")
  || source.includes("remote Rotunda")
  || source.includes("fixed-wall Rotunda")
);

if (!hasPhotoAuthorityMarker && !hasStructuralPhotoAuthority && !hasRegeneratedPhotoAuthority) {
  throw new Error(`${sourcePath}: fixed rendered-door Rotunda pass cannot find the Aug. 15 long-corridor/remote-Rotunda authority`);
}

const fixedTargetPoint = `  const targetPoint = new THREE.Vector3(${fixedRenderedDoorX}, fixedRotundaCenter.y, ${fixedRenderedDoorZ});`;

if (!source.includes(fixedTargetPoint)) {
  // The current regenerated v3 elbow computes targetDistance and bridge heading
  // from targetPoint directly; older intermediate aircraftReference and
  // photoBridgeTargetDistanceMeters declarations are no longer guaranteed to
  // exist. Bind the actual physical endpoint consumed by targetDirection.
  const targetPointPattern = /^\s*const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*\);/m;
  if (!targetPointPattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find regenerated targetPoint calculation`);
  }
  source = source.replace(
    targetPointPattern,
    `  // ${marker}\n  // ${fixedDoorAuthority}\n  // The fixed rendered CRJ forward-left door, not decoded placement.targetX/Z,\n  // owns the aircraft endpoint used by the Aug. 15 remote-Rotunda bridge heading.\n${fixedTargetPoint}`,
  );
}

for (const required of [
  marker,
  fixedDoorAuthority,
  fixedTargetPoint,
  "const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: fixed rendered-door remote-Rotunda authority is missing ${required}`);
  }
}

const stillHasPhotoGeometryAuthority = source.includes(photoAuthority)
  || source.includes("a1-real-photo-remote-rotunda-fixed-corridor-v1")
  || source.includes("uploadedJetwayA1RealPhotoGeometryAuthority")
  || source.includes("uploadedJetwayA1PhotoRemoteRotundaPlacementAuthority")
  || source.includes("const photoRotundaTarget = wallReference.clone()")
  || source.includes("A1 fixed-wall Rotunda elbow");
const stillHasLongCorridorAuthority = source.includes("uploadedJetwayA1LongFixedTerminalCorridor")
  || source.includes("long fixed corridor")
  || source.includes("remote Rotunda")
  || source.includes("fixed-wall Rotunda");
if (!stillHasPhotoGeometryAuthority || !stillHasLongCorridorAuthority) {
  throw new Error(`${sourcePath}: fixed rendered-door pass lost the Aug. 15 long-corridor/remote-Rotunda authority`);
}

// Fail closed if the final physical target consumed by targetDirection retakes
// decoded parking-target authority. Raw placement declarations may survive only
// as provenance elsewhere in the module.
for (const forbiddenPattern of [
  /const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
  /const\s+targetDirection\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error(`${sourcePath}: decoded parking target retook final A1 Rotunda/door placement`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: Aug. 15 remote Rotunda bridge heading now solves against the fixed rendered CRJ door without moving terminal or aircraft.`);
