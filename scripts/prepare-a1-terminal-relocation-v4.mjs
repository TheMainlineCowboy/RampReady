import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const before = `  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  if (!(terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12)) {
    throw new Error(\`A1 cab-pivot terminal span is invalid: \${terminalDistance}\`);
  }`;

const after = `  let rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const initialTerminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;
  const terminalRelocationMeters = initialTerminalDistance - desiredTerminalDistance;
  if (!(terminalRelocationMeters > 0 && terminalRelocationMeters < 60)) {
    throw new Error(\`A1 terminal relocation is invalid: \${terminalRelocationMeters}\`);
  }
  const terminalRelocationX = rotundaOpening.openingDirectionX * terminalRelocationMeters;
  const terminalRelocationZ = rotundaOpening.openingDirectionZ * terminalRelocationMeters;
  a1Anchor.position.x += terminalRelocationX;
  a1Anchor.position.z += terminalRelocationZ;
  fleet.updateMatrixWorld(true);
  rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const relocatedWallOffsetX = terminalWallX - rotundaOpening.centerX;
  const relocatedWallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = relocatedWallOffsetX * rotundaOpening.openingDirectionX
    + relocatedWallOffsetZ * rotundaOpening.openingDirectionZ;
  const relocationDistanceError = Math.abs(terminalDistance - desiredTerminalDistance);
  const openingAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (relocationDistanceError > 0.03) {
    throw new Error(\`A1 terminal relocation missed the measured vestibule span by \${relocationDistanceError} m\`);
  }
  if (openingAlignment < 0.98) {
    throw new Error(\`A1 Rotunda opening is not terminal-facing after relocation: \${openingAlignment}\`);
  }
  if (A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3) {
    throw new Error(\`A1 photo vestibule exceeds the compact-reference limit: \${A1_PHOTO_VISIBLE_VESTIBULE_METERS}\`);
  }`;

if (!source.includes(before)) throw new Error(`${installationPath}: cab-pivot span block is missing`);
source = source.replace(before, after);
source = source
  .replace(
    "  const relocationX = cabPreservationDelta.x;\n  const relocationZ = cabPreservationDelta.z;\n  const relocationDistance = cabPreservationDelta.length();",
    `  const relocationX = cabPreservationDelta.x + terminalRelocationX;
  const relocationZ = cabPreservationDelta.z + terminalRelocationZ;
  const relocationDistance = Math.hypot(relocationX, relocationZ);
  group.userData.uploadedJetwayA1TerminalRelocationX = terminalRelocationX;
  group.userData.uploadedJetwayA1TerminalRelocationZ = terminalRelocationZ;
  group.userData.uploadedJetwayA1TerminalRelocationMeters = terminalRelocationMeters;
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;
  group.userData.uploadedJetwayA1TerminalOpeningAlignment = openingAlignment;`,
  )
  .replace(
    'const INSTALLATION_AUTHORITY = "photo-registered-cab-pivot-rigid-parent-grounded-exact-chain-v15";',
    'const INSTALLATION_AUTHORITY = "terminal-relocated-cab-pivot-rigid-parent-grounded-exact-chain-v17";',
  );

for (const token of [
  'INSTALLATION_AUTHORITY = "terminal-relocated-cab-pivot-rigid-parent-grounded-exact-chain-v17"',
  "const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "a1Anchor.position.x += terminalRelocationX",
  "const relocationDistanceError = Math.abs(terminalDistance - desiredTerminalDistance)",
  "openingAlignment < 0.98",
  "A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3",
  "uploadedJetwayA1TerminalRelocationDistanceErrorMeters",
  "uploadedJetwayA1TerminalOpeningAlignment",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: terminal relocation output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Relocated the complete A1 parent by its Rotunda to the terminal wall, verified the measured compact vestibule span and terminal-facing opening, and preserved the supplied GLB hierarchy.");
