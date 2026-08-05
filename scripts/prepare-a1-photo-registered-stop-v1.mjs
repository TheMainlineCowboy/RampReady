import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const PHOTO_FIXED_VESTIBULE_METERS = 2.4;
const PHOTO_REGISTRATION_AUTHORITY = "same-day-photo-a1-terminal-corner-registration-v1";

source = source
  .replace(
    'const INSTALLATION_AUTHORITY = "measured-terminal-facade-short-connector-grounded-exact-chain-v7";',
    'const INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v8";',
  )
  .replace(
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-short-solid-terminal-vestibule-v6";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-vestibule-v7";',
  );

if (!source.includes("A1_PHOTO_FIXED_VESTIBULE_METERS")) {
  const anchor = "const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;";
  if (!source.includes(anchor)) throw new Error(`${installationPath}: ground-correction constant anchor is missing`);
  source = source.replace(
    anchor,
    `${anchor}\nconst A1_PHOTO_FIXED_VESTIBULE_METERS = ${PHOTO_FIXED_VESTIBULE_METERS};\nconst A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}";`,
  );
}

if (!source.includes("const sourceTerminalDistance = Number(a1Placement.wallConnectorLength)")) {
  const distancePattern = /  const terminalDistance = Number\(a1Placement\.wallConnectorLength\) - SOURCE_WALL_LENGTH_PADDING_METERS;\n  if \(!\(terminalDistance > 0\.4 && terminalDistance < 28\)\) \{\n    throw new Error\(`A1 measured terminal wall distance is invalid: \$\{terminalDistance\}`\);\n  \}\n\n  const beforeTransforms = captureAuthoredPartTransforms\(a1Model\);/;
  if (!distancePattern.test(source)) {
    throw new Error(`${installationPath}: measured terminal-distance block is missing`);
  }
  source = source.replace(
    distancePattern,
    `  const sourceTerminalDistance = Number(a1Placement.wallConnectorLength) - SOURCE_WALL_LENGTH_PADDING_METERS;
  if (!(sourceTerminalDistance > A1_PHOTO_FIXED_VESTIBULE_METERS + 0.5 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }
  const terminalDistance = A1_PHOTO_FIXED_VESTIBULE_METERS;
  const relocationDistance = sourceTerminalDistance - terminalDistance;
  const relocationX = terminalDirection.x * relocationDistance;
  const relocationZ = terminalDirection.z * relocationDistance;
  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    x: a1Placement.x + relocationX,
    z: a1Placement.z + relocationZ,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });

  const beforeTransforms = captureAuthoredPartTransforms(a1Model);`,
  );
}

if (!source.includes("a1Anchor.position.x += relocationX")) {
  const anchor = `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);`;
  if (!source.includes(anchor)) throw new Error(`${installationPath}: fleet grounding anchor is missing`);
  source = source.replace(
    anchor,
    `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  a1Anchor.position.x += relocationX;
  a1Anchor.position.z += relocationZ;
  a1Anchor.userData.photoRegistrationAuthority = A1_PHOTO_REGISTRATION_AUTHORITY;
  a1Anchor.userData.photoRegistrationRelocationMeters = relocationDistance;
  a1Anchor.userData.photoRegistrationX = relocationX;
  a1Anchor.userData.photoRegistrationZ = relocationZ;
  fleet.updateMatrixWorld(true);`,
  );
}

source = source.replace(
  `    fleet,
    a1Placement,
    rotundaOpening,`,
  `    fleet,
    correctedA1Placement,
    rotundaOpening,`,
);

if (!source.includes("sourceA1TerminalWallDistanceMeters: sourceTerminalDistance")) {
  const reportAnchor = "    a1TerminalWallDistanceMeters: terminalDistance,";
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: report wall-distance anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    sourceA1TerminalWallDistanceMeters: sourceTerminalDistance,
    a1PhotoRegistrationAuthority: A1_PHOTO_REGISTRATION_AUTHORITY,
    a1RelocationDistanceMeters: relocationDistance,
    a1RelocationX: relocationX,
    a1RelocationZ: relocationZ,`,
  );
}

if (!source.includes("uploadedJetwayA1PhotoRegistrationAuthority")) {
  const userDataAnchor = "  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.a1TerminalWallDistanceMeters;";
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group wall-distance anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}
  group.userData.uploadedJetwayA1SourceTerminalWallDistanceMeters = report.sourceA1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1PhotoRegistrationAuthority = report.a1PhotoRegistrationAuthority;
  group.userData.uploadedJetwayA1RelocationDistanceMeters = report.a1RelocationDistanceMeters;
  group.userData.uploadedJetwayA1RelocationX = report.a1RelocationX;
  group.userData.uploadedJetwayA1RelocationZ = report.a1RelocationZ;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v8"',
  'CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-vestibule-v7"',
  `A1_PHOTO_FIXED_VESTIBULE_METERS = ${PHOTO_FIXED_VESTIBULE_METERS}`,
  `A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}"`,
  "const sourceTerminalDistance = Number(a1Placement.wallConnectorLength)",
  "const relocationDistance = sourceTerminalDistance - terminalDistance",
  "a1Anchor.position.x += relocationX",
  "correctedA1Placement",
  "sourceA1TerminalWallDistanceMeters: sourceTerminalDistance",
  "uploadedJetwayA1PhotoRegistrationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: photo-registration output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared A1 photo registration: shifted the complete authored A1 jetway installation toward the measured terminal facade and retained a ${PHOTO_FIXED_VESTIBULE_METERS.toFixed(1)} m fixed vestibule without altering any source-part local transform.`);
