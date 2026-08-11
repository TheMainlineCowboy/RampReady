import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const ORIENTATION_AUTHORITY = "same-day-photo-authored-opening-fixed-rotunda-elbow-terminal-aligned-v7";
const MIN_TERMINAL_ALIGNMENT = 0.985;

source = source
  .replace(
    /const INSTALLATION_AUTHORITY = "[^"]+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-fixed-rotunda-elbow-grounded-exact-chain-v17";',
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
    `${constantAnchor}\nconst A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}";\nconst A1_PARENT_ORIENTATION_CORRECTION_RADIANS = 0;`,
  );
}

if (!source.includes("function objectBoundsCenterInFleet")) {
  const helperAnchor = "function captureAuthoredPartTransforms(a1Model) {";
  if (!source.includes(helperAnchor)) throw new Error(`${installationPath}: authored-transform helper anchor is missing`);
  source = source.replace(
    helperAnchor,
    `function objectBoundsCenterInFleet(THREE, fleet, object) {
  if (!object) throw new Error("A1 Rotunda articulation is missing an authored endpoint");
  fleet.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(\`A1 articulated endpoint has empty bounds: \${object.name || "unnamed"}\`);
  const center = bounds.getCenter(new THREE.Vector3());
  fleet.worldToLocal(center);
  return center;
}

${helperAnchor}`,
  );
}

// The terminal-opening measurement must accept the physically articulated
// Rotunda portal direction. Inferring the opening from the post-articulation
// Rotunda-to-Tunnel-A centerline would simply recreate the old rigid-parent
// assumption and point the connector at the side of the Rotunda again.
if (source.includes("function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection) {")) {
  source = source.replace(
    "function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection) {",
    "function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection, alignedOpeningDirection = null) {",
  );
}
const looseOpeningBlock = `  // The terminal opening is the authored side of the Rotunda opposite Tunnel A.
  // Never flip this vector to make a backwards installation pass validation.
  const openingDirection = bridgeDirection.clone().multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < 0.4) {
    throw new Error(\`A1 exact authored Rotunda opening does not face the measured terminal wall: \${terminalFacingDot}\`);
  }`;
const physicalOpeningBlock = `  // The terminal opening is the supplied Rotunda aperture direction. Once A1's
  // legitimate elbow articulation has been applied, use that physical direction
  // instead of re-inferring it from Tunnel A's centerline.
  const openingDirection = alignedOpeningDirection?.clone().normalize()
    || bridgeDirection.clone().multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 exact authored Rotunda opening is not aligned to the measured terminal wall: \${terminalFacingDot}\`);
  }`;
if (source.includes(looseOpeningBlock)) {
  source = source.replace(looseOpeningBlock, physicalOpeningBlock);
} else if (!source.includes("alignedOpeningDirection?.clone().normalize()")) {
  throw new Error(`${installationPath}: Rotunda opening measurement is not in a recognized pre-articulation form`);
}

// Continuity must be measured from the physically installed elbow pose, not from
// the straight/default GLB pose. The legitimate Rotunda yaw happens before this
// baseline is recaptured; every later stage must then preserve all five supplied
// transforms exactly from that installed pose.
if (source.includes("  const beforeTransforms = captureAuthoredPartTransforms(a1Model);")) {
  source = source.replace(
    "  const beforeTransforms = captureAuthoredPartTransforms(a1Model);",
    "  let beforeTransforms = captureAuthoredPartTransforms(a1Model);",
  );
}

const photoBlockPattern = /  \/\/ Measure the exact supplied Rotunda before moving A1\.[\s\S]*?  connector\.userData\.photoVisibleVestibuleMeters = actualVisibleVestibuleMeters;/;
if (!photoBlockPattern.test(source)) {
  throw new Error(`${installationPath}: generated photo-registration block is missing`);
}

source = source.replace(
  photoBlockPattern,
  `  // A1 is a real elbow. Keep the decoded/aircraft-side Tunnel A/B/C/Cab pose
  // untouched and yaw ONLY the supplied Rotunda about its exact mesh centroid so
  // the actual terminal aperture (opposite Tunnel A in the authored straight GLB)
  // faces the measured Terminal 4 structural wall.
  const cabEndpoint = a1Model.getObjectByName("Cab") || a1Model.getObjectByName("Cab_Jetway_0");
  const rotundaEndpoint = a1Model.getObjectByName("Rotunda") || a1Model.getObjectByName("Rotunda_Jetway_0");
  const rotundaRoot = a1Model.getObjectByName("Rotunda");
  const rotundaAxisMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  const tunnelAAxisMesh = a1Model.getObjectByName("Tunnel_A_Jetway_0");
  if (!rotundaRoot?.isObject3D || !rotundaRoot.parent || !rotundaAxisMesh?.isMesh || !tunnelAAxisMesh?.isMesh) {
    throw new Error("A1 Rotunda elbow articulation requires the supplied Rotunda root/mesh and Tunnel A mesh");
  }

  fleet.updateMatrixWorld(true);
  const rotundaCenterBefore = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaAxisMesh),
  );
  const tunnelAAxisCenter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, tunnelAAxisMesh),
  );
  const authoredOpeningBefore = rotundaCenterBefore.clone().sub(tunnelAAxisCenter);
  authoredOpeningBefore.y = 0;
  if (authoredOpeningBefore.lengthSq() < 0.25) {
    throw new Error("A1 measured authored Rotunda terminal aperture axis is degenerate");
  }
  authoredOpeningBefore.normalize();

  const terminalAlignmentYawRadians = Math.atan2(
    authoredOpeningBefore.z * terminalDirection.x - authoredOpeningBefore.x * terminalDirection.z,
    authoredOpeningBefore.x * terminalDirection.x + authoredOpeningBefore.z * terminalDirection.z,
  );
  const terminalFacingDotBefore = authoredOpeningBefore.dot(terminalDirection);
  const rotundaWorldQuaternionBefore = rotundaRoot.getWorldQuaternion(new THREE.Quaternion());
  const rotundaYawCorrection = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    terminalAlignmentYawRadians,
  );
  const desiredRotundaWorldQuaternion = rotundaYawCorrection.multiply(rotundaWorldQuaternionBefore.clone());
  const rotundaParentWorldQuaternion = rotundaRoot.parent.getWorldQuaternion(new THREE.Quaternion());
  const desiredRotundaLocalQuaternion = rotundaParentWorldQuaternion.clone().invert().multiply(desiredRotundaWorldQuaternion);
  rotundaRoot.quaternion.copy(desiredRotundaLocalQuaternion);
  rotundaRoot.updateMatrix();
  fleet.updateMatrixWorld(true);

  // The exported Rotunda node pivot is not exactly at the visible mesh centroid.
  // Counter-translation keeps the terminal joint at precisely the same wall-fit
  // point while changing only its yaw.
  const rotundaCenterAfterYaw = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaAxisMesh),
  );
  const desiredRotundaWorldCenter = fleet.localToWorld(rotundaCenterBefore.clone());
  const currentRotundaWorldCenter = fleet.localToWorld(rotundaCenterAfterYaw.clone());
  const desiredRotundaParentCenter = rotundaRoot.parent.worldToLocal(desiredRotundaWorldCenter.clone());
  const currentRotundaParentCenter = rotundaRoot.parent.worldToLocal(currentRotundaWorldCenter.clone());
  rotundaRoot.position.add(desiredRotundaParentCenter.sub(currentRotundaParentCenter));
  rotundaRoot.updateMatrix();
  fleet.updateMatrixWorld(true);

  const rotundaCenterAfter = vertexCentroid(
    THREE,
    transformedGeometryVertices(THREE, fleet, rotundaAxisMesh),
  );
  const rotundaCenterPreservationErrorMeters = rotundaCenterAfter.distanceTo(rotundaCenterBefore);
  if (rotundaCenterPreservationErrorMeters > 0.002) {
    throw new Error(\`A1 Rotunda moved while articulating its terminal aperture: \${rotundaCenterPreservationErrorMeters}\`);
  }

  const alignedOpeningDirection = authoredOpeningBefore.clone().applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    terminalAlignmentYawRadians,
  ).normalize();
  const measuredTerminalAlignment = alignedOpeningDirection.dot(terminalDirection);
  if (measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}) {
    throw new Error(\`A1 authored Rotunda aperture did not face the terminal after elbow articulation: \${measuredTerminalAlignment}\`);
  }

  // Establish the accepted five-part transform baseline AFTER the legitimate
  // Rotunda articulation. Any later transform of Rotunda or Tunnel A/B/C/Cab is
  // still fail-closed by the existing exact-chain continuity verifier.
  beforeTransforms = captureAuthoredPartTransforms(a1Model);

  const rotundaOpening = measureExactRotundaOpening(
    THREE,
    fleet,
    a1Model,
    terminalDirection,
    alignedOpeningDirection,
  );
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const wallOffsetX = terminalWallX - rotundaOpening.centerX;
  const wallOffsetZ = terminalWallZ - rotundaOpening.centerZ;
  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  if (!(terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12)) {
    throw new Error(\`A1 fixed-Rotunda terminal span is invalid: \${terminalDistance}\`);
  }

  const rotundaCenterForWall = objectBoundsCenterInFleet(THREE, fleet, rotundaEndpoint);
  const cabCenterAfter = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const rotundaWallDistance = Math.hypot(terminalWallX - rotundaCenterForWall.x, terminalWallZ - rotundaCenterForWall.z);
  const cabWallDistance = Math.hypot(terminalWallX - cabCenterAfter.x, terminalWallZ - cabCenterAfter.z);
  if (!(rotundaWallDistance + 1 < cabWallDistance)) {
    throw new Error(\`A1 elbow orientation still leaves the Rotunda aircraft-side: rotunda=\${rotundaWallDistance}, cab=\${cabWallDistance}\`);
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
  connector.userData.terminalFacingDotBefore = terminalFacingDotBefore;
  connector.userData.rotundaCenterPreservationErrorMeters = rotundaCenterPreservationErrorMeters;

  // Compatibility telemetry names are retained, but the correction now belongs
  // to the legitimate Rotunda elbow rather than the whole A1 parent.
  const authoredA1ParentYaw = a1Anchor.rotation.y;
  const cabPreservationDelta = new THREE.Vector3(0, 0, 0);
  a1Anchor.userData.parentOrientationAuthority = A1_PARENT_ORIENTATION_AUTHORITY;
  a1Anchor.userData.parentOrientationCorrectionRadians = terminalAlignmentYawRadians;
  a1Anchor.userData.authoredParentYawRadians = authoredA1ParentYaw;
  a1Anchor.userData.measuredTerminalAlignmentYawRadians = terminalAlignmentYawRadians;
  a1Anchor.userData.minimumTerminalAlignment = ${MIN_TERMINAL_ALIGNMENT};
  a1Anchor.userData.cabPreservationDeltaX = 0;
  a1Anchor.userData.cabPreservationDeltaZ = 0;
  a1Anchor.userData.rotundaElbowArticulated = true;
  a1Anchor.userData.rotundaTerminalFacingDotBefore = terminalFacingDotBefore;
  a1Anchor.userData.rotundaTerminalFacingDot = measuredTerminalAlignment;
  a1Anchor.userData.rotundaCenterPreservationErrorMeters = rotundaCenterPreservationErrorMeters;
  const relocationX = 0;
  const relocationZ = 0;
  const relocationDistance = 0;`,
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
  'INSTALLATION_AUTHORITY = "photo-registered-fixed-rotunda-elbow-grounded-exact-chain-v17"',
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}"`,
  "function objectBoundsCenterInFleet",
  "alignedOpeningDirection = null",
  "const rotundaRoot = a1Model.getObjectByName(\"Rotunda\")",
  "const authoredOpeningBefore = rotundaCenterBefore.clone().sub(tunnelAAxisCenter)",
  "const terminalAlignmentYawRadians = Math.atan2",
  "rotundaRoot.quaternion.copy(desiredRotundaLocalQuaternion)",
  "rotundaRoot.position.add(desiredRotundaParentCenter.sub(currentRotundaParentCenter))",
  `measuredTerminalAlignment < ${MIN_TERMINAL_ALIGNMENT}`,
  "beforeTransforms = captureAuthoredPartTransforms(a1Model)",
  "rotundaWallDistance + 1 < cabWallDistance",
  "a1Anchor.userData.rotundaElbowArticulated = true",
  "const relocationX = 0;",
  "a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY",
  "uploadedJetwayA1MeasuredTerminalAlignmentYawRadians",
  "uploadedJetwayA1MinimumTerminalAlignment",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: fixed-Rotunda elbow output is missing ${token}`);
}
for (const forbidden of [
  "a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS",
  "a1Anchor.rotation.y += terminalAlignmentYawRadians",
  "terminalFacingDot < 0.4",
  "measuredOpeningDirection.dot(terminalDirection) < 0",
]) {
  if (source.includes(forbidden)) throw new Error(`${installationPath}: rigid-parent/backwards Rotunda assumption survived: ${forbidden}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared A1 as a physical Rotunda elbow: Tunnel A/B/C/Cab remain untouched while the supplied Rotunda terminal aperture yaws about its fixed centroid to >=${MIN_TERMINAL_ALIGNMENT.toFixed(3)} alignment with the measured Terminal 4 wall.`);
