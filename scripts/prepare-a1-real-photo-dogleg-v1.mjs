import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const PHOTO_AUTHORITY = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const ELBOW_OVERLAP_METERS = 0.32;
const MINIMUM_TOTAL_CORRIDOR_METERS = 6;
const MAXIMUM_TOTAL_CORRIDOR_METERS = 48;

let source = fs.readFileSync(sourcePath, "utf8");

if (!source.includes(PHOTO_AUTHORITY)) {
  throw new Error(`${sourcePath}: ${PHOTO_AUTHORITY} must be prepared before the A1 dogleg`);
}

if (!source.includes(DOGLEG_AUTHORITY)) {
  // The real Aug. 15 A1 reference does NOT show one straight Rotunda-to-wall
  // sleeve. The fixed terminal structure leaves the real Terminal 4 facade,
  // turns at a fixed elbow, then approaches the remote round Rotunda from the
  // terminal side. The supplied movable Airport_Jetway.glb begins at that
  // Rotunda and remains completely untouched.
  const surfacePattern = /  const rotundaVertices = collectObjectVerticesInFleet\(THREE, fleet, rotunda\);[\s\S]*?  if \(!\(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS\)\) \{\n    throw new Error\(`A1 authored wall-to-Rotunda visible vestibule is not compact: \$\{visibleTerminalLegMeters\}`\);\n  \}/;
  const surfaceReplacement = `  // ${DOGLEG_AUTHORITY}\n  // At the remote Rotunda the fixed terminal corridor must arrive from the\n  // hemisphere opposite the movable aircraft-side bridge. The overall wall to\n  // Rotunda chord is deliberately NOT used as the terminal branch direction:\n  // A1's real fixed corridor contains a visible dogleg before the Rotunda.\n  const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();\n  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);\n  const rotundaTerminalSurfaceMeters = projectedSurfaceDistance(rotundaVertices, rotundaCenter, rotundaTerminalBranchDirection);\n  if (!(rotundaTerminalSurfaceMeters > 0.7 && rotundaTerminalSurfaceMeters < 3.4)) {\n    throw new Error(\`A1 authored Rotunda terminal-facing radius is invalid: \${rotundaTerminalSurfaceMeters}\`);\n  }\n  const rotundaSurfacePoint = rotundaCenter.clone().addScaledVector(rotundaTerminalBranchDirection, rotundaTerminalSurfaceMeters);\n  rotundaSurfacePoint.y = rotundaCenter.y;\n\n  // Put the elbow several metres terminal-side of the Rotunda. This preserves a\n  // clearly legible fixed final approach while allowing the first fixed leg to\n  // originate at the exact measured BGATE1 facade point. No terminal, aircraft,\n  // Rotunda or supplied GLB node is moved to manufacture the turn.\n  const doglegFinalApproachMeters = THREE.MathUtils.clamp(terminalWallDistance * 0.30, 4.2, 7.5);\n  const doglegElbowPoint = rotundaSurfacePoint.clone().addScaledVector(rotundaTerminalBranchDirection, doglegFinalApproachMeters);\n  doglegElbowPoint.y = rotundaCenter.y;\n  const doglegFirstLegDirection = doglegElbowPoint.clone().sub(fixedWallPoint).setY(0);\n  const doglegFirstLegMeters = doglegFirstLegDirection.length();\n  if (!(doglegFirstLegMeters > 1.5 && doglegFirstLegMeters < 42)) {\n    throw new Error(\`A1 photo-authoritative fixed corridor first leg is invalid: \${doglegFirstLegMeters}\`);\n  }\n  doglegFirstLegDirection.normalize();\n  const doglegSecondLegDirection = rotundaSurfacePoint.clone().sub(doglegElbowPoint).setY(0).normalize();\n  const doglegTurnCosine = THREE.MathUtils.clamp(doglegFirstLegDirection.dot(doglegSecondLegDirection), -1, 1);\n  const doglegTurnDegrees = THREE.MathUtils.radToDeg(Math.acos(doglegTurnCosine));\n  if (!(Number.isFinite(doglegTurnDegrees) && doglegTurnDegrees >= 20 && doglegTurnDegrees <= 170)) {\n    throw new Error(\`A1 fixed corridor did not produce the visible photo dogleg: \${doglegTurnDegrees}\`);\n  }\n  const visibleTerminalLegMeters = doglegFirstLegMeters + doglegFinalApproachMeters;\n  if (!(visibleTerminalLegMeters >= ${MINIMUM_TOTAL_CORRIDOR_METERS} && visibleTerminalLegMeters <= ${MAXIMUM_TOTAL_CORRIDOR_METERS})) {\n    throw new Error(\`A1 photo-authoritative fixed dogleg corridor length is invalid: \${visibleTerminalLegMeters}\`);\n  }`;
  if (!surfacePattern.test(source)) {
    throw new Error(`${sourcePath}: straight A1 wall-to-Rotunda surface block was not found for dogleg replacement`);
  }
  source = source.replace(surfacePattern, surfaceReplacement);

  // Rotunda continuity must use the FINAL dogleg leg at the Rotunda, not the
  // straight wall-to-Rotunda chord. The latter is exactly what caused the
  // current-head 58.616 degree same-hemisphere fold-back failure.
  if (!source.includes("terminalDirection.dot(bridgeDirection)")) {
    throw new Error(`${sourcePath}: A1 Rotunda continuity dot product is missing`);
  }
  source = source.replaceAll(
    "terminalDirection.dot(bridgeDirection)",
    "rotundaTerminalBranchDirection.dot(bridgeDirection)",
  );

  const shellPattern = /  const terminalToRotunda = terminalDirection\.clone\(\)\.multiplyScalar\(-1\);[\s\S]*?  shellVector\.normalize\(\);/;
  const shellReplacement = `  // ${DOGLEG_AUTHORITY}: two fixed elevated legs plus a sealed elbow.\n  const firstShellStart = fixedWallPoint.clone().addScaledVector(doglegFirstLegDirection, -TERMINAL_HIDDEN_OVERLAP_METERS);\n  const firstShellEnd = doglegElbowPoint.clone().addScaledVector(doglegFirstLegDirection, ${ELBOW_OVERLAP_METERS});\n  const firstShellVector = firstShellEnd.clone().sub(firstShellStart).setY(0);\n  const firstShellLength = firstShellVector.length();\n  firstShellVector.normalize();\n  const secondShellStart = doglegElbowPoint.clone().addScaledVector(doglegSecondLegDirection, -${ELBOW_OVERLAP_METERS});\n  const secondShellEnd = rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, ROTUNDA_SHELL_OVERLAP_METERS);\n  const secondShellVector = secondShellEnd.clone().sub(secondShellStart).setY(0);\n  const secondShellLength = secondShellVector.length();\n  secondShellVector.normalize();`;
  if (!shellPattern.test(source)) {
    throw new Error(`${sourcePath}: straight A1 shell span was not found for dogleg replacement`);
  }
  source = source.replace(shellPattern, shellReplacement);

  const constructionPattern = /  const frame = addContinuousShell\(THREE, connector, materials, shellStart, shellVector, shellLength, rotundaCenter\.y, width, height\);\n  addCompactRotundaBellows\(THREE, connector, materials, rotundaSurfacePoint\.clone\(\)\.addScaledVector\(terminalToRotunda, 0\.03\), terminalToRotunda, width, height\);/;
  const constructionReplacement = `  const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, rotundaCenter.y, width, height);\n  const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, rotundaCenter.y, width, height);\n  const frame = { ribCount: firstFrame.ribCount + secondFrame.ribCount };\n\n  // A shallow fixed elbow enclosure closes the roof/floor at the change in\n  // direction. Overlapping hollow corridor shells provide the four passage\n  // sides; compact corner posts seal daylight pinholes without blocking the\n  // passenger opening.\n  const elbowJointSpan = width * 1.34;\n  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1FixedCorridorDoglegRoof", [elbowJointSpan, 0.16, elbowJointSpan], doglegElbowPoint.clone().add(new THREE.Vector3(0, height * 0.5, 0)), 0);\n  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1FixedCorridorDoglegFloor", [elbowJointSpan, 0.14, elbowJointSpan], doglegElbowPoint.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), 0);\n  const elbowCornerOffset = width * 0.57;\n  for (const xSign of [-1, 1]) {\n    for (const zSign of [-1, 1]) {\n      addBox(THREE, connector, materials.rib, \`UploadedAirportJetwayA1FixedCorridorDoglegPost_\${xSign}_\${zSign}\`, [0.11, height, 0.11], doglegElbowPoint.clone().add(new THREE.Vector3(xSign * elbowCornerOffset, 0, zSign * elbowCornerOffset)), 0, false);\n    }\n  }\n  addCompactRotundaBellows(THREE, connector, materials, rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, 0.03), doglegSecondLegDirection, width, height);`;
  if (!constructionPattern.test(source)) {
    throw new Error(`${sourcePath}: straight A1 connector construction was not found for dogleg replacement`);
  }
  source = source.replace(constructionPattern, constructionReplacement);

  const telemetryAnchor = "  connector.userData.fixedRealTerminalWall = true;";
  if (!source.includes(telemetryAnchor)) throw new Error(`${sourcePath}: A1 connector telemetry anchor is missing`);
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  connector.userData.photoAuthority = "${DOGLEG_AUTHORITY}";\n  connector.userData.fixedCorridorDogleg = true;\n  connector.userData.fixedCorridorDoglegElbowX = doglegElbowPoint.x;\n  connector.userData.fixedCorridorDoglegElbowZ = doglegElbowPoint.z;\n  connector.userData.fixedCorridorDoglegTurnDegrees = doglegTurnDegrees;\n  connector.userData.fixedCorridorFirstLegMeters = doglegFirstLegMeters;\n  connector.userData.fixedCorridorFinalApproachMeters = doglegFinalApproachMeters;`,
  );

  const groupTelemetryAnchor = "  group.userData.uploadedJetwayA1LongFixedTerminalCorridor = true;";
  if (!source.includes(groupTelemetryAnchor)) throw new Error(`${sourcePath}: A1 group photo telemetry anchor is missing`);
  source = source.replace(
    groupTelemetryAnchor,
    `${groupTelemetryAnchor}\n  group.userData.uploadedJetwayA1FixedCorridorDoglegAuthority = "${DOGLEG_AUTHORITY}";\n  group.userData.uploadedJetwayA1FixedCorridorDogleg = true;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegTurnDegrees = doglegTurnDegrees;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegElbowX = doglegElbowPoint.x;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegElbowZ = doglegElbowPoint.z;`,
  );

  // A1 alone receives this gate-specific long dogleg. Static A3+ connectors are
  // owned by staticSolidTerminalVestibulesV1/registerStaticJetwayFleetToFacadeV1
  // and are intentionally not touched here.
}

for (const required of [
  DOGLEG_AUTHORITY,
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();",
  "const doglegElbowPoint = rotundaSurfacePoint.clone().addScaledVector(rotundaTerminalBranchDirection",
  "const firstFrame = addContinuousShell",
  "const secondFrame = addContinuousShell",
  "UploadedAirportJetwayA1FixedCorridorDoglegRoof",
  "uploadedJetwayA1FixedCorridorDoglegAuthority",
  "rotundaTerminalBranchDirection.dot(bridgeDirection)",
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: A1 dogleg output is missing ${required}`);
}
for (const forbidden of [
  "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength",
  "terminalDirection.dot(bridgeDirection)",
]) {
  if (source.includes(forbidden)) throw new Error(`${sourcePath}: obsolete straight A1 terminal branch survived dogleg preparation: ${forbidden}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${DOGLEG_AUTHORITY}: only A1 now uses two elevated fixed corridor legs and an elbow from the exact BGATE1 facade to the remote supplied Rotunda; A3+ retain their short/direct terminal-side connectors, and Airport_Jetway.glb remains untouched.`);
