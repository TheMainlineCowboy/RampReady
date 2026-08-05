import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY = "same-day-a1-whole-authored-assembly-terminal-rotunda-v1";
const HALF_TURN_RADIANS = Math.PI;

source = source.replace(
  /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
  'const INSTALLATION_AUTHORITY = "photo-registered-terminal-rotunda-grounded-exact-chain-v14";',
);

const anchor = `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // Measure the exact supplied Rotunda before moving A1.`;

if (!source.includes("a1Anchor.userData.wholeAssemblyOrientationAuthority")) {
  if (!source.includes(anchor)) {
    throw new Error(`${installationPath}: photo-registered A1 installation anchor is missing`);
  }
  source = source.replace(
    anchor,
    `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;

  // The exact-head render proved the complete supplied assembly was installed
  // end-for-end: the authored Rotunda appeared on the apron while a boxed cab
  // opening faced the terminal. Rotate only the A1 installation parent by 180°.
  // Every authored Rotunda/Tunnel/Cab node keeps its original local transform.
  a1Anchor.rotation.y += ${HALF_TURN_RADIANS};
  a1Anchor.userData.wholeAssemblyOrientationAuthority = "${WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY}";
  a1Anchor.userData.wholeAssemblyOrientationCorrectionRadians = ${HALF_TURN_RADIANS};
  fleet.updateMatrixWorld(true);

  // Measure the exact supplied Rotunda before moving A1.`,
  );
}

const reportAnchor = "    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
if (!source.includes("wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority")) {
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: correction report anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority,
    wholeAssemblyOrientationCorrectionRadians: a1Anchor.userData.wholeAssemblyOrientationCorrectionRadians,`,
  );
}

const userDataAnchor = "  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;";
if (!source.includes("uploadedJetwayA1WholeAssemblyOrientationAuthority")) {
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group report anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}
  group.userData.uploadedJetwayA1WholeAssemblyOrientationAuthority = report.wholeAssemblyOrientationAuthority;
  group.userData.uploadedJetwayA1WholeAssemblyOrientationCorrectionRadians = report.wholeAssemblyOrientationCorrectionRadians;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-terminal-rotunda-grounded-exact-chain-v14"',
  `a1Anchor.rotation.y += ${HALF_TURN_RADIANS}`,
  `wholeAssemblyOrientationAuthority = "${WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY}"`,
  "wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority",
  "uploadedJetwayA1WholeAssemblyOrientationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: whole-assembly orientation output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Prepared A1 as one continuous authored assembly with a parent-level half-turn so the supplied Rotunda is terminal-side and the supplied Cab is apron-side; no authored node was rotated independently.");
