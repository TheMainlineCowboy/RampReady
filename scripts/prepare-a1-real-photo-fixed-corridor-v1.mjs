import fs from "node:fs";

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const PHOTO_AUTHORITY = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const SOURCE_AXIS_AUTHORITY = "a1-intact-parent-source-axis-alignment-v1";
const MINIMUM_ROTUNDA_TO_TERMINAL_METERS = 6;
const MAXIMUM_ROTUNDA_TO_TERMINAL_METERS = 34;
const MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS = 3.5;
const MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS = 30;

let elbow = fs.readFileSync(elbowPath, "utf8");
const placements = fs.readFileSync(placementsPath, "utf8");

// The Aug. 15 KPHX A1/A3 reference makes the geometry unambiguous: A1's
// movable bridge does not begin at a Rotunda parked against the terminal wall.
// A1 has a long elevated fixed terminal-side passage and a visible turn before
// the remote Rotunda; the exact supplied movable Airport_Jetway.glb continues
// from that Rotunda toward the aircraft. Preserve the decoded source model
// origin, calibrate the replacement GLB's physical Rotunda->Tunnel-A axis to the
// decoded source heading, and span the real facade-to-Rotunda distance with
// fixed terminal geometry.
if (/exact-T4_WALK-A1-terminal-portal-v25/.test(placements)) {
  throw new Error(`${placementsPath}: explicit T4_WALK A1 portal override survived the final walkway-hierarchy exclusion`);
}

const realPhotoWallPattern = /  \/\/ a1-real-photo-remote-rotunda-fixed-corridor-v1[\s\S]*?(?=  \/\/ a1-aircraft-target-follows-intact-parent-relocation-v1)/;
const preparedWallPattern = /  \/\/ Preserve the Rotunda position produced by the real structural-wall[\s\S]*?(?=  \/\/ a1-aircraft-target-follows-intact-parent-relocation-v1)/;
const baselineWallPattern = /  const fixedRotundaCenter = objectCenterInFleet\(THREE, fleet, rotunda\);[\s\S]*?  fixedWallPoint\.y = fixedRotundaCenter\.y;\n/;
const wallPattern = realPhotoWallPattern.test(elbow)
  ? realPhotoWallPattern
  : (preparedWallPattern.test(elbow) ? preparedWallPattern : baselineWallPattern);
if (!wallPattern.test(elbow)) {
  throw new Error(`${elbowPath}: A1 wall/Rotunda registration block is missing; refusing to guess the real-photo source pose`);
}

const sourcePoseBlock = `  // ${PHOTO_AUTHORITY}\n  // The real A1 photo shows a remote Rotunda reached by a long fixed elevated\n  // corridor from the Terminal 4 building. Put the complete supplied A1 model\n  // origin back on the decoded KPHX source gate coordinate; do not translate\n  // the Rotunda onto the terminal wall. Because the replacement GLB's local +Z\n  // axis is not guaranteed to be its physical bridge axis, rotate the COMPLETE\n  // parent only by the measured Rotunda->Tunnel-A source-axis correction. No\n  // supplied child transform is changed.\n  const rawBglPlacementX = Number(placement.x);\n  const rawBglPlacementZ = Number(placement.z);\n  const rawBglPlacementYaw = Number(placement.yaw);\n  if (![rawBglPlacementX, rawBglPlacementZ, rawBglPlacementYaw].every(Number.isFinite)) {\n    throw new Error("A1 decoded KPHX BGL source pose is missing");\n  }\n  anchor.position.x = rawBglPlacementX;\n  anchor.position.z = rawBglPlacementZ;\n  anchor.rotation.y = Number(placement.yaw);\n  anchor.updateMatrix();\n  group.updateWorldMatrix(true, true);\n  fleet.updateWorldMatrix(true, true);\n  model.updateWorldMatrix(true, true);\n\n  // ${SOURCE_AXIS_AUTHORITY}\n  const decodedSourceBridgeDirection = new THREE.Vector3(\n    Math.sin(Number(placement.yaw)),\n    0,\n    Math.cos(Number(placement.yaw)),\n  ).normalize();\n  const sourceAxisRotundaBefore = objectCenterInFleet(THREE, fleet, rotunda);\n  const sourceAxisTunnelBefore = objectCenterInFleet(THREE, fleet, tunnelA);\n  const sourceAxisBridgeDirectionBefore = sourceAxisTunnelBefore.clone().sub(sourceAxisRotundaBefore).setY(0);\n  if (sourceAxisBridgeDirectionBefore.lengthSq() < 0.25) {\n    throw new Error("A1 supplied Rotunda-to-Tunnel-A source axis is degenerate");\n  }\n  sourceAxisBridgeDirectionBefore.normalize();\n  const sourceAxisCurrentHeading = Math.atan2(sourceAxisBridgeDirectionBefore.x, sourceAxisBridgeDirectionBefore.z);\n  const sourceAxisDesiredHeading = Math.atan2(decodedSourceBridgeDirection.x, decodedSourceBridgeDirection.z);\n  const sourceAxisYawDelta = wrappedAngle(THREE, sourceAxisDesiredHeading - sourceAxisCurrentHeading);\n  anchor.rotation.y += sourceAxisYawDelta;\n  anchor.updateMatrix();\n  group.updateWorldMatrix(true, true);\n  fleet.updateWorldMatrix(true, true);\n  model.updateWorldMatrix(true, true);\n\n  let fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);\n  const sourceRotundaTarget = fixedRotundaCenter.clone();\n  const rotatedSourceHeadingRotundaCenter = fixedRotundaCenter.clone();\n  const sourceAxisTunnelAfter = objectCenterInFleet(THREE, fleet, tunnelA);\n  const sourceAxisBridgeDirectionAfter = sourceAxisTunnelAfter.clone().sub(fixedRotundaCenter).setY(0);\n  if (sourceAxisBridgeDirectionAfter.lengthSq() < 0.25) {\n    throw new Error("A1 final supplied Rotunda-to-Tunnel-A source axis is degenerate");\n  }\n  sourceAxisBridgeDirectionAfter.normalize();\n  const sourceAxisAlignmentCosine = sourceAxisBridgeDirectionAfter.dot(decodedSourceBridgeDirection);\n  if (!(sourceAxisAlignmentCosine >= 0.999)) {\n    throw new Error(\`A1 complete-parent bridge axis does not match decoded KPHX heading: cosine=\${sourceAxisAlignmentCosine}; yawDelta=\${sourceAxisYawDelta}\`);\n  }\n  const sourceRotundaPositionErrorMeters = Math.hypot(\n    rotatedSourceHeadingRotundaCenter.x - sourceRotundaTarget.x,\n    rotatedSourceHeadingRotundaCenter.z - sourceRotundaTarget.z,\n  );\n  if (sourceRotundaPositionErrorMeters > 0.002) {\n    throw new Error(\`A1 source Rotunda moved while restoring the decoded KPHX pose: \${sourceRotundaPositionErrorMeters}\`);\n  }\n  group.userData.uploadedJetwayA1SourceAxisAlignmentAuthority = "${SOURCE_AXIS_AUTHORITY}";\n  group.userData.uploadedJetwayA1SourceAxisAlignmentCosine = sourceAxisAlignmentCosine;\n  group.userData.uploadedJetwayA1SourceAxisYawDeltaRadians = sourceAxisYawDelta;\n\n  const measuredWallX = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallX);\n  const measuredWallZ = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallZ);\n  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {\n    throw new Error("A1 measured structural Terminal 4 wall point is missing");\n  }\n  const fixedWallPoint = new THREE.Vector3(measuredWallX, fixedRotundaCenter.y, measuredWallZ);\n  const terminalDirection = fixedWallPoint.clone().sub(fixedRotundaCenter);\n  terminalDirection.y = 0;\n  let terminalWallDistance = terminalDirection.length();\n  if (!(terminalWallDistance > ${MINIMUM_ROTUNDA_TO_TERMINAL_METERS}\n    && terminalWallDistance < ${MAXIMUM_ROTUNDA_TO_TERMINAL_METERS})) {\n    throw new Error(\`A1 real-photo remote Rotunda-to-terminal distance is invalid: \${terminalWallDistance}\`);\n  }\n  terminalDirection.normalize();\n\n`;
elbow = elbow.replace(wallPattern, sourcePoseBlock);

const relocatedTargetPattern = /  \/\/ a1-aircraft-target-follows-intact-parent-relocation-v1[\s\S]*?  targetDirection\.normalize\(\);/;
const baselineTargetPattern = /  const targetPoint = new THREE\.Vector3\(Number\(placement\.targetX\), fixedRotundaCenter\.y, Number\(placement\.targetZ\)\);[\s\S]*?  targetDirection\.normalize\(\);/;
const targetPattern = relocatedTargetPattern.test(elbow) ? relocatedTargetPattern : baselineTargetPattern;
if (!targetPattern.test(elbow)) {
  throw new Error(`${elbowPath}: A1 aircraft target block is missing; refusing to move the aircraft to hide terminal geometry`);
}
const sourceTargetBlock = `  // a1-aircraft-target-follows-intact-parent-relocation-v1\n  // The complete A1 parent is back at its decoded source model origin, so the\n  // source aircraft-door target remains in that same world frame. Keep the old\n  // relocation telemetry variables at zero for compatibility; never drag the\n  // aircraft to compensate for a terminal-side geometry error.\n  const rawTargetX = Number(placement.targetX);\n  const rawTargetZ = Number(placement.targetZ);\n  if (![rawTargetX, rawTargetZ].every(Number.isFinite)) throw new Error("A1 source parking door target is missing");\n  const sourceModelOriginRelocationX = 0;\n  const sourceModelOriginRelocationZ = 0;\n  const sourceModelOriginRelocationMeters = 0;\n  const targetPoint = new THREE.Vector3(rawTargetX, fixedRotundaCenter.y, rawTargetZ);\n  const rawTargetOffsetFromModelOrigin = Math.hypot(rawTargetX - rawBglPlacementX, rawTargetZ - rawBglPlacementZ);\n  const relocatedTargetOffsetFromModelOrigin = Math.hypot(targetPoint.x - anchor.position.x, targetPoint.z - anchor.position.z);\n  const aircraftTargetFrameErrorMeters = Math.abs(rawTargetOffsetFromModelOrigin - relocatedTargetOffsetFromModelOrigin);\n  if (aircraftTargetFrameErrorMeters > 0.002) {\n    throw new Error(\`A1 source aircraft target frame changed after restoring the source pose: \${aircraftTargetFrameErrorMeters}\`);\n  }\n  const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);\n  targetDirection.y = 0;\n  const targetDistance = targetDirection.length();\n  if (!(targetDistance > 15 && targetDistance < 45)) throw new Error(\`A1 source door target distance is invalid: \${targetDistance}\`);\n  targetDirection.normalize();`;
elbow = elbow.replace(targetPattern, sourceTargetBlock);

elbow = elbow
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS};`)
  .replaceAll(
    'const CONNECTOR_STYLE_AUTHORITY = "preserved-measured-wall-to-intact-source-heading-rotunda-v6";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-remote-fixed-corridor-to-source-rotunda-v1";',
  )
  .replaceAll(
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v4-authored-rotunda-surface";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-remote-fixed-corridor-to-source-rotunda-v1";',
  )
  .replaceAll(
    'visibleTerminalLegMeters > 0.15 && visibleTerminalLegMeters < 10',
    `visibleTerminalLegMeters > ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS} && visibleTerminalLegMeters < ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS}`,
  )
  .replaceAll(
    'A1 measured wall-to-Rotunda fixed leg is invalid:',
    'A1 real-photo fixed terminal corridor length is invalid:',
  );

const telemetryAnchor = "  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;";
if (!elbow.includes("uploadedJetwayA1RealPhotoGeometryAuthority")) {
  if (!elbow.includes(telemetryAnchor)) throw new Error(`${elbowPath}: A1 telemetry anchor is missing`);
  elbow = elbow.replace(
    telemetryAnchor,
    `  group.userData.uploadedJetwayA1RealPhotoGeometryAuthority = "${PHOTO_AUTHORITY}";\n  group.userData.uploadedJetwayA1RemoteSourceRotunda = true;\n  group.userData.uploadedJetwayA1LongFixedTerminalCorridor = true;\n  group.userData.uploadedJetwayA1FixedCorridorMinimumMeters = ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS};\n  group.userData.uploadedJetwayA1FixedCorridorMaximumMeters = ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS};\n  ${telemetryAnchor}`,
  );
}

for (const required of [
  PHOTO_AUTHORITY,
  SOURCE_AXIS_AUTHORITY,
  "anchor.position.x = rawBglPlacementX;",
  "anchor.position.z = rawBglPlacementZ;",
  "anchor.rotation.y = Number(placement.yaw);",
  "anchor.rotation.y += sourceAxisYawDelta;",
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const rotatedSourceHeadingRotundaCenter = fixedRotundaCenter.clone();",
  "const sourceModelOriginRelocationX = 0;",
  "const sourceModelOriginRelocationZ = 0;",
  "uploadedJetwayA1RemoteSourceRotunda",
  "uploadedJetwayA1LongFixedTerminalCorridor",
  "uploadedJetwayA1SourceAxisAlignmentAuthority",
  `terminalWallDistance > ${MINIMUM_ROTUNDA_TO_TERMINAL_METERS}`,
  `terminalWallDistance < ${MAXIMUM_ROTUNDA_TO_TERMINAL_METERS}`,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS};`,
]) {
  if (!elbow.includes(required)) throw new Error(`${elbowPath}: real-photo A1 correction is missing ${required}`);
}

for (const forbidden of [
  "terminalWallDistance < 12",
  "visibleTerminalLegMeters < 10",
  "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall",
  "anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x",
  "anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z",
  "const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;",
]) {
  if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: compact/wall-relocated A1 behavior survived real-photo correction: ${forbidden}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
console.log(`Prepared A1 from the Aug. 15 KPHX reference: source model origin and calibrated bridge heading own the remote Rotunda, and a fixed terminal corridor spans ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS}-${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS} m to the measured structural facade without moving supplied children or the aircraft target.`);
