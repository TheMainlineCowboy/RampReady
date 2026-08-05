import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const PHOTO_VISIBLE_VESTIBULE_METERS = 2.4;
const PHOTO_REGISTRATION_AUTHORITY = "same-day-photo-a1-terminal-corner-registration-v6";
const TERMINAL_FACADE_EMBED_METERS = 0.9;
const TERMINAL_FACADE_COLLAR_DEPTH_METERS = 1.2;
const TERMINAL_FACADE_COLLAR_APRON_OFFSET_METERS = 0.28;
const TERMINAL_FACADE_COLLAR_MARGIN_METERS = 0.5;
const BELLOWS_DEPTH_METERS = 0.24;
const BELLOWS_HEADER_METERS = 0.22;
const BELLOWS_THRESHOLD_METERS = 0.18;
const BELLOWS_JAMB_METERS = 0.16;

source = source
  .replace(
    'const INSTALLATION_AUTHORITY = "measured-terminal-facade-short-connector-grounded-exact-chain-v7";',
    'const INSTALLATION_AUTHORITY = "photo-registered-visible-vestibule-grounded-exact-chain-v13";',
  )
  .replace(
    /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-visible-vestibule-grounded-exact-chain-v13";',
  )
  .replace(
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-short-solid-terminal-vestibule-v6";',
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-visible-solid-terminal-vestibule-v12";',
  )
  .replace(
    /const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-[^"]+-v\d+";/,
    'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-visible-solid-terminal-vestibule-v12";',
  )
  .replace(
    'const TERMINAL_HIDDEN_OVERLAP_METERS = 0.3;',
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_FACADE_EMBED_METERS};`,
  );

if (!source.includes("A1_PHOTO_VISIBLE_VESTIBULE_METERS")) {
  const anchor = "const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;";
  if (!source.includes(anchor)) throw new Error(`${installationPath}: ground-correction constant anchor is missing`);
  source = source.replace(
    anchor,
    `${anchor}\nconst A1_PHOTO_VISIBLE_VESTIBULE_METERS = ${PHOTO_VISIBLE_VESTIBULE_METERS};\nconst A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}";`,
  );
} else {
  source = source
    .replace(
      /const A1_PHOTO_VISIBLE_VESTIBULE_METERS = [^;]+;/,
      `const A1_PHOTO_VISIBLE_VESTIBULE_METERS = ${PHOTO_VISIBLE_VESTIBULE_METERS};`,
    )
    .replace(
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
  if (!(sourceTerminalDistance > A1_PHOTO_VISIBLE_VESTIBULE_METERS + 1 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }

  const beforeTransforms = captureAuthoredPartTransforms(a1Model);`,
  );
}

const installationPattern = /  fleet\.position\.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;\n  fleet\.updateMatrixWorld\(true\);\n  const rotundaOpening = measureExactRotundaOpening\(THREE, fleet, a1Model, terminalDirection\);\n  const connector = buildMeasuredA1Connector\(\n    THREE,\n    fleet,\n    a1Placement,\n    rotundaOpening,\n    terminalDirection,\n    terminalDistance,\n  \);/;
if (!installationPattern.test(source) && !source.includes("const sourceRotundaOpening = measureExactRotundaOpening")) {
  throw new Error(`${installationPath}: A1 installation block is missing`);
}
source = source.replace(
  installationPattern,
  `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // Measure the exact supplied Rotunda before moving A1. The photo dimension is
  // the visible white vestibule from the Rotunda collar to the terminal facade,
  // not the distance from the Rotunda center. Measuring from the center consumed
  // nearly the entire vestibule and left the dark bellows reading as a giant hole.
  const sourceRotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const terminalDistance = sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS;
  const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance;
  const terminalWallZ = a1Placement.z + terminalDirection.z * sourceTerminalDistance;
  const targetRotundaCenterX = terminalWallX - sourceRotundaOpening.openingDirectionX * terminalDistance;
  const targetRotundaCenterZ = terminalWallZ - sourceRotundaOpening.openingDirectionZ * terminalDistance;
  const relocationX = targetRotundaCenterX - sourceRotundaOpening.centerX;
  const relocationZ = targetRotundaCenterZ - sourceRotundaOpening.centerZ;
  const relocationDistance = Math.hypot(relocationX, relocationZ);
  if (!(relocationDistance >= 0 && relocationDistance < 28)) {
    throw new Error(\`A1 photo-registration relocation is invalid: \${relocationDistance}\`);
  }

  a1Anchor.position.x += relocationX;
  a1Anchor.position.z += relocationZ;
  a1Anchor.userData.photoRegistrationAuthority = A1_PHOTO_REGISTRATION_AUTHORITY;
  a1Anchor.userData.photoRegistrationRelocationMeters = relocationDistance;
  a1Anchor.userData.photoRegistrationX = relocationX;
  a1Anchor.userData.photoRegistrationZ = relocationZ;
  const correctedA1Placement = Object.freeze({
    ...a1Placement,
    x: a1Placement.x + relocationX,
    z: a1Placement.z + relocationZ,
    wallConnectorLength: terminalDistance + SOURCE_WALL_LENGTH_PADDING_METERS,
  });

  fleet.updateMatrixWorld(true);
  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  if (Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05) {
    throw new Error(\`A1 visible vestibule length is wrong: \${actualVisibleVestibuleMeters}\`);
  }
  const connector = buildMeasuredA1Connector(
    THREE,
    fleet,
    correctedA1Placement,
    rotundaOpening,
    terminalDirection,
    terminalDistance,
  );
  connector.userData.visibleMainLengthMeters = actualVisibleVestibuleMeters;
  connector.userData.photoVisibleVestibuleMeters = actualVisibleVestibuleMeters;`,
);

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

// Keep the real flexible collar, but make it a tight joint rather than a large
// apron-facing black rectangle. The white transition overlaps this ring.
source = source
  .replace(
    '[width + 0.16, 0.3, 0.48]',
    `[width + 0.08, ${BELLOWS_HEADER_METERS}, ${BELLOWS_DEPTH_METERS}]`,
  )
  .replace(
    '[width + 0.16, 0.22, 0.48]',
    `[width + 0.08, ${BELLOWS_THRESHOLD_METERS}, ${BELLOWS_DEPTH_METERS}]`,
  )
  .replace(
    '[0.24, height, 0.48]',
    `[${BELLOWS_JAMB_METERS}, height, ${BELLOWS_DEPTH_METERS}]`,
  )
  .replace(
    '(halfWidth + 0.04)',
    '(halfWidth + 0.015)',
  );

const terminalPortalPattern = /  addBox\(\n    THREE,\n    connector,\n    materials\.interior,\n    "UploadedAirportJetwayA1TerminalPortalInterior",\n    \[width - 0\.3, height - 0\.3, 0\.12\],\n    \[terminalPoint\.x \+ mainVector\.x \* 0\.06, collarPoint\.y, terminalPoint\.z \+ mainVector\.z \* 0\.06\],\n    mainFrame\.yaw,\n    false,\n  \);/;
if (!terminalPortalPattern.test(source) && !source.includes("UploadedAirportJetwayA1TerminalFacadeOverlapCollar")) {
  throw new Error(`${installationPath}: original terminal portal block is missing`);
}
source = source.replace(
  terminalPortalPattern,
  `  // The same-day apron view must read as one continuous white vestibule
  // entering the terminal facade. This opaque collar straddles the wall plane
  // and removes the black apron-facing recess without touching the exact GLB.
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalFacadeOverlapCollar",
    [width + ${TERMINAL_FACADE_COLLAR_MARGIN_METERS}, height + ${TERMINAL_FACADE_COLLAR_MARGIN_METERS}, ${TERMINAL_FACADE_COLLAR_DEPTH_METERS}],
    [
      terminalPoint.x - mainVector.x * ${TERMINAL_FACADE_COLLAR_APRON_OFFSET_METERS},
      collarPoint.y,
      terminalPoint.z - mainVector.z * ${TERMINAL_FACADE_COLLAR_APRON_OFFSET_METERS},
    ],
    mainFrame.yaw,
  );`,
);

if (!source.includes("sourceA1TerminalWallDistanceMeters: sourceTerminalDistance")) {
  const reportAnchor = "    a1TerminalWallDistanceMeters: terminalDistance,";
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: report wall-distance anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    sourceA1TerminalWallDistanceMeters: sourceTerminalDistance,
    a1PhotoVisibleVestibuleMeters: actualVisibleVestibuleMeters,
    a1PhotoRegistrationAuthority: A1_PHOTO_REGISTRATION_AUTHORITY,
    a1RelocationDistanceMeters: relocationDistance,
    a1RelocationX: relocationX,
    a1RelocationZ: relocationZ,`,
  );
} else if (!source.includes("a1PhotoVisibleVestibuleMeters: actualVisibleVestibuleMeters")) {
  source = source.replace(
    "    sourceA1TerminalWallDistanceMeters: sourceTerminalDistance,",
    `    sourceA1TerminalWallDistanceMeters: sourceTerminalDistance,
    a1PhotoVisibleVestibuleMeters: actualVisibleVestibuleMeters,`,
  );
}

if (!source.includes("uploadedJetwayA1PhotoRegistrationAuthority")) {
  const userDataAnchor = "  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.a1TerminalWallDistanceMeters;";
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group wall-distance anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}
  group.userData.uploadedJetwayA1SourceTerminalWallDistanceMeters = report.sourceA1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1PhotoVisibleVestibuleMeters = report.a1PhotoVisibleVestibuleMeters;
  group.userData.uploadedJetwayA1PhotoRegistrationAuthority = report.a1PhotoRegistrationAuthority;
  group.userData.uploadedJetwayA1RelocationDistanceMeters = report.a1RelocationDistanceMeters;
  group.userData.uploadedJetwayA1RelocationX = report.a1RelocationX;
  group.userData.uploadedJetwayA1RelocationZ = report.a1RelocationZ;`,
  );
} else if (!source.includes("uploadedJetwayA1PhotoVisibleVestibuleMeters")) {
  source = source.replace(
    "  group.userData.uploadedJetwayA1SourceTerminalWallDistanceMeters = report.sourceA1TerminalWallDistanceMeters;",
    `  group.userData.uploadedJetwayA1SourceTerminalWallDistanceMeters = report.sourceA1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1PhotoVisibleVestibuleMeters = report.a1PhotoVisibleVestibuleMeters;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-visible-vestibule-grounded-exact-chain-v13"',
  'CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-visible-solid-terminal-vestibule-v12"',
  `TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_FACADE_EMBED_METERS}`,
  `A1_PHOTO_VISIBLE_VESTIBULE_METERS = ${PHOTO_VISIBLE_VESTIBULE_METERS}`,
  `A1_PHOTO_REGISTRATION_AUTHORITY = "${PHOTO_REGISTRATION_AUTHORITY}"`,
  "const sourceTerminalDistance = Number(a1Placement.wallConnectorLength)",
  "const sourceRotundaOpening = measureExactRotundaOpening",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "const terminalWallX = a1Placement.x + terminalDirection.x * sourceTerminalDistance",
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  "a1Anchor.position.x += relocationX",
  "correctedA1Placement",
  "rotundaOpening.centerX + openingDirection.x * terminalDistance",
  "UploadedAirportJetwayA1TerminalFacadeOverlapCollar",
  "a1PhotoVisibleVestibuleMeters: actualVisibleVestibuleMeters",
  "uploadedJetwayA1PhotoVisibleVestibuleMeters",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: photo-registration output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared A1 photo registration with one continuous exact bridge, ${PHOTO_VISIBLE_VESTIBULE_METERS.toFixed(1)} m of visible white vestibule measured from the Rotunda collar to the terminal facade, a tight flexible collar, and no apron-facing black recess.`);
