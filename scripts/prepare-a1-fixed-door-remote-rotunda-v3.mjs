import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v6";
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

const fixedAircraftReference = `  const aircraftReference = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ});`;
const fixedPhotoBridgeDistance = `  const photoBridgeTargetDistanceMeters = Math.hypot(${fixedRenderedDoorX} - fixedRotundaCenter.x, ${fixedRenderedDoorZ} - fixedRotundaCenter.z);`;
const fixedTargetPoint = `  const targetPoint = new THREE.Vector3(${fixedRenderedDoorX}, fixedRotundaCenter.y, ${fixedRenderedDoorZ});`;

// The remote-Rotunda position itself is solved from wallToAircraft, so changing
// only targetPoint can rotate a bridge toward the right door while leaving the
// Rotunda in the old aircraft-side location. Bind the upstream aircraftReference
// consumed by photoRotundaTarget to the same fixed rendered CRJ forward-left door.
if (!source.includes(fixedAircraftReference)) {
  const aircraftReferencePattern = /^\s*const\s+aircraftReference\s*=\s*new\s+THREE\.Vector3\([^\n;]*\);/m;
  if (!aircraftReferencePattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find the upstream aircraftReference used by the photo Rotunda solve`);
  }
  source = source.replace(
    aircraftReferencePattern,
    `  // ${marker}\n  // ${fixedDoorAuthority}\n  // The fixed rendered CRJ door owns the wall-to-aircraft vector that positions\n  // the remote Rotunda. Decoded parking targets remain provenance only.\n${fixedAircraftReference}`,
  );
}

// The published remaining movable-bridge reach must use that same physical door
// or the late acceptance/runtime can report a different reach than the Rotunda
// solver actually reserved.
if (!source.includes(fixedPhotoBridgeDistance)) {
  const photoBridgeDistancePattern = /^\s*const\s+photoBridgeTargetDistanceMeters\s*=\s*Math\.hypot\([\s\S]{0,260}?\);/m;
  if (!photoBridgeDistancePattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find the photo bridge-distance calculation`);
  }
  source = source.replace(
    photoBridgeDistancePattern,
    fixedPhotoBridgeDistance,
  );
}

// Bind the actual aircraft-side bridge heading/contact consumer to the identical
// fixed rendered door. This keeps the movable bridge and Rotunda solve in one
// physical frame without moving the terminal or aircraft.
if (!source.includes(fixedTargetPoint)) {
  const targetPointPattern = /^\s*const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*\);/m;
  if (!targetPointPattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find regenerated targetPoint calculation`);
  }
  source = source.replace(
    targetPointPattern,
    fixedTargetPoint,
  );
}

for (const required of [
  marker,
  fixedDoorAuthority,
  fixedAircraftReference,
  fixedPhotoBridgeDistance,
  fixedTargetPoint,
  "const wallToAircraft = aircraftReference.clone().sub(wallReference).setY(0);",
  "const photoRotundaTarget = wallReference.clone()",
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

// Fail closed if any physical Rotunda/bridge consumer retakes decoded parking
// target authority. Raw placement declarations may survive only as provenance.
for (const forbiddenPattern of [
  /const\s+aircraftReference\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
  /const\s+photoBridgeTargetDistanceMeters\s*=\s*Math\.hypot\([\s\S]{0,220}?(?:rawTarget|placement\.target)/,
  /const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
  /const\s+targetDirection\s*=\s*new\s+THREE\.Vector3\([^\n;]*(?:rawTarget|placement\.target)[^\n;]*\);/,
]) {
  if (forbiddenPattern.test(source)) {
    throw new Error(`${sourcePath}: decoded parking target retook final A1 Rotunda/door placement`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${marker}: Aug. 15 remote Rotunda position, remaining movable reach and bridge heading now all solve against the fixed rendered CRJ door without moving terminal or aircraft.`);
