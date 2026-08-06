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

  // The old correction projected the wall error onto the bridge axis. That
  // allowed a large lateral offset to survive while every signed-distance
  // assertion passed. Lock the complete A1 parent to the full measured wall
  // vector instead. No supplied child transform or isolated node is changed.
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
  fleet.updateMatrixWorld(true);
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
  `${reportAnchor}
  group.userData.uploadedJetwayA1TerminalCrossTrackErrorMeters = terminalCrossTrackErrorMeters;
  group.userData.uploadedJetwayA1DesiredRotundaCenterX = desiredRotundaCenterX;
  group.userData.uploadedJetwayA1DesiredRotundaCenterZ = desiredRotundaCenterZ;`,
);

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "full-vector-terminal-wall-lock-grounded-exact-chain-v26";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "full-vector-terminal-wall-lock-grounded-exact-chain-v26"',
  "desiredRotundaCenterX",
  "terminalCrossTrackErrorMeters",
  "A1 full-vector terminal lock missed the measured wall",
  "uploadedJetwayA1TerminalCrossTrackErrorMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: full-vector A1 wall lock output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Locked the complete A1 parent to the measured terminal wall in full X/Z, eliminating the previously uncorrected cross-track detachment while preserving every supplied child transform.");
