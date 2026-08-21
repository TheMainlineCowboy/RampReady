import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const REFERENCE_MATCH_AUTHORITY = "a1-aug15-reference-matched-dogleg-v2";
const SUPPORT_AUTHORITY = "a1-aug15-photo-two-permanent-fixed-support-columns-v1";
const PHOTO_CONNECTOR_STYLE_AUTHORITY = "a1-aug15-photo-dogleg-exactly-two-fixed-support-columns-v1";

let source = fs.readFileSync(sourcePath, "utf8");
if (!source.includes(DOGLEG_AUTHORITY)) {
  throw new Error(`${sourcePath}: ${DOGLEG_AUTHORITY} must exist before installing the photographed A1 supports`);
}

// The Aug. 15 overhead reference shows the fixed-corridor elbow and the aircraft
// on the SAME geometric side of the remote Rotunda. Passenger flow approaches the
// Rotunda from that elbow and then continues out the opposite direction through the
// movable bridge. The prior dogleg generator placed the elbow behind the Rotunda by
// using -bridgeDirection as the elbow-position vector; that folds the path back at
// the Rotunda and is the reason the rendered fixed route does not match the photo.
// Correct only the generated fixed-corridor route here, after the v1 dogleg exists
// and before its permanent supports are placed. Terminal 4, aircraft, Rotunda, and
// every supplied Airport_Jetway.glb child remain fixed.
if (!source.includes(REFERENCE_MATCH_AUTHORITY)) {
  const staleBranch = "  const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();";
  const correctedBranch = `  // ${REFERENCE_MATCH_AUTHORITY}\n  // In the photo the elbow lies on the aircraft-side hemisphere of the Rotunda;\n  // the SECOND LEG direction from elbow -> Rotunda is therefore -bridgeDirection,\n  // giving a straight-through passenger path into the movable bridge rather than\n  // a 180-degree fold-back inside the Rotunda.\n  const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();`;
  if (!source.includes(staleBranch)) {
    throw new Error(`${sourcePath}: stale A1 dogleg branch direction is missing before reference match`);
  }
  source = source.replace(staleBranch, correctedBranch);

  const staleApproach = "  const doglegFinalApproachMeters = THREE.MathUtils.clamp(terminalWallDistance * 0.30, 4.2, 7.5);";
  const correctedApproach = `  // The photographed final diagonal leg is roughly two-fifths of the visible\n  // fixed route, not the short 30% stub used by the earlier heuristic.\n  const doglegFinalApproachMeters = THREE.MathUtils.clamp(terminalWallDistance * 0.40, 6.0, 10.5);`;
  if (!source.includes(staleApproach)) {
    throw new Error(`${sourcePath}: stale A1 dogleg final-approach heuristic is missing before reference match`);
  }
  source = source.replace(staleApproach, correctedApproach);

  const telemetryAnchor = "  group.userData.uploadedJetwayA1FixedCorridorDogleg = true;";
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 dogleg telemetry anchor is missing before reference match`);
  }
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  group.userData.uploadedJetwayA1ReferenceMatchedDoglegAuthority = "${REFERENCE_MATCH_AUTHORITY}";`,
  );
}

if (!source.includes(SUPPORT_AUTHORITY)) {
  const insertionAnchor = "  addCompactRotundaBellows(THREE, connector, materials, rotundaSurfacePoint.clone().addScaledVector(doglegSecondLegDirection, 0.03), doglegSecondLegDirection, width, height);";
  if (!source.includes(insertionAnchor)) {
    throw new Error(`${sourcePath}: A1 dogleg construction anchor is missing; refusing to guess support placement`);
  }

  const supportBlock = `  // ${SUPPORT_AUTHORITY}\n  // The Aug. 15 A1 photo shows the fixed terminal-side structure carried by two\n  // permanent ramp-supported columns before the wheel-supported movable bridge.\n  // Place the pair beneath the final fixed approach to the remote Rotunda; they\n  // support the fixed corridor only and never move with Tunnel A/B/C, Cab or bogie.\n  const supportStation = doglegElbowPoint.clone().lerp(rotundaSurfacePoint, 0.62);\n  supportStation.y = 0;\n  const supportAcross = new THREE.Vector3(doglegSecondLegDirection.z, 0, -doglegSecondLegDirection.x).normalize();\n  const corridorFloorUndersideY = rotundaCenter.y - height * 0.5 - 0.07;\n  const supportRampY = 0;\n  const permanentSupportHeight = corridorFloorUndersideY - supportRampY;\n  // The photographed A1 fixed corridor sits much lower over the ramp than the old\n  // generic 1.8 m minimum assumed. Keep the guard fail-closed for collapsed/negative\n  // geometry, but allow the measured ~1.48 m support height produced by the real\n  // A1 corridor elevation so browser evidence can judge the actual silhouette.\n  if (!(Number.isFinite(permanentSupportHeight) && permanentSupportHeight >= 0.75 && permanentSupportHeight <= 12)) {\n    throw new Error(\`A1 permanent support-column height is invalid: \${permanentSupportHeight}\`);\n  }\n  const permanentSupportSpacing = Math.max(0.72, width * 0.46);\n  const permanentSupportSize = Math.max(0.28, Math.min(0.46, width * 0.13));\n  for (const sideSign of [-1, 1]) {\n    const supportCenter = supportStation.clone().addScaledVector(supportAcross, sideSign * permanentSupportSpacing * 0.5);\n    supportCenter.y = supportRampY + permanentSupportHeight * 0.5;\n    addBox(\n      THREE,\n      connector,\n      materials.rib,\n      \`UploadedAirportJetwayA1PermanentFixedSupportColumn_\${sideSign < 0 ? "Left" : "Right"}\`,\n      [permanentSupportSize, permanentSupportHeight, permanentSupportSize],\n      supportCenter,\n      0,\n      true,\n    );\n    const footingCenter = supportCenter.clone();\n    footingCenter.y = supportRampY + 0.06;\n    addBox(\n      THREE,\n      connector,\n      materials.rib,\n      \`UploadedAirportJetwayA1PermanentFixedSupportFooting_\${sideSign < 0 ? "Left" : "Right"}\`,\n      [permanentSupportSize * 1.8, 0.12, permanentSupportSize * 1.8],\n      footingCenter,\n      0,\n      false,\n    );\n  }\n  connector.userData.permanentFixedSupportAuthority = "${SUPPORT_AUTHORITY}";\n  connector.userData.permanentFixedSupportColumnCount = 2;\n  connector.userData.permanentFixedSupportHeightMeters = permanentSupportHeight;\n  connector.userData.permanentFixedSupportStationX = supportStation.x;\n  connector.userData.permanentFixedSupportStationZ = supportStation.z;\n  group.userData.uploadedJetwayA1PermanentFixedSupportAuthority = "${SUPPORT_AUTHORITY}";\n  group.userData.uploadedJetwayA1PermanentFixedSupportColumnCount = 2;\n  // This existing telemetry field is browser-visible. Give it a photo-specific\n  // authority only after both the dogleg and exactly two fixed supports exist, so\n  // browser acceptance cannot confuse the 25 m A1 route with a generic sleeve.\n  group.userData.uploadedJetwayA1ConnectorStyleAuthority = "${PHOTO_CONNECTOR_STYLE_AUTHORITY}";\n\n${insertionAnchor}`;

  source = source.replace(insertionAnchor, supportBlock);
} else if (!source.includes(PHOTO_CONNECTOR_STYLE_AUTHORITY)) {
  const supportCountAnchor = "  group.userData.uploadedJetwayA1PermanentFixedSupportColumnCount = 2;";
  if (!source.includes(supportCountAnchor)) throw new Error(`${sourcePath}: support-count authority is missing`);
  source = source.replace(
    supportCountAnchor,
    `${supportCountAnchor}\n  group.userData.uploadedJetwayA1ConnectorStyleAuthority = "${PHOTO_CONNECTOR_STYLE_AUTHORITY}";`,
  );
}

for (const required of [
  REFERENCE_MATCH_AUTHORITY,
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();",
  "terminalWallDistance * 0.40",
  "uploadedJetwayA1ReferenceMatchedDoglegAuthority",
  SUPPORT_AUTHORITY,
  PHOTO_CONNECTOR_STYLE_AUTHORITY,
  "UploadedAirportJetwayA1PermanentFixedSupportColumn_",
  "UploadedAirportJetwayA1PermanentFixedSupportFooting_",
  "permanentFixedSupportColumnCount = 2",
  "uploadedJetwayA1PermanentFixedSupportColumnCount = 2",
  "uploadedJetwayA1ConnectorStyleAuthority",
  "supportStation = doglegElbowPoint.clone().lerp(rotundaSurfacePoint, 0.62)",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: photographed A1 permanent-support/reference output is missing ${required}`);
  }
}
if (source.includes("const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();")) {
  throw new Error(`${sourcePath}: stale opposite-hemisphere A1 elbow placement survived reference matching`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared ${REFERENCE_MATCH_AUTHORITY} + ${SUPPORT_AUTHORITY} + ${PHOTO_CONNECTOR_STYLE_AUTHORITY}: A1's fixed elbow is on the same photo hemisphere as the aircraft, its final diagonal leg follows the Aug. 15 route proportion, and exactly two permanent ramp-supported columns remain under the fixed approach; Airport_Jetway.glb is untouched.`);
