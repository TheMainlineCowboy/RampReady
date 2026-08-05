import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const spanBlockPattern = /  const rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);[\s\S]*?(?=\n  const rotundaCenterAfter = objectBoundsCenterInFleet)/;
if (!spanBlockPattern.test(source)) {
  throw new Error(`${installationPath}: authored-opening cab-pivot span block is missing`);
}

const relocatedSpanBlock = `  let rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (measuredTerminalAlignment < 0.995) {
    throw new Error(\`A1 authored Rotunda opening did not face the terminal before relocation: \${measuredTerminalAlignment}\`);
  }
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
  if (openingAlignment < 0.995) {
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
const relocationAfter = `  const relocationX = cabPreservationDelta.x + terminalRelocationX;
  const relocationZ = cabPreservationDelta.z + terminalRelocationZ;
  const relocationDistance = Math.hypot(relocationX, relocationZ);
  group.userData.uploadedJetwayA1TerminalRelocationX = terminalRelocationX;
  group.userData.uploadedJetwayA1TerminalRelocationZ = terminalRelocationZ;
  group.userData.uploadedJetwayA1TerminalRelocationMeters = terminalRelocationMeters;
  group.userData.uploadedJetwayA1TerminalRelocationDistanceErrorMeters = relocationDistanceError;
  group.userData.uploadedJetwayA1TerminalOpeningAlignment = openingAlignment;
  group.userData.uploadedJetwayA1MeasuredTerminalWallX = terminalWallX;
  group.userData.uploadedJetwayA1MeasuredTerminalWallZ = terminalWallZ;`;
if (!source.includes(relocationBefore)) {
  throw new Error(`${installationPath}: A1 relocation report anchor is missing`);
}
source = source.replace(relocationBefore, relocationAfter);
source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "terminal-relocated-authored-opening-cab-pivot-rigid-parent-grounded-exact-chain-v20";',
);

for (const token of [
  'INSTALLATION_AUTHORITY = "terminal-relocated-authored-opening-cab-pivot-rigid-parent-grounded-exact-chain-v20"',
  "const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x",
  "const desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "a1Anchor.position.x += terminalRelocationX",
  "x: terminalWallX - terminalDirection.x * terminalDistance",
  "z: terminalWallZ - terminalDirection.z * terminalDistance",
  "const relocationDistanceError = Math.abs(terminalDistance - desiredTerminalDistance)",
  "openingAlignment < 0.995",
  "A1_PHOTO_VISIBLE_VESTIBULE_METERS > 3",
  "uploadedJetwayA1TerminalRelocationDistanceErrorMeters",
  "uploadedJetwayA1TerminalOpeningAlignment",
  "uploadedJetwayA1MeasuredTerminalWallX",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: authored-opening terminal relocation output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Relocated the authored-terminal-side A1 Rotunda to the real wall, anchored the compact vestibule to that wall, and preserved the supplied GLB hierarchy.");
