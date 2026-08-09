import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const scalarRelocationPattern = /  const terminalWallX = a1Placement\.x \+ terminalDirection\.x \* sourceTerminalDistance;[\s\S]*?  rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);\n  const relocatedWallOffsetX/;

if (!scalarRelocationPattern.test(source)) {
  throw new Error(`${installationPath}: scalar-only A1 terminal relocation block is missing`);
}

source = source.replace(
  scalarRelocationPattern,
  `  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;

  // UploadedAirportJetway_A1 is intentionally a direct child of fleet. Both
  // a1Anchor.position and measureExactRotundaOpening() therefore use the same
  // fleet-local X/Z coordinate system. Move the complete authored assembly by
  // that exact vector; never rotate or translate an individual supplied node.
  if (a1Anchor.parent !== fleet) {
    throw new Error("A1 complete anchor is no longer a direct fleet child; refusing an ambiguous wall lock");
  }
  const desiredRotundaCenterX = terminalWallX
    - rotundaOpening.openingDirectionX * desiredTerminalDistance;
  const desiredRotundaCenterZ = terminalWallZ
    - rotundaOpening.openingDirectionZ * desiredTerminalDistance;
  const terminalRelocationX = desiredRotundaCenterX - rotundaOpening.centerX;
  const terminalRelocationZ = desiredRotundaCenterZ - rotundaOpening.centerZ;
  const terminalRelocationMeters = Math.hypot(terminalRelocationX, terminalRelocationZ);
  if (!Number.isFinite(terminalRelocationMeters) || terminalRelocationMeters >= 60) {
    throw new Error(\`A1 full-vector terminal relocation is invalid: \${terminalRelocationMeters}\`);
  }
  a1Anchor.position.x += terminalRelocationX;
  a1Anchor.position.z += terminalRelocationZ;
  a1Anchor.updateMatrix();
  fleet.updateMatrixWorld(true);
  a1Model.updateWorldMatrix(true, true);
  rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);

  // Trust the transformed authored Rotunda, not the requested parent delta.
  // Some source-parent combinations can retain an earlier matrix contribution
  // through the preparation stack. Close any radial residual using the complete
  // A1 parent only, then remeasure before acceptance. This preserves every GLB
  // child transform while making the physical wall/Rotunda measurement final.
  let postLockWallOffsetX = terminalWallX - rotundaOpening.centerX;
  let postLockWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  let postLockTerminalDistance = postLockWallOffsetX * rotundaOpening.openingDirectionX
    + postLockWallOffsetZ * rotundaOpening.openingDirectionZ;
  const postLockRadialResidual = postLockTerminalDistance - desiredTerminalDistance;
  if (!Number.isFinite(postLockRadialResidual) || Math.abs(postLockRadialResidual) >= 60) {
    throw new Error(\`A1 post-transform wall-lock residual is invalid: \${postLockRadialResidual}\`);
  }
  if (Math.abs(postLockRadialResidual) > 0.01) {
    a1Anchor.position.x += rotundaOpening.openingDirectionX * postLockRadialResidual;
    a1Anchor.position.z += rotundaOpening.openingDirectionZ * postLockRadialResidual;
    a1Anchor.updateMatrix();
    fleet.updateMatrixWorld(true);
    a1Model.updateWorldMatrix(true, true);
    rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
    postLockWallOffsetX = terminalWallX - rotundaOpening.centerX;
    postLockWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
    postLockTerminalDistance = postLockWallOffsetX * rotundaOpening.openingDirectionX
      + postLockWallOffsetZ * rotundaOpening.openingDirectionZ;
  }
  const finalPostLockRadialResidual = postLockTerminalDistance - desiredTerminalDistance;
  if (!Number.isFinite(finalPostLockRadialResidual) || Math.abs(finalPostLockRadialResidual) > 0.03) {
    throw new Error(\`A1 post-transform wall lock did not converge: \${finalPostLockRadialResidual} m\`);
  }
  const relocatedWallOffsetX`,
);

const distanceErrorPattern = /  const relocationDistanceError = Math\.abs\(terminalDistance - desiredTerminalDistance\);/;
if (!distanceErrorPattern.test(source)) {
  throw new Error(`${installationPath}: A1 relocation distance-error calculation is missing`);
}
source = source.replace(
  distanceErrorPattern,
  `  const relocationDistanceError = Math.hypot(
    rotundaOpening.centerX - desiredRotundaCenterX,
    rotundaOpening.centerZ - desiredRotundaCenterZ,
  );
  const terminalCrossTrackErrorMeters = Math.abs(
    relocatedWallOffsetX * -rotundaOpening.openingDirectionZ
      + relocatedWallOffsetZ * rotundaOpening.openingDirectionX,
  );`,
);

const errorGatePattern = /  if \(relocationDistanceError > 0\.03\) \{\n    throw new Error\(`A1 signed terminal relocation missed the measured vestibule span by \$\{relocationDistanceError\} m`\);\n  \}/;
if (!errorGatePattern.test(source)) {
  throw new Error(`${installationPath}: A1 scalar relocation error gate is missing`);
}
source = source.replace(
  errorGatePattern,
  `  if (Math.abs(finalPostLockRadialResidual) > 0.03 || terminalCrossTrackErrorMeters > 0.03) {
    throw new Error(\`A1 full-vector terminal lock missed the measured wall: radial=\${finalPostLockRadialResidual} m cross-track=\${terminalCrossTrackErrorMeters} m\`);
  }`,
);

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
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = Math.abs(finalPostLockRadialResidual);
  group.userData.uploadedJetwayA1TerminalPostLockRadialResidualMeters = finalPostLockRadialResidual;
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
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-world-rotunda-wall-cab-endpoints-v31";`,
);

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "post-transform-measured-terminal-wall-lock-grounded-exact-chain-v33";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "post-transform-measured-terminal-wall-lock-grounded-exact-chain-v33"',
  "a1Anchor.parent !== fleet",
  "desiredRotundaCenterX",
  "a1Anchor.position.x += terminalRelocationX",
  "a1Anchor.updateMatrix()",
  "a1Model.updateWorldMatrix(true, true)",
  "postLockRadialResidual",
  "finalPostLockRadialResidual",
  "A1 post-transform wall lock did not converge",
  "terminalCrossTrackErrorMeters",
  "A1 full-vector terminal lock missed the measured wall",
  "uploadedJetwayA1TerminalPostLockRadialResidualMeters",
  "uploadedJetwayA1TerminalCrossTrackErrorMeters",
  "const finalRotundaCenterWorld = fleet.localToWorld",
  "const finalMeasuredTerminalWallWorld = fleet.localToWorld",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaToCabWorldMeters",
  "uploadedJetwayA1FinalEndpointEvidenceAuthority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: post-transform measured A1 wall lock output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Locked the complete A1 parent to the real Terminal 4 wall, then remeasured and corrected the transformed authored Rotunda without changing any supplied child transform.");
