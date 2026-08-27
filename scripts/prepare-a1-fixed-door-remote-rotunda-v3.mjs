import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-aug15-fixed-rendered-crj-door-rotunda-target-v8";
const photoAuthority = "a1-aug15-photo-genuinely-remote-rotunda-placement-v2";
const fixedDoorAuthority = "exact-authored-crj-forward-left-door-component-v1";
const finalWallDistanceAuthority = "a1-aug15-photo-final-16m-wall-remote-rotunda-v1";

const fixedRenderedDoorX = -1.2725916110988955;
const fixedRenderedDoorZ = 8.45173366527876;
const finalRotundaWallDistanceMeters = 16.0;

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

// Bind the upstream wall-to-aircraft solve to the exact rendered CRJ forward-left
// door. Decoded parking targets remain provenance only.
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

// Same-head rendered evidence on 7e5e4cb2 measured only 10.695824 m from the
// final round Rotunda to the live supplied Cab body with the intentional 18.0 m
// wall solve. The full-chain render still shows the Rotunda/main mass crowded over
// the CRJ nose while the movable tunnel remains visibly compressed. The geometry
// deficit to the unchanged >12 m attached-state minimum is about 1.30 m, so move
// the complete A1 parent a conservative 2.0 m terminal-side and re-solve the final
// photo Rotunda 16.0 m from the REAL Terminal 4 wall toward the fixed rendered
// door. Sixteen meters remains a genuinely long A1-only elevated fixed corridor,
// especially with the preserved Aug. 15 dogleg lateral offset, while returning
// roughly two meters of reach to the supplied telescoping body. This moves only
// the complete supplied A1 parent terminal-side; Terminal 4 and the CRJ remain
// fixed and all Airport_Jetway.glb child geometry remains untouched.
const finalPhotoTargetPattern = /  const photoRotundaTarget = wallReference\.clone\(\)\n    \.addScaledVector\(wallToAircraft, photoAlongMeters\)\n    \.addScaledVector\(wallSide, photoSideSign \* photoLateralMeters\);/;
const finalPhotoTargetReplacement = `  // ${finalWallDistanceAuthority}\n  const fixedDoorWallVector = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ})\n    .sub(wallReference)\n    .setY(0);\n  const fixedDoorWallSpanMeters = fixedDoorWallVector.length();\n  if (!(fixedDoorWallSpanMeters > ${finalRotundaWallDistanceMeters + 8})) {\n    throw new Error(\`A1 fixed-door wall span is too short for a genuinely remote Rotunda: \${fixedDoorWallSpanMeters}\`);\n  }\n  fixedDoorWallVector.normalize();\n  const fixedDoorWallSide = new THREE.Vector3(fixedDoorWallVector.z, 0, -fixedDoorWallVector.x).normalize();\n  const finalPhotoLateralMeters = Math.min(photoLateralMeters, ${finalRotundaWallDistanceMeters - 0.5});\n  const finalPhotoAlongMeters = Math.sqrt(Math.max(\n    1,\n    ${finalRotundaWallDistanceMeters} * ${finalRotundaWallDistanceMeters} - finalPhotoLateralMeters * finalPhotoLateralMeters,\n  ));\n  const photoRotundaTarget = wallReference.clone()\n    .addScaledVector(fixedDoorWallVector, finalPhotoAlongMeters)\n    .addScaledVector(fixedDoorWallSide, photoSideSign * finalPhotoLateralMeters);`;
if (!source.includes(finalWallDistanceAuthority)) {
  if (!finalPhotoTargetPattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find the final photoRotundaTarget solve`);
  }
  source = source.replace(finalPhotoTargetPattern, finalPhotoTargetReplacement);
}

// The published remaining movable-bridge reach must use the same physical door.
if (!source.includes(fixedPhotoBridgeDistance)) {
  const photoBridgeDistancePattern = /^\s*const\s+photoBridgeTargetDistanceMeters\s*=\s*Math\.hypot\([\s\S]{0,260}?\);/m;
  if (!photoBridgeDistancePattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find the photo bridge-distance calculation`);
  }
  source = source.replace(photoBridgeDistancePattern, fixedPhotoBridgeDistance);
}

// Bind the aircraft-side bridge heading/contact consumer to the identical fixed
// rendered door. This keeps the movable bridge and Rotunda solve in one frame.
if (!source.includes(fixedTargetPoint)) {
  const targetPointPattern = /^\s*const\s+targetPoint\s*=\s*new\s+THREE\.Vector3\([^\n;]*\);/m;
  if (!targetPointPattern.test(source)) {
    throw new Error(`${sourcePath}: fixed-door Rotunda pass cannot find regenerated targetPoint calculation`);
  }
  source = source.replace(targetPointPattern, fixedTargetPoint);
}

for (const required of [
  marker,
  fixedDoorAuthority,
  finalWallDistanceAuthority,
  fixedAircraftReference,
  fixedPhotoBridgeDistance,
  fixedTargetPoint,
  `const finalPhotoAlongMeters = Math.sqrt(Math.max(`,
  `const fixedDoorWallVector = new THREE.Vector3(${fixedRenderedDoorX}, 0, ${fixedRenderedDoorZ})`,
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
console.log(`Prepared ${marker}: final A1 remote Rotunda is solved from the real wall toward the fixed rendered CRJ door at ${finalRotundaWallDistanceMeters.toFixed(1)} m direct wall distance, while movable reach and bridge heading remain fixed-door authoritative.`);
