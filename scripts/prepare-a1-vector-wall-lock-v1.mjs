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

  // Keep the complete supplied assembly rigid and solve the parent in full X/Z
  // from the real Terminal 4 wall. The desired/current Rotunda centers are
  // measured in fleet-local coordinates, but a1Anchor.position is parent-local.
  // Convert both centers through world space before changing the complete anchor
  // so a rotated/scaled parent cannot turn a short vestibule into a long corridor.
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
  group.updateMatrixWorld(true);
  fleet.updateWorldMatrix(true, true);
  const anchorParent = a1Anchor.parent;
  if (!anchorParent) throw new Error("A1 complete anchor has no parent for terminal wall lock");
  anchorParent.updateWorldMatrix(true, false);
  const currentRotundaCenterWorld = fleet.localToWorld(new THREE.Vector3(
    rotundaOpening.centerX,
    rotundaOpening.centerY,
    rotundaOpening.centerZ,
  ));
  const desiredRotundaCenterWorld = fleet.localToWorld(new THREE.Vector3(
    desiredRotundaCenterX,
    rotundaOpening.centerY,
    desiredRotundaCenterZ,
  ));
  const currentRotundaCenterParent = anchorParent.worldToLocal(currentRotundaCenterWorld.clone());
  const desiredRotundaCenterParent = anchorParent.worldToLocal(desiredRotundaCenterWorld.clone());
  const anchorParentCorrection = desiredRotundaCenterParent.sub(currentRotundaCenterParent);
  if (![anchorParentCorrection.x, anchorParentCorrection.z].every(Number.isFinite)) {
    throw new Error("A1 parent-space terminal wall correction is non-finite");
  }
  a1Anchor.position.x += anchorParentCorrection.x;
  a1Anchor.position.z += anchorParentCorrection.z;
  // Some upstream source-placement stages commit parent matrices explicitly.
  // Commit this rigid-parent correction before any world-space remeasurement so
  // the exact Rotunda measurement cannot observe the pre-correction matrix.
  a1Anchor.updateMatrix();
  a1Anchor.updateMatrixWorld(true);
  group.updateMatrixWorld(true);
  fleet.updateWorldMatrix(true, true);
  a1Model.updateWorldMatrix(true, true);
  rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
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
  `  if (relocationDistanceError > 0.03 || terminalCrossTrackErrorMeters > 0.03) {
    throw new Error(\`A1 full-vector terminal lock missed the measured wall: radial=\${relocationDistanceError} m cross-track=\${terminalCrossTrackErrorMeters} m\`);
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
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "exact-world-rotunda-wall-cab-endpoints-v29";`,
);

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "photo-short-parent-space-terminal-wall-lock-grounded-exact-chain-v31";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-short-parent-space-terminal-wall-lock-grounded-exact-chain-v31"',
  "desiredRotundaCenterX",
  "anchorParentCorrection",
  "a1Anchor.updateMatrix()",
  "a1Model.updateWorldMatrix(true, true)",
  "terminalCrossTrackErrorMeters",
  "A1 full-vector terminal lock missed the measured wall",
  "uploadedJetwayA1TerminalCrossTrackErrorMeters",
  "const finalRotundaCenterWorld = fleet.localToWorld",
  "const finalMeasuredTerminalWallWorld = fleet.localToWorld",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaToCabWorldMeters",
  "uploadedJetwayA1FinalEndpointEvidenceAuthority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: committed parent-space photo-short A1 wall lock output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Locked and explicitly committed the complete A1 parent to the real Terminal 4 wall before remeasurement, preserving every supplied child transform.");
