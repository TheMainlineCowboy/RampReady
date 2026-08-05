import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const ORIENTATION_AUTHORITY = "same-day-photo-rigid-parent-rotunda-terminal-side-v2";
const ROTATION_RADIANS = Math.PI;

source = source
  .replace(
    'const INSTALLATION_AUTHORITY = "photo-registered-visible-vestibule-grounded-exact-chain-v13";',
    'const INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-oriented-grounded-exact-chain-v14";',
  )
  .replace(
    /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
    'const INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-oriented-grounded-exact-chain-v14";',
  );

if (!source.includes("A1_PARENT_ORIENTATION_AUTHORITY")) {
  const constantAnchor = 'const A1_PHOTO_REGISTRATION_AUTHORITY = "same-day-photo-a1-terminal-corner-registration-v6";';
  if (!source.includes(constantAnchor)) throw new Error(`${installationPath}: photo-registration authority anchor is missing`);
  source = source.replace(
    constantAnchor,
    `${constantAnchor}\nconst A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}";\nconst A1_PARENT_ORIENTATION_CORRECTION_RADIANS = Math.PI;`,
  );
}

const measureAnchor = "  const sourceRotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);";
if (!source.includes("a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS")) {
  if (!source.includes(measureAnchor)) throw new Error(`${installationPath}: source Rotunda measurement anchor is missing`);
  source = source.replace(
    measureAnchor,
    `  // The supplied GLB child hierarchy stays untouched. Rotate only the complete
  // A1 installation parent so the authored Rotunda is terminal-side and the Cab
  // remains aircraft-side, matching the user's overhead and same-day A1 photos.
  const authoredA1ParentYaw = a1Anchor.rotation.y;
  a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS;
  a1Anchor.userData.parentOrientationAuthority = A1_PARENT_ORIENTATION_AUTHORITY;
  a1Anchor.userData.parentOrientationCorrectionRadians = A1_PARENT_ORIENTATION_CORRECTION_RADIANS;
  a1Anchor.userData.authoredParentYawRadians = authoredA1ParentYaw;
  fleet.updateMatrixWorld(true);

${measureAnchor}`,
  );
}

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
  'INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-oriented-grounded-exact-chain-v14"',
  `A1_PARENT_ORIENTATION_AUTHORITY = "${ORIENTATION_AUTHORITY}"`,
  "A1_PARENT_ORIENTATION_CORRECTION_RADIANS = Math.PI",
  "a1Anchor.rotation.y += A1_PARENT_ORIENTATION_CORRECTION_RADIANS",
  "a1ParentOrientationAuthority: A1_PARENT_ORIENTATION_AUTHORITY",
  "uploadedJetwayA1ParentOrientationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: rigid-parent orientation output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Prepared A1 rigid-parent orientation correction (${ROTATION_RADIANS.toFixed(6)} rad) with the supplied GLB child transforms unchanged.`);
