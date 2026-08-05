import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const PHOTO_FIXED_VESTIBULE_METERS = 2.4;
const PHOTO_REGISTRATION_AUTHORITY = "same-day-photo-a1-terminal-corner-registration-v4";
const TERMINAL_FACADE_EMBED_METERS = 0.9;
const TERMINAL_WALL_SEAL_DEPTH_METERS = 0.18;
const TERMINAL_WALL_SEAL_THICKNESS_METERS = 0.42;
const TERMINAL_WALL_SEAL_MARGIN_METERS = 0.24;

source = source
  .replace(
    'const INSTALLATION_AUTHORITY = "measured-terminal-facade-short-connector-grounded-exact-chain-v7";',
    'const INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v11";',
  )
  .replace(
    /const INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v\d+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v11";',
  )
  .replace(
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-short-solid-terminal-vestibule-v6";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-straight-solid-terminal-vestibule-v10";',
  )
  .replace(
    /const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-(?:compact|straight)-solid-terminal-vestibule-v\d+";/,
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-straight-solid-terminal-vestibule-v10";',
  )
  .replace(
    'const TERMINAL_HIDDEN_OVERLAP_METERS = 0.3;',
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_FACADE_EMBED_METERS};`,
  );

if (!source.includes("A1_PHOTO_FIXED_VESTIBULE_METERS")) {
  const anchor = "const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;";
  if (!source.includes(anchor)) throw new Error(`${installationPath}: ground-correction constant anchor is missing`);
  source = source.replace(
    anchor,
    `${anchor}\nconst A1_PHOTO_FIXED_VESTIBULE_METERS = ${PHOTO_FIXED_VESTIBULE_METERS};\nconst A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}";`,
  );
} else {
  source = source.replace(
    /const A1_PHOTO_REGISTRATION_AUTHORITY = "[^"]+";/,
    `const A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}";`,
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

const endpointPattern = /  const terminalPoint = new THREE\.Vector3\(\n    placement\.x \+ terminalDirection\.x \* terminalDistance,\n    rotundaOpening\.centerY,\n    placement\.z \+ terminalDirection\.z \* terminalDistance,\n  \);\n  const collarPoint = new THREE\.Vector3\(rotundaOpening\.collarX, rotundaOpening\.centerY, rotundaOpening\.collarZ\);\n  const openingDirection = new THREE\.Vector3\(rotundaOpening\.openingDirectionX, 0, rotundaOpening\.openingDirectionZ\);/;
if (!endpointPattern.test(source) && !source.includes("rotundaOpening.centerX + openingDirection.x * terminalDistance")) {
  throw new Error(`${installationPath}: terminal endpoint construction block is missing`);
}
source = source.replace(
  endpointPattern,
  `  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);
  const openingDirection = new THREE.Vector3(rotundaOpening.openingDirectionX, 0, rotundaOpening.openingDirectionZ);
  const terminalPoint = new THREE.Vector3(
    rotundaOpening.centerX + openingDirection.x * terminalDistance,
    rotundaOpening.centerY,
    rotundaOpening.centerZ + openingDirection.z * terminalDistance,
  );`,
);

source = source
  .replace(
    `    materials.interior,
    "UploadedAirportJetwayA1TerminalPortalInterior",`,
    `    materials.shell,
    "UploadedAirportJetwayA1TerminalWallSeal",`,
  )
  .replace(
    /terminalPoint\.x \+ mainVector\.x \* (?:0\.06|0\.72)/g,
    `terminalPoint.x + mainVector.x * ${TERMINAL_WALL_SEAL_DEPTH_METERS}`,
  )
  .replace(
    /terminalPoint\.z \+ mainVector\.z \* (?:0\.06|0\.72)/g,
    `terminalPoint.z + mainVector.z * ${TERMINAL_WALL_SEAL_DEPTH_METERS}`,
  )
  .replace(
    /\[width - 0\.3, height - 0\.3, 0\.12\]/g,
    `[width + ${TERMINAL_WALL_SEAL_MARGIN_METERS}, height + ${TERMINAL_WALL_SEAL_MARGIN_METERS}, ${TERMINAL_WALL_SEAL_THICKNESS_METERS}]`,
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
  'INSTALLATION_AUTHORITY = "photo-registered-terminal-corner-grounded-exact-chain-v11"',
  'CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-straight-solid-terminal-vestibule-v10"',
  `TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_FACADE_EMBED_METERS}`,
  `A1_PHOTO_FIXED_VESTIBULE_METERS = ${PHOTO_FIXED_VESTIBULE_METERS}`,
  `A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}"`,
  "const sourceTerminalDistance = Number(a1Placement.wallConnectorLength)",
  "const relocationDistance = sourceTerminalDistance - terminalDistance",
  "a1Anchor.position.x += relocationX",
  "correctedA1Placement",
  "rotundaOpening.centerX + openingDirection.x * terminalDistance",
  "UploadedAirportJetwayA1TerminalWallSeal",
  `terminalPoint.x + mainVector.x * ${TERMINAL_WALL_SEAL_DEPTH_METERS}`,
  `terminalPoint.z + mainVector.z * ${TERMINAL_WALL_SEAL_DEPTH_METERS}`,
  `[width + ${TERMINAL_WALL_SEAL_MARGIN_METERS}, height + ${TERMINAL_WALL_SEAL_MARGIN_METERS}, ${TERMINAL_WALL_SEAL_THICKNESS_METERS}]`,
  "sourceA1TerminalWallDistanceMeters: sourceTerminalDistance",
  "uploadedJetwayA1PhotoRegistrationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: photo-registration output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared A1 photo registration with one continuous authored bridge, a straight 2.4 m solid vestibule, and a full opaque white facade-overlap seal; retained all source-part local transforms.`);
