import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const ORIENTATION_AUTHORITY = "same-day-photo-cab-pivot-rigid-parent-rotunda-terminal-side-v3";

source = source
  .replace(
    /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-cab-pivot-rigid-parent-grounded-exact-chain-v15";',
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
  `  // Preserve the aircraft-side Cab endpoint while reversing only the complete
  // A1 parent. This keeps every supplied GLB child transform untouched and moves
  // the authored Rotunda to the terminal side instead of dragging it back across
  // the aircraft during photo registration.
  const cabEndpoint = a1Model.getObjectByName("Cab") || a1Model.getObjectByName("Cab_Jetway_0");
  const rotundaEndpoint = a1Model.getObjectByName("Rotunda") || a1Model.getObjectByName("Rotunda_Jetway_0");
  const cabCenterBefore = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const authoredA1ParentYaw = a1Anchor.rotation.y;
  a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS;
  fleet.updateMatrixWorld(true);
  const cabCenterAfterRotation = objectBoundsCenterInFleet(THREE, fleet, cabEndpoint);
  const cabPreservationDelta = cabCenterBefore.clone().sub(cabCenterAfterRotation);
  a1Anchor.position.x += cabPreservationDelta.x;
  a1Anchor.position.z += cabPreservationDelta.z;
  a1Anchor.userData.parentOrientationAuthority = A1_PARENT_ORIENTATION_AUTHORITY;
  a1Anchor.userData.parentOrientationCorrectionRadians = A1_PARENT_ORIENTATION_CORRECTION_RADIANS;
  a1Anchor.userData.authoredParentYawRadians = authoredA1ParentYaw;
  a1Anchor.userData.cabPreservationDeltaX = cabPreservationDelta.x;
  a1Anchor.userData.cabPreservationDeltaZ = cabPreservationDelta.z;
  fleet.updateMatrixWorld(true);

  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
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
  const relocationX = cabPreservationDelta.x;
  const relocationZ = cabPreservationDelta.z;
  const relocationDistance = cabPreservationDelta.length();`,
);

if (!source.includes("a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY")) {
  const reportAnchor = "    a1PhotoRegistrationAuthority: A1_PHOTO_REGISTRATION_AUTHORITY,";
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: report photo-registration anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}\n    a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY,\n    a1ParentOrientationCorrectionRadians: A1_PARENT_ORIENTATION_CORRECTION_RADIANS,`,
  );
}

if (!source.includes("uploadedJetwayA1ParentOrientationAuthority")) {
  const userDataAnchor = "  group.userData.uploadedJetwayA1PhotoRegistrationAuthority = report.a1PhotoRegistrationAuthority;";
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group photo-registration anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}\n  group.userData.uploadedJetwayA1ParentOrientationAuthority = report.a1ParentOrientationAuthority;\n  group.userData.uploadedJetwayA1ParentOrientationCorrectionRadians = report.a1ParentOrientationCorrectionRadians;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-cab-pivot-rigid-parent-grounded-exact-chain-v15"',
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}"`,
  "function objectBoundsCenterInFleet",
  "const cabCenterBefore = objectBoundsCenterInFleet",
  "a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS",
  "const cabPreservationDelta = cabCenterBefore.clone().sub(cabCenterAfterRotation)",
  "rotundaWallDistance + 1 < cabWallDistance",
  "a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY",
  "uploadedJetwayA1ParentOrientationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: cab-pivot rigid-parent output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Prepared A1 cab-pivot rigid-parent correction: Cab remains at the aircraft endpoint, Rotunda is required to be terminal-side, and supplied GLB child transforms remain unchanged.");
