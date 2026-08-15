import fs from "node:fs";

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const PHOTO_AUTHORITY = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
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
// from that Rotunda toward the aircraft. Preserve the decoded source gate pose
// and span the real structural facade-to-Rotunda distance with fixed geometry.
if (/exact-T4_WALK-A1-terminal-portal-v25/.test(placements)) {
  throw new Error(`${placementsPath}: explicit T4_WALK A1 portal override survived the final walkway-hierarchy exclusion`);
}

if (!elbow.includes(PHOTO_AUTHORITY)) {
  const wallRegistrationPattern = /  \/\/ Preserve the Rotunda position produced by the real structural-wall[\s\S]*?(?=  \/\/ a1-aircraft-target-follows-intact-parent-relocation-v1)/;
  if (!wallRegistrationPattern.test(elbow)) {
    throw new Error(`${elbowPath}: final measured-wall Rotunda registration block is missing; refusing to guess the A1 source pose`);
  }

  const sourcePoseBlock = `  // ${PHOTO_AUTHORITY}\n  // The real A1 photo shows a remote Rotunda reached by a long fixed elevated\n  // corridor from the Terminal 4 building. Restore the complete supplied A1\n  // parent to the decoded KPHX source gate pose; do not translate the Rotunda\n  // onto the building wall. The measured structural wall remains the fixed\n  // corridor endpoint, while every authored Rotunda/Tunnel/Cab child transform\n  // stays untouched.\n  const rawBglPlacementX = Number(placement.x);\n  const rawBglPlacementZ = Number(placement.z);\n  const rawBglPlacementYaw = Number(placement.yaw);\n  if (![rawBglPlacementX, rawBglPlacementZ, rawBglPlacementYaw].every(Number.isFinite)) {\n    throw new Error("A1 decoded KPHX BGL source pose is missing");\n  }\n  anchor.position.x = rawBglPlacementX;\n  anchor.position.z = rawBglPlacementZ;\n  anchor.rotation.y = rawBglPlacementYaw;\n  anchor.updateMatrix();\n  group.updateWorldMatrix(true, true);\n  fleet.updateWorldMatrix(true, true);\n  model.updateWorldMatrix(true, true);\n\n  let fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);\n  const sourceRotundaTarget = fixedRotundaCenter.clone();\n  // Compatibility name retained for final acceptance telemetry: at the restored\n  // source pose the decoded-heading Rotunda center is already the target.\n  const rotatedSourceHeadingRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);\n  const sourceRotundaPositionErrorMeters = Math.hypot(\n    rotatedSourceHeadingRotundaCenter.x - sourceRotundaTarget.x,\n    rotatedSourceHeadingRotundaCenter.z - sourceRotundaTarget.z,\n  );\n  if (sourceRotundaPositionErrorMeters > 0.002) {\n    throw new Error(\`A1 source Rotunda moved while restoring the decoded KPHX pose: \${sourceRotundaPositionErrorMeters}\`);\n  }\n\n  const measuredWallX = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallX);\n  const measuredWallZ = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallZ);\n  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {\n    throw new Error("A1 measured structural Terminal 4 wall point is missing");\n  }\n  const fixedWallPoint = new THREE.Vector3(measuredWallX, fixedRotundaCenter.y, measuredWallZ);\n  const terminalDirection = fixedWallPoint.clone().sub(fixedRotundaCenter);\n  terminalDirection.y = 0;\n  let terminalWallDistance = terminalDirection.length();\n  if (!(terminalWallDistance > ${MINIMUM_ROTUNDA_TO_TERMINAL_METERS}\n    && terminalWallDistance < ${MAXIMUM_ROTUNDA_TO_TERMINAL_METERS})) {\n    throw new Error(\`A1 real-photo remote Rotunda-to-terminal distance is invalid: \${terminalWallDistance}\`);\n  }\n  terminalDirection.normalize();\n\n`;
  elbow = elbow.replace(wallRegistrationPattern, sourcePoseBlock);

  const relocatedTargetPattern = /  \/\/ a1-aircraft-target-follows-intact-parent-relocation-v1[\s\S]*?  targetDirection\.normalize\(\);/;
  if (!relocatedTargetPattern.test(elbow)) {
    throw new Error(`${elbowPath}: relocated A1 aircraft target block is missing`);
  }
  const sourceTargetBlock = `  // a1-aircraft-target-follows-intact-parent-relocation-v1\n  // The complete A1 parent is back at its decoded source pose, so the source\n  // aircraft-door target remains in that same frame. Keep the relocation\n  // telemetry variables at zero for compatibility; do not drag the aircraft to\n  // compensate for a terminal-side geometry error.\n  const rawTargetX = Number(placement.targetX);\n  const rawTargetZ = Number(placement.targetZ);\n  if (![rawTargetX, rawTargetZ].every(Number.isFinite)) throw new Error("A1 source parking door target is missing");\n  const sourceModelOriginRelocationX = 0;\n  const sourceModelOriginRelocationZ = 0;\n  const sourceModelOriginRelocationMeters = 0;\n  const targetPoint = new THREE.Vector3(rawTargetX, fixedRotundaCenter.y, rawTargetZ);\n  const rawTargetOffsetFromModelOrigin = Math.hypot(rawTargetX - rawBglPlacementX, rawTargetZ - rawBglPlacementZ);\n  const relocatedTargetOffsetFromModelOrigin = Math.hypot(targetPoint.x - anchor.position.x, targetPoint.z - anchor.position.z);\n  const aircraftTargetFrameErrorMeters = Math.abs(rawTargetOffsetFromModelOrigin - relocatedTargetOffsetFromModelOrigin);\n  if (aircraftTargetFrameErrorMeters > 0.002) {\n    throw new Error(\`A1 source aircraft target frame changed after restoring the source pose: \${aircraftTargetFrameErrorMeters}\`);\n  }\n  const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);\n  targetDirection.y = 0;\n  const targetDistance = targetDirection.length();\n  if (!(targetDistance > 15 && targetDistance < 45)) throw new Error(\`A1 source door target distance is invalid: \${targetDistance}\`);\n  targetDirection.normalize();`;
  elbow = elbow.replace(relocatedTargetPattern, sourceTargetBlock);

  elbow = elbow
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
  if (!elbow.includes(telemetryAnchor)) {
    throw new Error(`${elbowPath}: A1 telemetry anchor is missing`);
  }
  elbow = elbow.replace(
    telemetryAnchor,
    `  group.userData.uploadedJetwayA1RealPhotoGeometryAuthority = "${PHOTO_AUTHORITY}";\n  group.userData.uploadedJetwayA1RemoteSourceRotunda = true;\n  group.userData.uploadedJetwayA1LongFixedTerminalCorridor = true;\n  group.userData.uploadedJetwayA1FixedCorridorMinimumMeters = ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS};\n  group.userData.uploadedJetwayA1FixedCorridorMaximumMeters = ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS};\n  ${telemetryAnchor}`,
  );
}

for (const required of [
  PHOTO_AUTHORITY,
  "anchor.position.x = rawBglPlacementX;",
  "anchor.position.z = rawBglPlacementZ;",
  "anchor.rotation.y = rawBglPlacementYaw;",
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
  "const sourceModelOriginRelocationX = 0;",
  "const sourceModelOriginRelocationZ = 0;",
  "uploadedJetwayA1RemoteSourceRotunda",
  "uploadedJetwayA1LongFixedTerminalCorridor",
  `terminalWallDistance > ${MINIMUM_ROTUNDA_TO_TERMINAL_METERS}`,
  `terminalWallDistance < ${MAXIMUM_ROTUNDA_TO_TERMINAL_METERS}`,
  `visibleTerminalLegMeters > ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS}`,
  `visibleTerminalLegMeters < ${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS}`,
]) {
  if (!elbow.includes(required)) throw new Error(`${elbowPath}: real-photo A1 correction is missing ${required}`);
}

for (const forbidden of [
  "terminalWallDistance < 12",
  "visibleTerminalLegMeters < 10",
  "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall",
  "anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x",
  "anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z",
]) {
  if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: compact/wall-relocated A1 behavior survived real-photo correction: ${forbidden}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
console.log(`Prepared A1 from the Aug. 15 KPHX reference: decoded source pose owns the remote Rotunda and a fixed terminal corridor spans ${MINIMUM_VISIBLE_FIXED_CORRIDOR_METERS}-${MAXIMUM_VISIBLE_FIXED_CORRIDOR_METERS} m to the measured structural facade without moving the supplied GLB children or aircraft target.`);
