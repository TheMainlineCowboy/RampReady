import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(installationPath, "utf8");
let readinessSource = fs.readFileSync(readinessPath, "utf8");

const AUTHORED_END_ORDER_AUTHORITY = "uploaded-glb-rigid-parent-terminal-side-rotunda-v5";

source = source.replace(
  /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
  'const INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-terminal-side-rotunda-v18";',
);

const orientationAnchor = `  const beforeTransforms = captureAuthoredPartTransforms(a1Model);
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);
  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);`;

const orientedBlock = `  const beforeTransforms = captureAuthoredPartTransforms(a1Model);
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // Orient the complete supplied assembly as one rigid parent. The Rotunda must
  // face the terminal and the Cab must face the apron. Child transforms,
  // geometry, UVs, textures, hierarchy and articulation remain untouched.
  const authoredOrderRotunda = a1Model.getObjectByName("Rotunda");
  const authoredOrderCab = a1Model.getObjectByName("Cab");
  if (!authoredOrderRotunda || !authoredOrderCab) {
    throw new Error("A1 rigid orientation requires the supplied Rotunda and Cab");
  }
  const authoredOrderBox = new THREE.Box3();
  const rotundaCenterBefore = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const cabCenterBefore = authoredOrderBox
    .setFromObject(authoredOrderCab)
    .getCenter(new THREE.Vector3());
  const currentRotundaToCab = cabCenterBefore.clone().sub(rotundaCenterBefore);
  currentRotundaToCab.y = 0;
  const authoredEndOrderSeparationMeters = currentRotundaToCab.length();
  if (!(authoredEndOrderSeparationMeters > 20 && authoredEndOrderSeparationMeters < 40)) {
    throw new Error(\`A1 authored Rotunda-to-Cab separation is invalid: \${authoredEndOrderSeparationMeters}\`);
  }
  currentRotundaToCab.normalize();
  const desiredRotundaToCab = terminalDirection.clone().multiplyScalar(-1);
  const orientationCross = currentRotundaToCab.x * desiredRotundaToCab.z
    - currentRotundaToCab.z * desiredRotundaToCab.x;
  const orientationDot = THREE.MathUtils.clamp(currentRotundaToCab.dot(desiredRotundaToCab), -1, 1);
  const wholeAssemblyOrientationCorrectionRadians = Math.atan2(orientationCross, orientationDot);
  a1Anchor.rotation.y += wholeAssemblyOrientationCorrectionRadians;
  fleet.updateMatrixWorld(true);

  // Keep the authored Rotunda registered at the same terminal joint while the
  // complete assembly swings around it. This prevents a detached joint or an
  // invented long corridor after the rigid parent correction.
  const rotundaCenterAfterRotation = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const rotundaRegistrationDeltaWorld = rotundaCenterBefore.clone().sub(rotundaCenterAfterRotation);
  const fleetWorldQuaternion = fleet.getWorldQuaternion(new THREE.Quaternion());
  const rotundaRegistrationDeltaLocal = rotundaRegistrationDeltaWorld
    .clone()
    .applyQuaternion(fleetWorldQuaternion.invert());
  a1Anchor.position.add(rotundaRegistrationDeltaLocal);
  fleet.updateMatrixWorld(true);

  const rotundaCenterAfter = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const cabCenterAfter = authoredOrderBox
    .setFromObject(authoredOrderCab)
    .getCenter(new THREE.Vector3());
  const correctedRotundaToCab = cabCenterAfter.clone().sub(rotundaCenterAfter);
  correctedRotundaToCab.y = 0;
  correctedRotundaToCab.normalize();
  const terminalSideRotundaError = 1 - correctedRotundaToCab.dot(desiredRotundaToCab);
  if (terminalSideRotundaError > 0.0025) {
    throw new Error(\`A1 rigid parent orientation failed terminal-side Rotunda check: \${terminalSideRotundaError}\`);
  }
  if (rotundaCenterAfter.distanceTo(rotundaCenterBefore) > 0.02) {
    throw new Error("A1 rigid parent orientation detached the registered Rotunda terminal joint");
  }
  a1Anchor.userData.authoredEndOrderAuthority = "${AUTHORED_END_ORDER_AUTHORITY}";
  a1Anchor.userData.authoredEndOrderCorrectionRadians = wholeAssemblyOrientationCorrectionRadians;
  a1Anchor.userData.authoredEndOrderSeparationMeters = authoredEndOrderSeparationMeters;
  a1Anchor.userData.authoredEndOrderRotundaToCabVector = [correctedRotundaToCab.x, correctedRotundaToCab.z];
  a1Anchor.userData.authoredEndOrderRotundaRegistrationErrorMeters = rotundaCenterAfter.distanceTo(rotundaCenterBefore);

  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);`;

if (source.includes(orientationAnchor)) {
  source = source.replace(orientationAnchor, orientedBlock);
} else if (!source.includes("wholeAssemblyOrientationCorrectionRadians")) {
  throw new Error(`${installationPath}: A1 installation orientation anchor is missing`);
}

const reportAnchor = "    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
if (!source.includes("authoredEndOrderAuthority: a1Anchor.userData.authoredEndOrderAuthority")) {
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: correction report anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}
    authoredEndOrderAuthority: a1Anchor.userData.authoredEndOrderAuthority,
    authoredEndOrderCorrectionRadians: a1Anchor.userData.authoredEndOrderCorrectionRadians,
    authoredEndOrderSeparationMeters: a1Anchor.userData.authoredEndOrderSeparationMeters,
    authoredEndOrderRotundaToCabVector: a1Anchor.userData.authoredEndOrderRotundaToCabVector,
    authoredEndOrderRotundaRegistrationErrorMeters: a1Anchor.userData.authoredEndOrderRotundaRegistrationErrorMeters,`,
  );
}

const userDataAnchor = "  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;";
if (!source.includes("uploadedJetwayA1AuthoredEndOrderAuthority")) {
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group report anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}
  group.userData.uploadedJetwayA1AuthoredEndOrderAuthority = report.authoredEndOrderAuthority;
  group.userData.uploadedJetwayA1AuthoredEndOrderCorrectionRadians = report.authoredEndOrderCorrectionRadians;
  group.userData.uploadedJetwayA1AuthoredEndOrderSeparationMeters = report.authoredEndOrderSeparationMeters;
  group.userData.uploadedJetwayA1AuthoredEndOrderRotundaToCabVector = report.authoredEndOrderRotundaToCabVector;
  group.userData.uploadedJetwayA1AuthoredEndOrderRotundaRegistrationErrorMeters = report.authoredEndOrderRotundaRegistrationErrorMeters;`,
  );
}

const oldReadinessExtensionGuard = "            || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)";
const measuredReadinessExtensionGuard = `            || !(a1AttachedExtension > 0.25 && a1AttachedExtension < 7)
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;
if (readinessSource.includes(oldReadinessExtensionGuard)) {
  readinessSource = readinessSource.replace(oldReadinessExtensionGuard, measuredReadinessExtensionGuard);
} else if (!readinessSource.includes(measuredReadinessExtensionGuard)) {
  throw new Error(`${readinessPath}: A1 attached-extension readiness guard is missing`);
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-terminal-side-rotunda-v18"',
  `authoredEndOrderAuthority = "${AUTHORED_END_ORDER_AUTHORITY}"`,
  "wholeAssemblyOrientationCorrectionRadians",
  "desiredRotundaToCab",
  "authoredEndOrderRotundaRegistrationErrorMeters",
  "uploadedJetwayA1AuthoredEndOrderAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: rigid A1 end-order output is missing ${token}`);
}
for (const token of [
  "a1AttachedExtension > 0.25 && a1AttachedExtension < 7",
  "sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance",
]) {
  if (!readinessSource.includes(token)) {
    throw new Error(`${readinessPath}: measured A1 extension readiness output is missing ${token}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
fs.writeFileSync(readinessPath, readinessSource, "utf8");
console.log("Prepared A1 with a rigid parent rotation around the registered Rotunda, placing the supplied Rotunda terminal-side and Cab apron-side while preserving every authored child transform and measured articulation check.");
