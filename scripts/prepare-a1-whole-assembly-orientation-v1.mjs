import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY = "same-day-a1-whole-authored-assembly-midpoint-terminal-rotunda-v3";
const HALF_TURN_RADIANS = Math.PI;

source = source.replace(
  /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
  'const INSTALLATION_AUTHORITY = "photo-registered-terminal-rotunda-grounded-exact-chain-v16";',
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
  fleet.updateMatrixWorld(true);

  // Rotate the complete supplied A1 installation around the measured midpoint
  // between the authored Rotunda and Cab. Rotating around the anchor origin can
  // leave the visible ends on the same sides when the source origin is located
  // near one end of the bridge. No authored Rotunda/Tunnel/Cab node is changed.
  const wholeOrientationRotunda = a1Model.getObjectByName("Rotunda");
  const wholeOrientationCab = a1Model.getObjectByName("Cab");
  if (!wholeOrientationRotunda || !wholeOrientationCab) {
    throw new Error("A1 whole-assembly orientation requires authored Rotunda and Cab nodes");
  }
  const wholeOrientationBox = new THREE.Box3();
  const wholeOrientationRotundaBefore = wholeOrientationBox
    .setFromObject(wholeOrientationRotunda)
    .getCenter(new THREE.Vector3());
  const wholeOrientationCabBefore = wholeOrientationBox
    .setFromObject(wholeOrientationCab)
    .getCenter(new THREE.Vector3());
  const wholeOrientationMidpointBefore = wholeOrientationRotundaBefore
    .clone()
    .add(wholeOrientationCabBefore)
    .multiplyScalar(0.5);

  a1Anchor.rotation.y += ${HALF_TURN_RADIANS};
  fleet.updateMatrixWorld(true);

  const wholeOrientationRotundaAfter = wholeOrientationBox
    .setFromObject(wholeOrientationRotunda)
    .getCenter(new THREE.Vector3());
  const wholeOrientationCabAfter = wholeOrientationBox
    .setFromObject(wholeOrientationCab)
    .getCenter(new THREE.Vector3());
  const wholeOrientationMidpointAfter = wholeOrientationRotundaAfter
    .clone()
    .add(wholeOrientationCabAfter)
    .multiplyScalar(0.5);
  const wholeOrientationWorldDelta = wholeOrientationMidpointBefore
    .clone()
    .sub(wholeOrientationMidpointAfter);
  const wholeOrientationParentQuaternion = new THREE.Quaternion();
  fleet.getWorldQuaternion(wholeOrientationParentQuaternion);
  const wholeOrientationParentDelta = wholeOrientationWorldDelta
    .clone()
    .applyQuaternion(wholeOrientationParentQuaternion.invert());
  a1Anchor.position.add(wholeOrientationParentDelta);
  a1Anchor.userData.wholeAssemblyOrientationAuthority = "${WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY}";
  a1Anchor.userData.wholeAssemblyOrientationCorrectionRadians = ${HALF_TURN_RADIANS};
  a1Anchor.userData.wholeAssemblyOrientationPivot = [
    wholeOrientationMidpointBefore.x,
    wholeOrientationMidpointBefore.y,
    wholeOrientationMidpointBefore.z,
  ];
  a1Anchor.userData.wholeAssemblyOrientationMidpointErrorMeters = wholeOrientationMidpointBefore.distanceTo(
    wholeOrientationMidpointAfter.clone().add(wholeOrientationWorldDelta),
  );
  fleet.updateMatrixWorld(true);

  // Measure the exact supplied Rotunda after the complete assembly is reversed
  // and then register that authored Rotunda to the real terminal wall.`,
  );
}

const relocationGuardAnchor = `  const relocationDistance = Math.hypot(relocationX, relocationZ);
  if (!(relocationDistance >= 0 && relocationDistance < 28)) {
    throw new Error(\`A1 photo-registration relocation is invalid: \${relocationDistance}\`);
  }`;

if (!source.includes("const maximumPhotoRegistrationRelocationMeters")) {
  if (!source.includes(relocationGuardAnchor)) {
    throw new Error(`${installationPath}: fixed photo-registration relocation guard is missing`);
  }
  source = source.replace(
    relocationGuardAnchor,
    `  const relocationDistance = Math.hypot(relocationX, relocationZ);
  const photoRegistrationBounds = new THREE.Box3().setFromObject(a1Model);
  const photoRegistrationSize = photoRegistrationBounds.getSize(new THREE.Vector3());
  const photoRegistrationHorizontalSpanMeters = Math.hypot(
    photoRegistrationSize.x,
    photoRegistrationSize.z,
  );
  const maximumPhotoRegistrationRelocationMeters =
    photoRegistrationHorizontalSpanMeters + sourceTerminalDistance + terminalDistance;
  if (!(maximumPhotoRegistrationRelocationMeters > sourceTerminalDistance
    && maximumPhotoRegistrationRelocationMeters < 80)) {
    throw new Error(\`A1 authored relocation bound is invalid: \${maximumPhotoRegistrationRelocationMeters}\`);
  }
  if (!(relocationDistance >= 0
    && relocationDistance <= maximumPhotoRegistrationRelocationMeters)) {
    throw new Error(
      \`A1 photo-registration relocation is invalid: \${relocationDistance} > \${maximumPhotoRegistrationRelocationMeters}\`,
    );
  }`,
  );
}

const reportAnchor = "    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
if (!source.includes("wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority")) {
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: correction report anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    photoRegistrationHorizontalSpanMeters,
    maximumPhotoRegistrationRelocationMeters,
    wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority,
    wholeAssemblyOrientationCorrectionRadians: a1Anchor.userData.wholeAssemblyOrientationCorrectionRadians,
    wholeAssemblyOrientationPivot: a1Anchor.userData.wholeAssemblyOrientationPivot,
    wholeAssemblyOrientationMidpointErrorMeters: a1Anchor.userData.wholeAssemblyOrientationMidpointErrorMeters,`,
  );
}

const userDataAnchor = "  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;";
if (!source.includes("uploadedJetwayA1WholeAssemblyOrientationAuthority")) {
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group report anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}
  group.userData.uploadedJetwayA1PhotoRegistrationHorizontalSpanMeters = report.photoRegistrationHorizontalSpanMeters;
  group.userData.uploadedJetwayA1MaximumPhotoRegistrationRelocationMeters = report.maximumPhotoRegistrationRelocationMeters;
  group.userData.uploadedJetwayA1WholeAssemblyOrientationAuthority = report.wholeAssemblyOrientationAuthority;
  group.userData.uploadedJetwayA1WholeAssemblyOrientationCorrectionRadians = report.wholeAssemblyOrientationCorrectionRadians;
  group.userData.uploadedJetwayA1WholeAssemblyOrientationPivot = report.wholeAssemblyOrientationPivot;
  group.userData.uploadedJetwayA1WholeAssemblyOrientationMidpointErrorMeters = report.wholeAssemblyOrientationMidpointErrorMeters;`,
  );
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-terminal-rotunda-grounded-exact-chain-v16"',
  `a1Anchor.rotation.y += ${HALF_TURN_RADIANS}`,
  "wholeOrientationMidpointBefore",
  "wholeOrientationParentDelta",
  "const maximumPhotoRegistrationRelocationMeters",
  "photoRegistrationHorizontalSpanMeters + sourceTerminalDistance + terminalDistance",
  `wholeAssemblyOrientationAuthority = "${WHOLE_ASSEMBLY_ORIENTATION_AUTHORITY}"`,
  "wholeAssemblyOrientationAuthority: a1Anchor.userData.wholeAssemblyOrientationAuthority",
  "uploadedJetwayA1WholeAssemblyOrientationAuthority",
  "uploadedJetwayA1MaximumPhotoRegistrationRelocationMeters",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: whole-assembly midpoint orientation output is missing ${token}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Prepared A1 as one continuous authored assembly with a parent-level half-turn around the measured Rotunda-to-Cab midpoint, re-registered the supplied Rotunda to the terminal, and bounded that translation from the authored assembly span instead of an obsolete fixed cutoff; no authored node was rotated independently.");
