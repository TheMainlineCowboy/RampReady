import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const marker = "a1-final-rotunda-through-continuity-v1";
const diagnosticAuthority = "a1-fixed-wall-elbow-vector-diagnostic-v1";
let source = fs.readFileSync(sourcePath, "utf8");

if (source.includes(marker)) {
  console.log("A1 final Rotunda through-continuity guard is already prepared.");
  process.exit(0);
}

// The legacy photo-shape guard required a 45–150 degree branch angle, which
// effectively demanded at least a 30 degree visible turn even when the decoded
// KPHX heading and measured terminal wall produce a nearly straight-through
// Rotunda. That cosmetic requirement previously encouraged rotating the whole
// supplied bridge toward the training-aircraft target. Keep the measured angle
// as telemetry, but make acceptance physical: the terminal leg and aircraft-side
// bridge must leave the Rotunda in opposite hemispheres (no fold-back), while
// the existing source-heading, wall, seal/gap, Rotunda-preservation and grounded
// support checks remain authoritative.
const legacyGuard = `  const cornerDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  if (!(cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES)) {
    throw new Error(\`A1 fixed-wall Rotunda did not produce the required visible elbow: \${cornerAngleDegrees.toFixed(3)} degrees\`);
  }`;

const diagnosticGuard = `  const cornerDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  // ${diagnosticAuthority}
  if (!(cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES)) {
    const travelTurnDegrees = 180 - cornerAngleDegrees;
    throw new Error(\`A1 fixed-wall Rotunda did not produce the required visible elbow: branch=\${cornerAngleDegrees.toFixed(3)} degrees travelTurn=\${travelTurnDegrees.toFixed(3)} terminalDir=(\${terminalDirection.x.toFixed(6)},\${terminalDirection.z.toFixed(6)}) bridgeDir=(\${bridgeDirection.x.toFixed(6)},\${bridgeDirection.z.toFixed(6)}) targetDir=(\${targetDirection.x.toFixed(6)},\${targetDirection.z.toFixed(6)}) rotunda=(\${rotundaCenter.x.toFixed(6)},\${rotundaCenter.z.toFixed(6)}) wall=(\${fixedWallPoint.x.toFixed(6)},\${fixedWallPoint.z.toFixed(6)}) target=(\${targetPoint.x.toFixed(6)},\${targetPoint.z.toFixed(6)}) sourceYaw=\${Number(placement.yaw).toFixed(6)} relocation=(\${sourceModelOriginRelocationX.toFixed(6)},\${sourceModelOriginRelocationZ.toFixed(6)})\`);
  }`;

const continuityGuard = `  const cornerDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  const throughTurnDegrees = 180 - cornerAngleDegrees;
  // ${marker}
  if (!Number.isFinite(cornerAngleDegrees) || cornerDot >= 0) {
    throw new Error(\`A1 Rotunda terminal leg folds back into the aircraft-side bridge: branch=\${cornerAngleDegrees.toFixed(3)} degrees, turn=\${throughTurnDegrees.toFixed(3)} degrees\`);
  }`;

if (source.includes(diagnosticGuard)) source = source.replace(diagnosticGuard, continuityGuard);
else if (source.includes(legacyGuard)) source = source.replace(legacyGuard, continuityGuard);
else throw new Error(`${sourcePath}: stale visible-elbow guard is missing in both baseline and diagnostic forms; refusing to guess a rewrite`);

const telemetryAnchor = "  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = cornerAngleDegrees;";
if (!source.includes(telemetryAnchor)) {
  throw new Error(`${sourcePath}: A1 corner telemetry anchor is missing`);
}
source = source.replace(
  telemetryAnchor,
  `${telemetryAnchor}\n  group.userData.uploadedJetwayA1RotundaContinuityAuthority = "${marker}";\n  group.userData.uploadedJetwayA1RotundaThroughTurnDegrees = throughTurnDegrees;`,
);

for (const required of [
  marker,
  "const throughTurnDegrees = 180 - cornerAngleDegrees;",
  "cornerDot >= 0",
  "uploadedJetwayA1RotundaContinuityAuthority",
  "uploadedJetwayA1RotundaThroughTurnDegrees",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: final Rotunda continuity output is missing ${required}`);
}
for (const forbidden of [
  "cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES",
  "A1 fixed-wall Rotunda did not produce the required visible elbow",
]) {
  if (source.includes(forbidden)) throw new Error(`${sourcePath}: stale cosmetic elbow guard survived: ${forbidden}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Replaced the stale A1 45–150 degree cosmetic elbow requirement with Rotunda through-continuity: measured wall and decoded-source bridge must exit opposite hemispheres without fold-back.");
