import fs from "node:fs";

const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";
const WALL_AUTHORITY = "a1-source-rotunda-to-measured-real-terminal-wall-v1";

let placements = fs.readFileSync(placementsPath, "utf8");

// The airport source owns the physical bridge pose. A1 used to be the one
// exception that kept a synthetic aircraft-door yaw while the other 57 gates
// used the decoded BGL heading. Patch that exception idempotently: the second
// production preparation must validate the already-source-owned result instead
// of expecting the retired source text to reappear.
placements = placements.replace(
  '      yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw,',
  '      yaw: sourceJetwayYaw,',
);
placements = placements.replace(
  '      sourceHeadingAuthority: jetway.g === "A1" ? "a1-photo-registered-animated-exception" : "57-static-bgl-jetway-heading-preserved-v2",',
  '      sourceHeadingAuthority: jetway.g === "A1" ? "a1-decoded-kphx-bgl-heading-preserved-v1" : "57-static-bgl-jetway-heading-preserved-v2",',
);
if (!placements.includes('yaw: sourceJetwayYaw,')) {
  throw new Error(`${placementsPath}: A1 source-yaw ownership could not be installed`);
}
if (placements.includes('yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw')) {
  throw new Error(`${placementsPath}: synthetic A1 aircraft-door yaw still owns the placement`);
}
fs.writeFileSync(placementsPath, placements, "utf8");

let elbow = fs.readFileSync(elbowPath, "utf8");

const alreadySourceOwned = [
  AUTHORITY,
  WALL_AUTHORITY,
  'const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)',
  'anchor.rotation.y = Number(placement.yaw)',
  'uploadedJetwayA1MeasuredTerminalWallX',
  'uploadedJetwayA1SourceRotundaPositionErrorMeters',
  'const yawDelta = 0;',
  'const targetAlignmentCosine = bridgeDirection.dot(targetDirection);',
].every((token) => elbow.includes(token))
  && !elbow.includes('anchor.rotation.y += yawDelta;')
  && !elbow.includes('A1 supplied bridge does not point at the source A1 door target')
  && !elbow.includes('UploadedAirportJetwayA1AircraftSidePivot')
  && !elbow.includes('bridgePivot.attach(root)');

if (!alreadySourceOwned) {
  elbow = elbow
    .replace(
      'const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "photo-registered-a1-fixed-wall-rotunda-source-door-target-elbow-v3";',
      `const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "${AUTHORITY}";`,
    )
    .replace(
      'const TARGET_DIRECTION_AUTHORITY = "source-a1-door-target-owns-aircraft-side-bridge-heading-v1";',
      'const TARGET_DIRECTION_AUTHORITY = "decoded-kphx-bgl-heading-owns-a1-bridge-aircraft-must-conform-v1";',
    )
    .replace(
      'const CONNECTOR_AUTHORITY = "real-terminal-fixed-rotunda-independent-aircraft-side-elbow-v3";',
      `const CONNECTOR_AUTHORITY = "${WALL_AUTHORITY}";`,
    )
    .replace(
      'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v4-authored-rotunda-surface";',
      'const CONNECTOR_STYLE_AUTHORITY = "source-measured-real-wall-to-source-rotunda-solid-terminal-leg-v5";',
    );

  const fixedWallBlockPattern = /  const fixedRotundaCenter = objectCenterInFleet\(THREE, fleet, rotunda\);[\s\S]*?  fixedWallPoint\.y = fixedRotundaCenter\.y;\n/;
  const fixedWallReplacement = `  // Restore the exact A1 Rotunda to the decoded KPHX BGL gate coordinate before
  // doing any terminal or aircraft fit. Earlier production stages intentionally
  // moved the whole supplied parent to manufacture a 2.4 m vestibule; undo that
  // displacement here so the airport source, not a cosmetic target length,
  // owns the physical jetway location.
  let fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceRotundaTarget = new THREE.Vector3(Number(placement.x), fixedRotundaCenter.y, Number(placement.z));
  if (![sourceRotundaTarget.x, sourceRotundaTarget.z].every(Number.isFinite)) {
    throw new Error("A1 decoded KPHX BGL Rotunda position is missing");
  }
  anchor.position.x += sourceRotundaTarget.x - fixedRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - fixedRotundaCenter.z;
  anchor.rotation.y = Number(placement.yaw);
  if (!Number.isFinite(anchor.rotation.y)) throw new Error("A1 decoded KPHX BGL heading is missing");
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  // Rotunda geometry is not guaranteed to be centered exactly on the source
  // node origin. Re-center once after the source yaw is applied, without
  // changing any supplied child transform.
  fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  anchor.position.x += sourceRotundaTarget.x - fixedRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - fixedRotundaCenter.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceRotundaPositionErrorMeters = Math.hypot(
    fixedRotundaCenter.x - sourceRotundaTarget.x,
    fixedRotundaCenter.z - sourceRotundaTarget.z,
  );
  if (sourceRotundaPositionErrorMeters > 0.002) {
    throw new Error(\`A1 decoded source Rotunda could not be restored: \${sourceRotundaPositionErrorMeters}\`);
  }

  // The installation pass measured the real ramp-level Terminal 4 structural
  // wall *before* relocating A1. Reuse that real wall point. Do not recompute a
  // fake wall from the relocated Rotunda and do not target T4_WALK.
  const measuredWallX = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallX);
  const measuredWallZ = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallZ);
  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {
    throw new Error("A1 pre-relocation measured structural wall point is missing");
  }
  const fixedWallPoint = new THREE.Vector3(measuredWallX, fixedRotundaCenter.y, measuredWallZ);
  const terminalDirection = fixedWallPoint.clone().sub(fixedRotundaCenter);
  terminalDirection.y = 0;
  const terminalWallDistance = terminalDirection.length();
  if (!(terminalWallDistance > 0.5 && terminalWallDistance < 44)) {
    throw new Error(\`A1 source Rotunda-to-real-wall distance is invalid: \${terminalWallDistance}\`);
  }
  terminalDirection.normalize();
`;
  if (!fixedWallBlockPattern.test(elbow)) {
    throw new Error(`${elbowPath}: fixed Rotunda/wall block is missing and the final source-owned form is incomplete`);
  }
  elbow = elbow.replace(fixedWallBlockPattern, fixedWallReplacement);

  const parentPivotPattern = /  const tunnelCenterBefore = objectCenterInFleet\(THREE, fleet, tunnelA\);[\s\S]*?  if \(targetAlignmentCosine < 0\.99999\) throw new Error\(`A1 supplied bridge does not point at the source A1 door target: \$\{targetAlignmentCosine\}`\);\n/;
  const sourceHeadingReplacement = `  // Preserve the complete supplied A1 parent at the decoded airport heading.
  // The previous implementation rotated the whole parent toward a synthetic CRJ
  // door target and then translated it back around the Rotunda. That made the
  // aircraft own the airport geometry and visibly destroyed the intended elbow.
  const rotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const rotundaPreservationErrorMeters = Math.hypot(
    rotundaCenter.x - sourceRotundaTarget.x,
    rotundaCenter.z - sourceRotundaTarget.z,
  );
  if (rotundaPreservationErrorMeters > 0.002) {
    throw new Error(\`A1 source Rotunda moved after source-pose lock: \${rotundaPreservationErrorMeters}\`);
  }
  const tunnelCenterAfter = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelCenterAfter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("A1 exact source bridge axis is degenerate");
  bridgeDirection.normalize();
  // No whole-parent yaw is applied after the decoded airport heading. Keep the
  // historical return/telemetry field explicit at zero so downstream consumers
  // can prove that source ownership did not silently rotate the assembly.
  const yawDelta = 0;
  const targetAlignmentCosine = bridgeDirection.dot(targetDirection);
`;
  if (!parentPivotPattern.test(elbow)) {
    throw new Error(`${elbowPath}: synthetic whole-parent A1 door-target pivot block is missing and source ownership is incomplete`);
  }
  elbow = elbow.replace(parentPivotPattern, sourceHeadingReplacement);

  elbow = elbow.replace(
    '  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {\n    throw new Error(`A1 authored wall-to-Rotunda visible vestibule is not compact: ${visibleTerminalLegMeters}`);\n  }',
    '  if (!(visibleTerminalLegMeters > 0.15 && visibleTerminalLegMeters < 44)) {\n    throw new Error(`A1 source wall-to-Rotunda fixed leg is invalid: ${visibleTerminalLegMeters}`);\n  }',
  );

  const telemetryAnchor = '  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;';
  const telemetryPatch = `  group.userData.uploadedJetwayA1SourceBglOwnershipAuthority = "${AUTHORITY}";
  group.userData.uploadedJetwayA1SourceRotundaPositionErrorMeters = sourceRotundaPositionErrorMeters;
  group.userData.uploadedJetwayA1SourcePlacementX = sourceRotundaTarget.x;
  group.userData.uploadedJetwayA1SourcePlacementZ = sourceRotundaTarget.z;
  group.userData.uploadedJetwayA1SourcePlacementYawRadians = Number(placement.yaw);
  group.userData.uploadedJetwayA1MeasuredRealWallAuthority = "${WALL_AUTHORITY}";
  ${telemetryAnchor}`;
  if (!elbow.includes('uploadedJetwayA1SourceBglOwnershipAuthority')) {
    if (!elbow.includes(telemetryAnchor)) throw new Error(`${elbowPath}: A1 elbow telemetry anchor is missing`);
    elbow = elbow.replace(telemetryAnchor, telemetryPatch);
  }
}

for (const required of [
  AUTHORITY,
  WALL_AUTHORITY,
  'const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)',
  'anchor.rotation.y = Number(placement.yaw)',
  'uploadedJetwayA1MeasuredTerminalWallX',
  'uploadedJetwayA1SourceRotundaPositionErrorMeters',
  'const yawDelta = 0;',
  'const targetAlignmentCosine = bridgeDirection.dot(targetDirection);',
]) {
  if (!elbow.includes(required)) throw new Error(`${elbowPath}: A1 source ownership is missing ${required}`);
}
for (const forbidden of [
  'anchor.rotation.y += yawDelta;',
  'A1 supplied bridge does not point at the source A1 door target',
  'terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8',
  'A1 authored wall-to-Rotunda visible vestibule is not compact',
  'UploadedAirportJetwayA1AircraftSidePivot',
  'bridgePivot.attach(root)',
]) {
  if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: synthetic A1 geometry ownership survived: ${forbidden}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
console.log(`${alreadySourceOwned ? "Validated existing" : "Installed"} A1 decoded-KPHX Rotunda/x-z/yaw ownership with zero whole-parent door-target yaw and no child reparenting (${AUTHORITY}).`);
