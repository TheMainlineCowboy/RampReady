import fs from "node:fs";

const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const AUTHORITY = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const LEGACY_AUTHORITY = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";
const WALL_AUTHORITY = "a1-measured-real-wall-preserved-rotunda-v2";
const MAXIMUM_FINAL_ROTUNDA_TO_WALL_METERS = 12;

let placements = fs.readFileSync(placementsPath, "utf8");

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
elbow = elbow
  .replaceAll(LEGACY_AUTHORITY, AUTHORITY)
  .replaceAll("a1-source-rotunda-to-measured-real-terminal-wall-v1", WALL_AUTHORITY);

const alreadyPrepared = [
  AUTHORITY,
  WALL_AUTHORITY,
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const rawBglPlacementX = Number(placement.x);",
  "anchor.rotation.y = Number(placement.yaw);",
  "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
  "uploadedJetwayA1RawBglPlacementX",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "const yawDelta = 0;",
].every((token) => elbow.includes(token))
  && !elbow.includes("UploadedAirportJetwayA1AircraftSidePivot")
  && !elbow.includes("bridgePivot.attach(root)")
  && !elbow.includes("anchor.rotation.y += yawDelta;");

if (!alreadyPrepared) {
  elbow = elbow
    .replace(
      'const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "photo-registered-a1-fixed-wall-rotunda-source-door-target-elbow-v3";',
      `const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "${AUTHORITY}";`,
    )
    .replace(
      'const TARGET_DIRECTION_AUTHORITY = "source-a1-door-target-owns-aircraft-side-bridge-heading-v1";',
      'const TARGET_DIRECTION_AUTHORITY = "decoded-kphx-heading-owns-intact-a1-aircraft-must-conform-v2";',
    )
    .replace(
      'const CONNECTOR_AUTHORITY = "real-terminal-fixed-rotunda-independent-aircraft-side-elbow-v3";',
      `const CONNECTOR_AUTHORITY = "${WALL_AUTHORITY}";`,
    )
    .replace(
      'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v4-authored-rotunda-surface";',
      'const CONNECTOR_STYLE_AUTHORITY = "preserved-measured-wall-to-intact-source-heading-rotunda-v6";',
    );

  const legacyPreparedWallPattern = /  \/\/ Restore the exact A1 Rotunda to the decoded KPHX BGL gate coordinate before[\s\S]*?  terminalDirection\.normalize\(\);\n/;
  const baselineWallPattern = /  const fixedRotundaCenter = objectCenterInFleet\(THREE, fleet, rotunda\);[\s\S]*?  fixedWallPoint\.y = fixedRotundaCenter\.y;\n/;
  const wallRegistrationBlock = `  // Preserve the Rotunda position produced by the real structural-wall
  // registration that runs immediately before this pass. The decoded BGL
  // placement is a source MODEL origin, not proof that its x/z is the supplied
  // replacement Rotunda center. Re-centering the Rotunda onto raw BGL x/z
  // created the ~20 m false wall span seen in browser evidence.
  let fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceRotundaTarget = fixedRotundaCenter.clone();
  const rawBglPlacementX = Number(placement.x);
  const rawBglPlacementZ = Number(placement.z);
  if (![rawBglPlacementX, rawBglPlacementZ].every(Number.isFinite)) {
    throw new Error("A1 decoded KPHX BGL model-origin placement is missing");
  }

  const measuredWallX = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallX);
  const measuredWallZ = Number(group.userData.uploadedJetwayA1MeasuredTerminalWallZ);
  if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {
    throw new Error("A1 measured structural Terminal 4 wall point is missing");
  }
  const fixedWallPoint = new THREE.Vector3(measuredWallX, fixedRotundaCenter.y, measuredWallZ);
  const terminalDirection = fixedWallPoint.clone().sub(fixedRotundaCenter);
  terminalDirection.y = 0;
  let terminalWallDistance = terminalDirection.length();
  if (!(terminalWallDistance > 0.5 && terminalWallDistance < ${MAXIMUM_FINAL_ROTUNDA_TO_WALL_METERS})) {
    throw new Error(\`A1 wall-registered Rotunda-to-real-wall distance is invalid before source-heading lock: \${terminalWallDistance}\`);
  }
  terminalDirection.normalize();

  // Apply the decoded KPHX heading to the COMPLETE supplied A1 anchor, never to
  // selected children. Rotating the entire anchor can move the Rotunda because
  // its authored center is offset from the model root; translate the complete
  // anchor back afterward so the already-correct real-wall Rotunda position is
  // preserved exactly. Every supplied child local transform remains unchanged.
  anchor.rotation.y = Number(placement.yaw);
  if (!Number.isFinite(anchor.rotation.y)) throw new Error("A1 decoded KPHX BGL heading is missing");
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  const rotatedSourceHeadingRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z;
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
    throw new Error(\`A1 measured-wall Rotunda moved during intact source-heading lock: \${sourceRotundaPositionErrorMeters}\`);
  }
  fixedWallPoint.y = fixedRotundaCenter.y;
  terminalDirection.copy(fixedWallPoint).sub(fixedRotundaCenter).setY(0);
  terminalWallDistance = terminalDirection.length();
  if (!(terminalWallDistance > 0.5 && terminalWallDistance < ${MAXIMUM_FINAL_ROTUNDA_TO_WALL_METERS})) {
    throw new Error(\`A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid: \${terminalWallDistance}\`);
  }
  terminalDirection.normalize();
`;

  if (legacyPreparedWallPattern.test(elbow)) {
    elbow = elbow.replace(legacyPreparedWallPattern, wallRegistrationBlock);
  } else if (baselineWallPattern.test(elbow)) {
    elbow = elbow.replace(baselineWallPattern, wallRegistrationBlock);
  } else {
    throw new Error(`${elbowPath}: A1 wall/Rotunda block is missing; refusing to guess a physical registration rewrite`);
  }

  const parentPivotPattern = /  const tunnelCenterBefore = objectCenterInFleet\(THREE, fleet, tunnelA\);[\s\S]*?  if \(targetAlignmentCosine < 0\.99999\) throw new Error\(`A1 supplied bridge does not point at the source A1 door target: \$\{targetAlignmentCosine\}`\);\n/;
  const oldSourceHeadingPattern = /  \/\/ Preserve the complete supplied A1 parent at the decoded airport heading\.[\s\S]*?  const targetAlignmentCosine = bridgeDirection\.dot\(targetDirection\);\n/;
  const sourceHeadingBlock = `  // The complete A1 anchor was already given its decoded airport heading above
  // while its measured real-wall Rotunda position was preserved. Do not rotate
  // or reparent any supplied child here to chase the aircraft target.
  const rotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const rotundaPreservationErrorMeters = Math.hypot(
    rotundaCenter.x - sourceRotundaTarget.x,
    rotundaCenter.z - sourceRotundaTarget.z,
  );
  if (rotundaPreservationErrorMeters > 0.002) {
    throw new Error(\`A1 real-wall Rotunda moved after intact source-heading lock: \${rotundaPreservationErrorMeters}\`);
  }
  const tunnelCenterAfter = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelCenterAfter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("A1 exact source bridge axis is degenerate");
  bridgeDirection.normalize();
  const yawDelta = 0;
  const targetAlignmentCosine = bridgeDirection.dot(targetDirection);
`;
  if (parentPivotPattern.test(elbow)) elbow = elbow.replace(parentPivotPattern, sourceHeadingBlock);
  else if (oldSourceHeadingPattern.test(elbow)) elbow = elbow.replace(oldSourceHeadingPattern, sourceHeadingBlock);
  else if (!elbow.includes("const yawDelta = 0;")) {
    throw new Error(`${elbowPath}: A1 aircraft-target pivot block is missing and source-heading lock is incomplete`);
  }

  elbow = elbow.replace(
    '  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {\n    throw new Error(`A1 authored wall-to-Rotunda visible vestibule is not compact: ${visibleTerminalLegMeters}`);\n  }',
    '  if (!(visibleTerminalLegMeters > 0.15 && visibleTerminalLegMeters < 10)) {\n    throw new Error(`A1 measured wall-to-Rotunda fixed leg is invalid: ${visibleTerminalLegMeters}`);\n  }',
  );
  elbow = elbow.replace(
    '  if (!(visibleTerminalLegMeters > 0.15 && visibleTerminalLegMeters < 44)) {\n    throw new Error(`A1 source wall-to-Rotunda fixed leg is invalid: ${visibleTerminalLegMeters}`);\n  }',
    '  if (!(visibleTerminalLegMeters > 0.15 && visibleTerminalLegMeters < 10)) {\n    throw new Error(`A1 measured wall-to-Rotunda fixed leg is invalid: ${visibleTerminalLegMeters}`);\n  }',
  );

  const telemetryAnchor = '  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;';
  if (!elbow.includes("uploadedJetwayA1RawBglPlacementX")) {
    if (!elbow.includes(telemetryAnchor)) throw new Error(`${elbowPath}: A1 elbow telemetry anchor is missing`);
    elbow = elbow.replace(
      telemetryAnchor,
      `  group.userData.uploadedJetwayA1SourceBglOwnershipAuthority = "${AUTHORITY}";
  group.userData.uploadedJetwayA1SourceRotundaPositionErrorMeters = sourceRotundaPositionErrorMeters;
  group.userData.uploadedJetwayA1SourcePlacementX = sourceRotundaTarget.x;
  group.userData.uploadedJetwayA1SourcePlacementZ = sourceRotundaTarget.z;
  group.userData.uploadedJetwayA1RawBglPlacementX = rawBglPlacementX;
  group.userData.uploadedJetwayA1RawBglPlacementZ = rawBglPlacementZ;
  group.userData.uploadedJetwayA1SourcePlacementYawRadians = Number(placement.yaw);
  group.userData.uploadedJetwayA1MeasuredRealWallAuthority = "${WALL_AUTHORITY}";
  ${telemetryAnchor}`,
    );
  }
}

for (const required of [
  AUTHORITY,
  WALL_AUTHORITY,
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const rawBglPlacementX = Number(placement.x);",
  "anchor.rotation.y = Number(placement.yaw);",
  "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
  "A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid",
  "uploadedJetwayA1RawBglPlacementX",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "const yawDelta = 0;",
  "const targetAlignmentCosine = bridgeDirection.dot(targetDirection);",
]) {
  if (!elbow.includes(required)) throw new Error(`${elbowPath}: intact wall-registered A1 source-heading output is missing ${required}`);
}
for (const forbidden of [
  LEGACY_AUTHORITY,
  'const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)',
  'anchor.rotation.y += yawDelta;',
  'A1 supplied bridge does not point at the source A1 door target',
  'UploadedAirportJetwayA1AircraftSidePivot',
  'bridgePivot.attach(root)',
  'A1 source Rotunda-to-real-wall distance is invalid',
]) {
  if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: stale destructive/raw-origin A1 behavior survived: ${forbidden}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
console.log(`${alreadyPrepared ? "Validated" : "Prepared"} A1 with the measured real-wall Rotunda position preserved while the COMPLETE supplied parent receives decoded KPHX heading; raw BGL x/z remains model-origin provenance only and no child is reparented.`);
