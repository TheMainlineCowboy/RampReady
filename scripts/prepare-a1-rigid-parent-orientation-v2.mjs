import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const ORIENTATION_AUTHORITY = "same-day-photo-authored-opening-cab-pivot-rigid-parent-terminal-aligned-v6";
const MIN_TERMINAL_ALIGNMENT = 0.98;

source = source
  .replace(
    /const INSTALLATION_AUTHORITY = "[^"]+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-cab-pivot-rigid-parent-grounded-exact-chain-v16";',
  )
  .replace(
    /const A1_PARENT_ORIENTATION_AUTHORITY = "[^"]+";/,
    `const A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}";`,
  );

if (!source.includes("A1_PARENT_ORIENTATION_AUTHORITY")) {
  const constantAnchor = 'const A1_PHOTO_REGISTRATION_AUTHORITY = "same-day-photo-a1-terminal-corner-registration-v6";';
  if (!source.includes(constantAnchor)) throw new Error(`${installationPath}: photo-registration authority anchor is missing`);
  source = source.replace(
    constantAnchor,
    `${constantAnchor}\nconst A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}";\nconst A1_PARENT_ORIENTATION_CORRECTION_RADIANS = Math.PI;`,
  );
}

if (!source.includes("function objectBoundsCenterInFleet")) {
  const helperAnchor = "function captureAuthoredPartTransforms(a1Model) {";
  if (!source.includes(helperAnchor)) throw new Error(`${installationPath}: authored-transform helper anchor is missing`);
  source = source.replace(
    helperAnchor,
    `function objectBoundsCenterInFleet(THREE, fleet, object) {
  if (!object) throw new Error("A1 rigid-parent orientation is missing an authored endpoint");
  fleet.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(\`A1 rigid-parent endpoint has empty bounds: \${object.name || "unnamed"}\`);
  const center = bounds.getCenter(new THREE.Vector3());
  fleet.worldToLocal(center);
  return center;
}

${helperAnchor}`,
  );
}

const photoBlockPattern = /  \/\/ Measure the exact supplied Rotunda before moving A1\.[\s\S]*?  connector\.userData\.photoVisibleVestibuleMeters = actualVisibleVestibuleMeters;/;
if (!photoBlockPattern.test(source)) {
  throw new Error(`${installationPath}: generated photo-registration block is missing`);
}

source = source.replace(
  photoBlockPattern,
  `  // Rotate only the complete A1 parent. First reverse the authored installation,
  // then measure the exact authored Rotunda opening opposite Tunnel A and apply
  // the remaining yaw needed to point that side directly at the terminal wall.
  // Never invert the measured vector merely to satisfy the terminal dot product:
  // that allowed a backwards bridge to pass the previous numeric gate.
  // Both rotations are compensated around the supplied Cab endpoint, so every
  // GLB child transform remains untouched and the aircraft-side endpoint stays fixed.
  const cabEndpoint = a1Model.getObjectByName("Cab") || a1Model.getObjectByName("Cab_Jetway_0");
  const rotundaEndpoint = a1Model.getObjectByName("Rotunda") || a1Model.getObjectByName("Rotunda_Jetway_0");
  const rotundaAxisMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  const tunnelAAxisMesh = a1Model.getObjectByName("Tunnel_A_Jetway_0");
  if (!rotundaAxisMesh?.isMesh || !tunnelAAxisMesh?.isMesh) {
    throw new Error("A1 measured parent orientation requires the exact Rotunda and Tunnel A meshes");
  }

  const cabCenterBefore = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const authoredA1ParentYaw = a1Anchor.rotation.y;
  a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS;
  fleet.updateMatrixWorld(true);
  const cabCenterAfterInitialRotation = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const initialCabPreservationDelta = cabCenterBefore.clone().sub(cabCenterAfterInitialRotation);
  a1Anchor.position.x += initialCabPreservationDelta.x;
  a1Anchor.position.z += initialCabPreservationDelta.z;
  fleet.updateMatrixWorld(true);

  const rotundaAxisCenter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaAxisMesh),
  );
  const tunnelAAxisCenter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, tunnelAAxisMesh),
  );
  const measuredOpeningDirection = rotundaAxisCenter.clone().sub(tunnelAAxisCenter);
  measuredOpeningDirection.y = 0;
  if (measuredOpeningDirection.lengthSq() < 0.25) {
    throw new Error("A1 measured authored Rotunda opening axis is degenerate");
  }
  measuredOpeningDirection.normalize();

  const terminalAlignmentYawRadians = Math.atan2(
    measuredOpeningDirection.z * terminalDirection.x
      - measuredOpeningDirection.x * terminalDirection.z,
    measuredOpeningDirection.x * terminalDirection.x
      + measuredOpeningDirection.z * terminalDirection.z,
  );
  const terminalAlignmentCabCenterBefore = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  a1Anchor.rotation.y += terminalAlignmentYawRadians;
  fleet.updateMatrixWorld(true);
  const terminalAlignmentCabCenterAfter = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const terminalAlignmentCabDelta = terminalAlignmentCabCenterBefore.clone().sub(terminalAlignmentCabCenterAfter);
  a1Anchor.position.x += terminalAlignmentCabDelta.x;
  a1Anchor.position.z += terminalAlignmentCabDelta.z;
  fleet.updateMatrixWorld(true);

  const cabPreservationDelta = initialCabPreservationDelta.clone().add(terminalAlignmentCabDelta);
  a1Anchor.userData.parentOrientationAuthority = A1_PARENT_ORIENTATION_AUTHORITY;
  a1Anchor.userData.parentOrientationCorrectionRadians = A1_PARENT_ORIENTATION_CORRECTION_RADIANS
    + terminalAlignmentYawRadians;
  a1Anchor.userData.authoredParentYawRadians = authoredA1ParentYaw;
  a1Anchor.userData.measuredTerminalAlignmentYawRadians = terminalAlignmentYawRadians;
  a1Anchor.userData.minimumTerminalAlignment = ${MIN_TERMINAL_ALIGNMENT};
  a1Anchor.userData.cabPreservationDeltaX = cabPreservationDelta.x;
  a1Anchor.userData.cabPreservationDeltaZ = cabPreservationDelta.z;

  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const measuredTerminalAlignment = rotundaOpening.openingDirectionX * terminalDirection.x
    + rotundaOpening.openingDirectionZ * terminalDirection.z;
  if (measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda opening did not face the terminal after parent rotation: \${measuredTerminalAlignment}\`);
  }
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  if (!(terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12)) {
    throw new Error(\`A1 cab-pivot terminal span is invalid: \${terminalDistance}\`);
  }

  const rotundaCenterAfter = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);
  const cabCenterAfter = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const rotundaWallDistance = Math.hypot(terminalWallX - rotundaCenterAfter.x, terminalWallZ - rotundaCenterAfter.z);
  const cabWallDistance = Math.hypot(terminalWallX - cabCenterAfter.x, terminalWallZ - cabCenterAfter.z);
  if (!(rotundaWallDistance + 1 < cabWallDistance)) {
    throw new Error(\`A1 rigid-parent orientation still leaves the Rotunda aircraft-side: rotunda=\${rotundaWallDistance}, cab=\${cabWallDistance}\`);
  }

  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });
  const connector = buildMeasuredA1Connector(
    THREE,
    fleet,
    correctedA1Placement,
    rotundaOpening,
    terminalDirection,
    terminalDistance,
  );
  connector.userData.visibleMainLengthMeters = actualVisibleVestibuleMeters;
  connector.userData.photoVisibleVestibuleMeters = actualVisibleVestibuleMeters;
  connector.userData.rotundaWallDistanceMeters = rotundaWallDistance;
  connector.userData.cabWallDistanceMeters = cabWallDistance;
  connector.userData.measuredTerminalAlignment = measuredTerminalAlignment;
  const relocationX = cabPreservationDelta.x;
  const relocationZ = cabPreservationDelta.z;
  const relocationDistance = cabPreservationDelta.length();`,
);

if (!source.includes("a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY")) {
  const reportAnchor = "    a1PhotoRegistrationAuthority: A1_PHOTO_REGISTRATION_AUTHORITY,";
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: report photo-registration anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}\n    a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY,\n    a1ParentOrientationCorrectionRadians: a1Anchor.userData.parentOrientationCorrectionRadians,\n    a1MeasuredTerminalAlignmentYawRadians: a1Anchor.userData.measuredTerminalAlignmentYawRadians,\n    a1MinimumTerminalAlignment: a1Anchor.userData.minimumTerminalAlignment,`,
  );
}

if (!source.includes("uploadedJetwayA1ParentOrientationAuthority")) {
  const userDataAnchor = "  group.userData.uploadedJetwayA1PhotoRegistrationAuthority = report.a1PhotoRegistrationAuthority;";
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group photo-registration anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}\n  group.userData.uploadedJetwayA1ParentOrientationAuthority = report.a1ParentOrientationAuthority;\n  group.userData.uploadedJetwayA1ParentOrientationCorrectionRadians = report.a1ParentOrientationCorrectionRadians;\n  group.userData.uploadedJetwayA1MeasuredTerminalAlignmentYawRadians = report.a1MeasuredTerminalAlignmentYawRadians;\n  group.userData.uploadedJetwayA1MinimumTerminalAlignment = report.a1MinimumTerminalAlignment;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-cab-pivot-rigid-parent-grounded-exact-chain-v16"',
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}"`,
  "function objectBoundsCenterInFleet",
  "const cabCenterBefore = objectBoundsCenterInFleet",
  "a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS",
  "const measuredOpeningDirection = rotundaAxisCenter.clone().sub(tunnelAAxisCenter)",
  "const terminalAlignmentYawRadians = Math.atan2",
  "a1Anchor.rotation.y += terminalAlignmentYawRadians",
  "const cabPreservationDelta = initialCabPreservationDelta.clone().add(terminalAlignmentCabDelta)",
  `measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  "rotundaWallDistance + 1 < cabWallDistance",
  "a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY",
  "uploadedJetwayA1MeasuredTerminalAlignmentYawRadians",
  "uploadedJetwayA1MinimumTerminalAlignment",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: authored-opening cab-pivot rigid-parent output is missing ${token}`);
}
if (source.includes("measuredOpeningDirection.dot(terminalDirection) < 0")) {
  throw new Error(`${installationPath}: authored Rotunda opening direction is still sign-flipped`);
}
if (source.includes("measuredTerminalAlignment < 0.995")) {
  throw new Error(`${installationPath}: obsolete 0.995 terminal-alignment gate remains`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared authored-opening A1 cab-pivot correction with a ${MIN_TERMINAL_ALIGNMENT.toFixed(2)} terminal-facing floor and unchanged GLB children.`);
