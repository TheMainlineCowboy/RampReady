import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const SOURCE_ROTUNDA_AUTHORITY = "a1-source-gate-rotunda-center-real-wall-lock-v1";

// Every earlier migration is allowed to compute diagnostics, but the final
// production geometry must not inherit a Rotunda that was moved merely to make
// an arbitrary visible-vestibule number true. Restore the exact supplied A1
// Rotunda to the package-authored gate coordinate, then measure the real wall
// from that fixed source point. The aircraft-side bridge may pivot afterward;
// the terminal-side Rotunda may not migrate toward T4_WALK or the aircraft.
const spanPattern = /  let rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);[\s\S]*?(?=\n  const cabContactMesh = a1Model\.getObjectByName\("Cab_Jetway_0"\);)/;
if (!spanPattern.test(source)) {
  throw new Error(`${installationPath}: final A1 terminal relocation span block is missing`);
}

const sourceLockedSpan = `  let rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (measuredTerminalAlignment < 0.80) {
    throw new Error(\`A1 authored Rotunda opening does not face the real terminal wall before source lock: \${measuredTerminalAlignment}\`);
  }

  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const desiredRotundaCenterX = a1Placement.x;
  const desiredRotundaCenterZ = a1Placement.z;
  const terminalRelocationX = desiredRotundaCenterX - rotundaOpening.centerX;
  const terminalRelocationZ = desiredRotundaCenterZ - rotundaOpening.centerZ;
  const terminalRelocationMeters = Math.hypot(terminalRelocationX, terminalRelocationZ);
  if (!Number.isFinite(terminalRelocationMeters) || terminalRelocationMeters >= 60) {
    throw new Error(\`A1 source-Rotunda restoration is invalid: \${terminalRelocationMeters}\`);
  }
  a1Anchor.position.x += terminalRelocationX;
  a1Anchor.position.z += terminalRelocationZ;
  fleet.updateMatrixWorld(true);

  rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const relocatedWallOffsetX = terminalWallX - rotundaOpening.centerX;
  const relocatedWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = Math.hypot(relocatedWallOffsetX, relocatedWallOffsetZ);
  const terminalCrossTrackErrorMeters = Math.abs(
    relocatedWallOffsetX * -terminalDirection.z
      + relocatedWallOffsetZ * terminalDirection.x,
  );
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  const relocationDistanceError = Math.hypot(
    rotundaOpening.centerX - desiredRotundaCenterX,
    rotundaOpening.centerZ - desiredRotundaCenterZ,
  );
  const openingAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;

  if (relocationDistanceError > 0.03 || terminalCrossTrackErrorMeters > 0.03) {
    throw new Error(\`A1 final source Rotunda lock missed the package gate/wall axis: radial=\${relocationDistanceError} m cross-track=\${terminalCrossTrackErrorMeters} m\`);
  }
  if (!(actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 12)) {
    throw new Error(\`A1 source-measured visible vestibule is physically invalid: \${actualVisibleVestibuleMeters}\`);
  }
  if (openingAlignment < 0.80) {
    throw new Error(\`A1 authored Rotunda opening is not terminal-facing after source lock: \${openingAlignment}\`);
  }
  a1Anchor.userData.sourceRotundaAuthority = "${SOURCE_ROTUNDA_AUTHORITY}";
  a1Anchor.userData.sourceRotundaX = desiredRotundaCenterX;
  a1Anchor.userData.sourceRotundaZ = desiredRotundaCenterZ;
  a1Anchor.userData.sourceMeasuredVisibleVestibuleMeters = actualVisibleVestibuleMeters;
`;
source = source.replace(spanPattern, sourceLockedSpan);

// The corrected placement passed to the generated vestibule must use the same
// source Rotunda and real wall ray. Do not derive a new Rotunda position by
// backing an arbitrary distance away from the wall.
source = source.replace(
  /  const correctedA1Placement = Object\.freeze\(\{\n    \.\.\.a1Placement,\n    x: terminalWallX - terminalDirection\.x \* terminalDistance,\n    z: terminalWallZ - terminalDirection\.z \* terminalDistance,\n    wallConnectorLength: terminalDistance \+ SOURCE_WALL_LENGTH_PADDING_METERS,\n  \}\);/,
  `  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    x: desiredRotundaCenterX,
    z: desiredRotundaCenterZ,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`,
);

// Remove any surviving magic 2.4 m acceptance gate. The source-measured wall
// span is the acceptance value now; range + alignment + cross-track checks above
// fail closed if it is nonsensical.
source = source.replaceAll(
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "!(actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 12)",
);
source = source.replaceAll(
  "A1 relocated visible vestibule is wrong",
  "A1 source-measured visible vestibule is invalid",
);
source = source.replaceAll(
  "A1 post-orientation terminal span is not the same-day-photo 2.4 m vestibule",
  "A1 post-orientation source-measured terminal span is invalid",
);

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "source-gate-rotunda-real-terminal-wall-grounded-exact-chain-v28";',
);

// Preserve the endpoint telemetry used by browser evidence, but make its desired
// Rotunda point explicitly the source gate point rather than the 2.4 m-derived
// location.
const reportAnchor = "  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;";
if (!source.includes(reportAnchor)) {
  throw new Error(`${installationPath}: A1 relocation report anchor is missing`);
}
source = source.replace(
  reportAnchor,
  `  const finalRotundaCenterWorld = fleet.localToWorld(new THREE.Vector3(
    rotundaOpening.centerX,
    rotundaOpening.centerY,
    rotundaOpening.centerZ,
  ));
  const finalMeasuredTerminalWallWorld = fleet.localToWorld(new THREE.Vector3(
    terminalWallX,
    rotundaOpening.centerY,
    terminalWallZ,
  ));
  const finalRotundaToCabWorldMeters = Math.hypot(
    cabContactWorld.x - finalRotundaCenterWorld.x,
    cabContactWorld.y - finalRotundaCenterWorld.y,
    cabContactWorld.z - finalRotundaCenterWorld.z,
  );
  const finalRotundaToWallWorldMeters = Math.hypot(
    finalMeasuredTerminalWallWorld.x - finalRotundaCenterWorld.x,
    finalMeasuredTerminalWallWorld.y - finalRotundaCenterWorld.y,
    finalMeasuredTerminalWallWorld.z - finalRotundaCenterWorld.z,
  );
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;
  group.userData.uploadedJetwayA1TerminalCrossTrackErrorMeters = terminalCrossTrackErrorMeters;
  group.userData.uploadedJetwayA1DesiredRotundaCenterX = desiredRotundaCenterX;
  group.userData.uploadedJetwayA1DesiredRotundaCenterZ = desiredRotundaCenterZ;
  group.userData.uploadedJetwayA1FinalRotundaWorldX = finalRotundaCenterWorld.x;
  group.userData.uploadedJetwayA1FinalRotundaWorldY = finalRotundaCenterWorld.y;
  group.userData.uploadedJetwayA1FinalRotundaWorldZ = finalRotundaCenterWorld.z;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldX = finalMeasuredTerminalWallWorld.x;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldY = finalMeasuredTerminalWallWorld.y;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldZ = finalMeasuredTerminalWallWorld.z;
  group.userData.uploadedJetwayA1FinalRotundaToCabWorldMeters = finalRotundaToCabWorldMeters;
  group.userData.uploadedJetwayA1FinalRotundaToWallWorldMeters = finalRotundaToWallWorldMeters;
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-source-rotunda-real-wall-cab-endpoints-v28";
  group.userData.uploadedJetwayA1SourceRotundaAuthority = "${SOURCE_ROTUNDA_AUTHORITY}";
  group.userData.uploadedJetwayA1SourceRotundaX = desiredRotundaCenterX;
  group.userData.uploadedJetwayA1SourceRotundaZ = desiredRotundaCenterZ;
  group.userData.uploadedJetwayA1SourceMeasuredVisibleVestibuleMeters = actualVisibleVestibuleMeters;`,
);

for (const token of [
  'INSTALLATION_AUTHORITY = "source-gate-rotunda-real-terminal-wall-grounded-exact-chain-v28"',
  SOURCE_ROTUNDA_AUTHORITY,
  "const desiredRotundaCenterX = a1Placement.x",
  "const desiredRotundaCenterZ = a1Placement.z",
  "const terminalDistance = Math.hypot(relocatedWallOffsetX, relocatedWallOffsetZ)",
  "actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 12",
  "uploadedJetwayA1SourceMeasuredVisibleVestibuleMeters",
  "exact-source-rotunda-real-wall-cab-endpoints-v28",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: source-measured final A1 wall lock is missing ${token}`);
  }
}
for (const forbidden of [
  "const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "A1 full-vector terminal relocation is invalid",
  "A1 full-vector terminal lock missed the measured wall",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: magic-distance A1 wall lock survived: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Locked final A1 geometry to the package-authored Rotunda center and real Terminal 4 wall ray; the visible vestibule is now measured from those physical endpoints instead of forced to 2.4 m.");
