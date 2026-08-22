import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const PHOTO_AUTHORITY = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const REFERENCE_MATCHED_AUTHORITY = "a1-aug15-reference-matched-dogleg-v2";
const ELBOW_OVERLAP_METERS = 0.32;
const MINIMUM_TOTAL_CORRIDOR_METERS = 6;
const MAXIMUM_TOTAL_CORRIDOR_METERS = 48;

let source = fs.readFileSync(sourcePath, "utf8");
if (!source.includes(PHOTO_AUTHORITY)) {
  throw new Error(`${sourcePath}: ${PHOTO_AUTHORITY} must be prepared before the A1 dogleg`);
}

function replaceBetween(startToken, endToken, replacement, label) {
  const start = source.indexOf(startToken);
  const end = source.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`${sourcePath}: ${label} structural anchors are missing`);
  }
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

if (!source.includes(DOGLEG_AUTHORITY)) {
  const surfaceReplacement = `  // ${DOGLEG_AUTHORITY}\n  // The Aug. 15 A1 reference shows a remote Rotunda reached by a long fixed\n  // corridor with a visible elbow. The final fixed leg must approach the\n  // Rotunda from the hemisphere opposite the supplied movable bridge.\n  const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();\n  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);\n  const rotundaTerminalSurfaceMeters = projectedSurfaceDistance(rotundaVertices, rotundaCenter, rotundaTerminalBranchDirection);\n  if (!(rotundaTerminalSurfaceMeters > 0.7 && rotundaTerminalSurfaceMeters < 3.4)) {\n    throw new Error(\`A1 authored Rotunda terminal-facing radius is invalid: \${rotundaTerminalSurfaceMeters}\`);\n  }\n  const rotundaSurfacePoint = rotundaCenter.clone().addScaledVector(rotundaTerminalBranchDirection, rotundaTerminalSurfaceMeters);\n  rotundaSurfacePoint.y = rotundaCenter.y;\n\n  // Keep the elbow several metres terminal-side of the remote Rotunda. The\n  // first leg starts at the exact measured BGATE1 facade point; no terminal,\n  // aircraft, Rotunda, or supplied GLB child is moved to manufacture the turn.\n  const doglegFinalApproachMeters = THREE.MathUtils.clamp(terminalWallDistance * 0.30, 4.2, 7.5);\n  const doglegElbowPoint = rotundaSurfacePoint.clone().addScaledVector(rotundaTerminalBranchDirection, doglegFinalApproachMeters);\n  doglegElbowPoint.y = rotundaCenter.y;\n  const doglegFirstLegDirection = doglegElbowPoint.clone().sub(fixedWallPoint).setY(0);\n  const doglegFirstLegMeters = doglegFirstLegDirection.length();\n  if (!(doglegFirstLegMeters > 1.5 && doglegFirstLegMeters < 42)) {\n    throw new Error(\`A1 photo-authoritative fixed corridor first leg is invalid: \${doglegFirstLegMeters}\`);\n  }\n  doglegFirstLegDirection.normalize();\n  const doglegSecondLegDirection = rotundaSurfacePoint.clone().sub(doglegElbowPoint).setY(0).normalize();\n  const doglegTurnCosine = THREE.MathUtils.clamp(doglegFirstLegDirection.dot(doglegSecondLegDirection), -1, 1);\n  const doglegTurnDegrees = THREE.MathUtils.radToDeg(Math.acos(doglegTurnCosine));\n  if (!(Number.isFinite(doglegTurnDegrees) && doglegTurnDegrees >= 20 && doglegTurnDegrees <= 170)) {\n    throw new Error(\`A1 fixed corridor did not produce the visible photo dogleg: \${doglegTurnDegrees}\`);\n  }\n  const visibleTerminalLegMeters = doglegFirstLegMeters + doglegFinalApproachMeters;\n  if (!(visibleTerminalLegMeters >= ${MINIMUM_TOTAL_CORRIDOR_METERS} && visibleTerminalLegMeters <= ${MAXIMUM_TOTAL_CORRIDOR_METERS})) {\n    throw new Error(\`A1 photo-authoritative fixed dogleg corridor length is invalid: \${visibleTerminalLegMeters}\`);\n  }\n\n`;
  replaceBetween(
    "  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);",
    "  const rotundaBridgeSurfaceMeters = projectedSurfaceDistance(",
    surfaceReplacement,
    "Rotunda surface/dogleg",
  );

  if (!source.includes("terminalDirection.dot(bridgeDirection)")) {
    throw new Error(`${sourcePath}: A1 Rotunda continuity dot product is missing`);
  }
  // This continuity guard occurs earlier in the function than the Rotunda
  // surface solve. Do not reference rotundaTerminalBranchDirection here or the
  // browser bundle hits a temporal-dead-zone before that const is initialized.
  // The dogleg's final branch is defined exactly as -bridgeDirection, so express
  // that same physical invariant inline at this earlier guard.
  source = source.replaceAll(
    "terminalDirection.dot(bridgeDirection)",
    "bridgeDirection.clone().multiplyScalar(-1).normalize().dot(bridgeDirection)",
  );

  const shellReplacement = `  // ${DOGLEG_AUTHORITY}: two elevated fixed legs plus a sealed elbow.\n  const firstShellStart = fixedWallPoint.clone().addScaledVector(doglegFirstLegDirection, -TERMINAL_HIDDEN_OVERLAP_METERS);\n  const firstShellEnd = doglegElbowPoint.clone().addScaledVector(doglegFirstLegDirection, ${ELBOW_OVERLAP_METERS});\n  const firstShellVector = firstShellEnd.clone().sub(firstShellStart).setY(0);\n  const firstShellLength = firstShellVector.length();\n  firstShellVector.normalize();\n  const secondShellStart = doglegElbowPoint.clone().addScaledVector(doglegSecondLegDirection, -${ELBOW_OVERLAP_METERS});\n  const secondShellEnd = rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, ROTUNDA_SHELL_OVERLAP_METERS);\n  const secondShellVector = secondShellEnd.clone().sub(secondShellStart).setY(0);\n  const secondShellLength = secondShellVector.length();\n  secondShellVector.normalize();\n\n  // Preserve the exact supplied Rotunda-to-Tunnel-A flexible joint setup. The\n  // dogleg replaces only the fixed terminal-side shell; it must not delete or\n  // recreate the movable-bridge bellows coordinates or generated-object cleanup.\n  const bridgeSealStartFleet = rotundaBridgeSurfacePoint.clone().addScaledVector(bridgeDirection, -ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS);\n  const bridgeSealEndFleet = tunnelRotundaSurfacePoint.clone().addScaledVector(bridgeDirection, TUNNEL_A_HIDDEN_OVERLAP_METERS);\n  const bridgeSealStartLocal = pointFromFleetToObjectLocal(fleet, anchor, bridgeSealStartFleet);\n  const bridgeSealEndLocal = pointFromFleetToObjectLocal(fleet, anchor, bridgeSealEndFleet);\n  const bridgeSealVectorLocal = bridgeSealEndLocal.clone().sub(bridgeSealStartLocal);\n  bridgeSealVectorLocal.y = 0;\n  const bridgeSealLengthMeters = bridgeSealVectorLocal.length();\n  if (!(bridgeSealLengthMeters > 0.08 && bridgeSealLengthMeters < MAXIMUM_ROTUNDA_TUNNEL_A_GAP_METERS + 1)) {\n    throw new Error(\`A1 Rotunda-to-Tunnel-A bellows sleeve length is invalid: \${bridgeSealLengthMeters}\`);\n  }\n  bridgeSealVectorLocal.normalize();\n\n  const removedGeneratedTerminalObjects = removeGeneratedA1TerminalGeometry(fleet);\n`;
  replaceBetween(
    "  const terminalToRotunda = terminalDirection.clone().multiplyScalar(-1);",
    "  const materials = createMaterials(THREE);",
    shellReplacement,
    "straight shell span",
  );

  const constructionReplacement = `  const firstFrame = addContinuousShell(THREE, connector, materials, firstShellStart, firstShellVector, firstShellLength, rotundaCenter.y, width, height);\n  const secondFrame = addContinuousShell(THREE, connector, materials, secondShellStart, secondShellVector, secondShellLength, rotundaCenter.y, width, height);\n  const frame = { ribCount: firstFrame.ribCount + secondFrame.ribCount };\n\n  // Overlapping hollow corridor shells keep the passenger passage open. The\n  // elbow receives a fixed roof/floor cap and four slim posts so there is no\n  // daylight hole or apron-facing opening at the turn.\n  const elbowJointSpan = width * 1.34;\n  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1FixedCorridorDoglegRoof", [elbowJointSpan, 0.16, elbowJointSpan], doglegElbowPoint.clone().add(new THREE.Vector3(0, height * 0.5, 0)), 0);\n  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1FixedCorridorDoglegFloor", [elbowJointSpan, 0.14, elbowJointSpan], doglegElbowPoint.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), 0);\n  const elbowCornerOffset = width * 0.57;\n  for (const xSign of [-1, 1]) {\n    for (const zSign of [-1, 1]) {\n      addBox(THREE, connector, materials.rib, \`UploadedAirportJetwayA1FixedCorridorDoglegPost_\${xSign}_\${zSign}\`, [0.11, height, 0.11], doglegElbowPoint.clone().add(new THREE.Vector3(xSign * elbowCornerOffset, 0, zSign * elbowCornerOffset)), 0, false);\n    }\n  }\n  addCompactRotundaBellows(THREE, connector, materials, rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, 0.03), doglegSecondLegDirection, width, height);\n`;
  replaceBetween(
    "  const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, rotundaCenter.y, width, height);",
    "  connector.userData.authority = CONNECTOR_AUTHORITY;",
    constructionReplacement,
    "straight connector construction",
  );

  const connectorTelemetryAnchor = "  connector.userData.fixedRealTerminalWall = true;";
  if (!source.includes(connectorTelemetryAnchor)) throw new Error(`${sourcePath}: A1 connector telemetry anchor is missing`);
  source = source.replace(
    connectorTelemetryAnchor,
    `${connectorTelemetryAnchor}\n  connector.userData.photoAuthority = "${DOGLEG_AUTHORITY}";\n  connector.userData.fixedCorridorDogleg = true;\n  connector.userData.fixedCorridorDoglegElbowX = doglegElbowPoint.x;\n  connector.userData.fixedCorridorDoglegElbowZ = doglegElbowPoint.z;\n  connector.userData.fixedCorridorDoglegTurnDegrees = doglegTurnDegrees;\n  connector.userData.fixedCorridorFirstLegMeters = doglegFirstLegMeters;\n  connector.userData.fixedCorridorFinalApproachMeters = doglegFinalApproachMeters;`,
  );

  const groupTelemetryAnchor = "  group.userData.uploadedJetwayA1LongFixedTerminalCorridor = true;";
  if (!source.includes(groupTelemetryAnchor)) throw new Error(`${sourcePath}: A1 group photo telemetry anchor is missing`);
  source = source.replace(
    groupTelemetryAnchor,
    `${groupTelemetryAnchor}\n  group.userData.uploadedJetwayA1FixedCorridorDoglegAuthority = "${DOGLEG_AUTHORITY}";\n  group.userData.uploadedJetwayA1FixedCorridorDogleg = true;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegTurnDegrees = doglegTurnDegrees;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegElbowX = doglegElbowPoint.x;\n  group.userData.uploadedJetwayA1FixedCorridorDoglegElbowZ = doglegElbowPoint.z;`,
  );
}

const referenceMatched = source.includes(REFERENCE_MATCHED_AUTHORITY);
const requiredOutput = [
  DOGLEG_AUTHORITY,
  "const doglegElbowPoint =",
  "const firstFrame = addContinuousShell",
  "const secondFrame = addContinuousShell",
  "UploadedAirportJetwayA1FixedCorridorDoglegRoof",
  "uploadedJetwayA1FixedCorridorDoglegAuthority",
  "const bridgeSealStartLocal = pointFromFleetToObjectLocal",
  "const bridgeSealEndLocal = pointFromFleetToObjectLocal",
  "const removedGeneratedTerminalObjects = removeGeneratedA1TerminalGeometry(fleet);",
];
if (referenceMatched) {
  requiredOutput.push(REFERENCE_MATCHED_AUTHORITY);
} else {
  requiredOutput.push(
    "const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();",
    "const doglegElbowPoint = rotundaSurfacePoint.clone().addScaledVector(rotundaTerminalBranchDirection",
    "bridgeDirection.clone().multiplyScalar(-1).normalize().dot(bridgeDirection)",
  );
}
for (const required of requiredOutput) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: A1 dogleg output is missing ${required}`);
}

const forbiddenOutput = [
  "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength",
  "terminalDirection.dot(bridgeDirection)",
  "rotundaTerminalBranchDirection.dot(bridgeDirection)",
];
if (referenceMatched) {
  // v2 intentionally replaces the v1 opposite-hemisphere terminal branch with
  // the Aug. 15 reference-matched aircraft-side elbow geometry. A repeated v1
  // preparation pass must validate that newer authority rather than demanding
  // the retired branch expression and aborting production before rendering.
  forbiddenOutput.push("const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();");
}
for (const forbidden of forbiddenOutput) {
  if (source.includes(forbidden)) throw new Error(`${sourcePath}: obsolete/TDZ-prone straight A1 terminal branch survived dogleg preparation: ${forbidden}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${DOGLEG_AUTHORITY}${referenceMatched ? ` with ${REFERENCE_MATCHED_AUTHORITY} preserved` : ""}: only A1 uses the photo-authoritative fixed corridor dogleg; A3+ retain their short/direct terminal-side connectors, Airport_Jetway.glb remains untouched, and repeated production preparation cannot re-impose the retired opposite-hemisphere v1 branch.`);
