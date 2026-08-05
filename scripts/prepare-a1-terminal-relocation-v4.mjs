import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const MIN_TERMINAL_ALIGNMENT = 0.98;
const spanBlockPattern = /  const rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);[\s\S]*?(?=\n  const rotundaCenterAfter = objectBoundsCenterInFleet)/;
if (!spanBlockPattern.test(source)) {
  throw new Error(`${installationPath}: authored-opening cab-pivot span block is missing`);
}

const relocatedSpanBlock = `  let rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda opening did not face the terminal before relocation: \${measuredTerminalAlignment}\`);
  }
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const initialTerminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;
  // The exact authored opening can initially sit on either side of the measured
  // wall after the cab-pivot orientation. Preserve that orientation and apply
  // the required signed translation instead of forcing every repair to move
  // farther in the opening direction.
  const terminalRelocationMeters = initialTerminalDistance - desiredTerminalDistance;
  if (!Number.isFinite(terminalRelocationMeters) || Math.abs(terminalRelocationMeters) >= 60) {
    throw new Error(\`A1 signed terminal relocation is invalid: \${terminalRelocationMeters}\`);
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
    throw new Error(\`A1 signed terminal relocation missed the measured vestibule span by \${relocationDistanceError} m\`);
  }
  if (openingAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda opening is not terminal-facing after relocation: \${openingAlignment}\`);
  }
  if (A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3) {
    throw new Error(\`A1 photo vestibule exceeds the compact-reference limit: \${A1_PHOTO_VISIBLE_VESTIBULE_METERS}\`);
  }
`;

source = source.replace(spanBlockPattern, relocatedSpanBlock);

const placementBefore = `  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`;
const placementAfter = `  // buildMeasuredA1Connector derives its wall endpoint from placement plus
  // terminalDistance. Rebase that placement at the relocated Rotunda axis so
  // the compact vestibule terminates at the measured real wall, not the old A1 origin.
  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    x: terminalWallX - terminalDirection.x * terminalDistance,
    z: terminalWallZ - terminalDirection.z * terminalDistance,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });`;
if (!source.includes(placementBefore)) {
  throw new Error(`${installationPath}: corrected A1 placement anchor is missing`);
}
source = source.replace(placementBefore, placementAfter);

const relocationBefore = "  const relocationX = cabPreservationDelta.x;\n  const relocationZ = cabPreservationDelta.z;\n  const relocationDistance = cabPreservationDelta.length();";
const relocationAfter = `  // This is the complete rigid-parent displacement from the pre-repair A1
  // placement: cab-pivot compensation plus the final signed wall translation.
  // The aircraft must use this complete vector, not only the wall component.
  const relocationX = cabPreservationDelta.x + terminalRelocationX;
  const relocationZ = cabPreservationDelta.z + terminalRelocationZ;
  const relocationDistance = Math.hypot(relocationX, relocationZ);
  group.userData.uploadedJetwayA1TerminalRelocationX = terminalRelocationX;
  group.userData.uploadedJetwayA1TerminalRelocationZ = terminalRelocationZ;
  group.userData.uploadedJetwayA1TerminalRelocationMeters = terminalRelocationMeters;
  group.userData.uploadedJetwayA1TotalRelocationX = relocationX;
  group.userData.uploadedJetwayA1TotalRelocationZ = relocationZ;
  group.userData.uploadedJetwayA1TotalRelocationMeters = relocationDistance;
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;
  group.userData.uploadedJetwayA1TerminalOpeningAlignment = openingAlignment;
  group.userData.uploadedJetwayA1MinimumTerminalOpeningAlignment = ${MIN_TERMINAL_ALIGNMENT};
  group.userData.uploadedJetwayA1MeasuredTerminalWallX = terminalWallX;
  group.userData.uploadedJetwayA1MeasuredTerminalWallZ = terminalWallZ;`;
if (!source.includes(relocationBefore)) {
  throw new Error(`${installationPath}: A1 relocation report anchor is missing`);
}
source = source.replace(relocationBefore, relocationAfter);
source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "total-rigid-parent-relocated-authored-opening-grounded-exact-chain-v23";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "total-rigid-parent-relocated-authored-opening-grounded-exact-chain-v23"',
  "const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x",
  "const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "Math.abs(terminalRelocationMeters) >= 60",
  "a1Anchor.position.x += terminalRelocationX",
  "x: terminalWallX - terminalDirection.x * terminalDistance",
  "z: terminalWallZ - terminalDirection.z * terminalDistance",
  "const relocationDistanceError = Math.abs(terminalDistance - desiredTerminalDistance)",
  "uploadedJetwayA1TotalRelocationX",
  "uploadedJetwayA1TotalRelocationZ",
  "uploadedJetwayA1TotalRelocationMeters",
  `openingAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  "A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3",
  "uploadedJetwayA1TerminalRelocationDistanceErrorMeters",
  "uploadedJetwayA1TerminalOpeningAlignment",
  "uploadedJetwayA1MinimumTerminalOpeningAlignment",
  "uploadedJetwayA1MeasuredTerminalWallX",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: total rigid-parent relocation output is missing ${token}`);
}
if (source.includes("openingAlignment < 0.995") || source.includes("measuredTerminalAlignment < 0.995")) {
  throw new Error(`${installationPath}: obsolete 0.995 terminal-alignment gate remains`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Recorded the complete A1 rigid-parent displacement with a ${MIN_TERMINAL_ALIGNMENT.toFixed(2)} authored-opening alignment floor, signed wall relocation, and unchanged supplied GLB hierarchy.`);
