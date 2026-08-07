import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(installationPath, "utf8");
let readinessSource = fs.readFileSync(readinessPath, "utf8");

const AUTHORED_END_ORDER_AUTHORITY = "uploaded-glb-rigid-parent-terminal-side-rotunda-v6";

source = source.replace(
  /const INSTALLATION_AUTHORITY = "[^"]+";/,
  'const INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-terminal-side-rotunda-v19";',
);

const measurementAnchor = "  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);";
const orientedMeasurement = `  // Rotate only the complete supplied A1 assembly parent after photo registration.
  // This keeps every authored GLB child transform, mesh, UV, texture and
  // articulation relationship intact while putting Rotunda terminal-side and
  // Cab apron-side.
  const authoredOrderRotunda = a1Model.getObjectByName("Rotunda");
  const authoredOrderCab = a1Model.getObjectByName("Cab");
  if (!authoredOrderRotunda || !authoredOrderCab) {
    throw new Error("A1 rigid orientation requires the supplied Rotunda and Cab");
  }
  const authoredOrderBox = new THREE.Box3();
  const rotundaCenterBeforeOrientation = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const cabCenterBeforeOrientation = authoredOrderBox
    .setFromObject(authoredOrderCab)
    .getCenter(new THREE.Vector3());
  const currentRotundaToCab = cabCenterBeforeOrientation.clone().sub(rotundaCenterBeforeOrientation);
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

  // Pivot the rigid correction around the already photo-registered Rotunda so
  // the terminal joint does not detach and no invented corridor is introduced.
  const rotundaCenterAfterRotation = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const rotundaRegistrationDeltaWorld = rotundaCenterBeforeOrientation.clone().sub(rotundaCenterAfterRotation);
  const fleetWorldQuaternion = fleet.getWorldQuaternion(new THREE.Quaternion());
  const rotundaRegistrationDeltaLocal = rotundaRegistrationDeltaWorld
    .clone()
    .applyQuaternion(fleetWorldQuaternion.invert());
  a1Anchor.position.add(rotundaRegistrationDeltaLocal);
  fleet.updateMatrixWorld(true);

  const rotundaCenterAfterOrientation = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const cabCenterAfterOrientation = authoredOrderBox
    .setFromObject(authoredOrderCab)
    .getCenter(new THREE.Vector3());
  const correctedRotundaToCab = cabCenterAfterOrientation.clone().sub(rotundaCenterAfterOrientation);
  correctedRotundaToCab.y = 0;
  correctedRotundaToCab.normalize();
  const terminalSideRotundaError = 1 - correctedRotundaToCab.dot(desiredRotundaToCab);
  const rotundaRegistrationErrorMeters = rotundaCenterAfterOrientation.distanceTo(rotundaCenterBeforeOrientation);
  if (terminalSideRotundaError > 0.0025) {
    throw new Error(\`A1 rigid parent orientation failed terminal-side Rotunda check: \${terminalSideRotundaError}\`);
  }
  if (rotundaRegistrationErrorMeters > 0.02) {
    throw new Error(\`A1 rigid parent orientation detached the registered Rotunda terminal joint: \${rotundaRegistrationErrorMeters}\`);
  }
  a1Anchor.userData.authoredEndOrderAuthority = "${AUTHORED_END_ORDER_AUTHORITY}";
  a1Anchor.userData.authoredEndOrderCorrectionRadians = wholeAssemblyOrientationCorrectionRadians;
  a1Anchor.userData.authoredEndOrderSeparationMeters = authoredEndOrderSeparationMeters;
  a1Anchor.userData.authoredEndOrderRotundaToCabVector = [correctedRotundaToCab.x, correctedRotundaToCab.z];
  a1Anchor.userData.authoredEndOrderRotundaRegistrationErrorMeters = rotundaRegistrationErrorMeters;

${measurementAnchor}`;

if (!source.includes("wholeAssemblyOrientationCorrectionRadians")) {
  if (!source.includes(measurementAnchor)) {
    throw new Error(`${installationPath}: post-registration Rotunda measurement anchor is missing`);
  }
  source = source.replace(measurementAnchor, orientedMeasurement);
}

const reportAnchor = "    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,";
if (!source.includes("authoredEndOrderAuthority: a1Anchor.userData.authoredEndOrderAuthority")) {
  if (!source.includes(reportAnchor)) throw new Error(`${installationPath}: correction report anchor is missing`);
  source = source.replace(
    reportAnchor,
    `${reportAnchor}\n    authoredEndOrderAuthority: a1Anchor.userData.authoredEndOrderAuthority,\n    authoredEndOrderCorrectionRadians: a1Anchor.userData.authoredEndOrderCorrectionRadians,\n    authoredEndOrderSeparationMeters: a1Anchor.userData.authoredEndOrderSeparationMeters,\n    authoredEndOrderRotundaToCabVector: a1Anchor.userData.authoredEndOrderRotundaToCabVector,\n    authoredEndOrderRotundaRegistrationErrorMeters: a1Anchor.userData.authoredEndOrderRotundaRegistrationErrorMeters,`,
  );
}

const userDataAnchor = "  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;";
if (!source.includes("uploadedJetwayA1AuthoredEndOrderAuthority")) {
  if (!source.includes(userDataAnchor)) throw new Error(`${installationPath}: group report anchor is missing`);
  source = source.replace(
    userDataAnchor,
    `${userDataAnchor}\n  group.userData.uploadedJetwayA1AuthoredEndOrderAuthority = report.authoredEndOrderAuthority;\n  group.userData.uploadedJetwayA1AuthoredEndOrderCorrectionRadians = report.authoredEndOrderCorrectionRadians;\n  group.userData.uploadedJetwayA1AuthoredEndOrderSeparationMeters = report.authoredEndOrderSeparationMeters;\n  group.userData.uploadedJetwayA1AuthoredEndOrderRotundaToCabVector = report.authoredEndOrderRotundaToCabVector;\n  group.userData.uploadedJetwayA1AuthoredEndOrderRotundaRegistrationErrorMeters = report.authoredEndOrderRotundaRegistrationErrorMeters;`,
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
  'INSTALLATION_AUTHORITY = "photo-registered-rigid-parent-terminal-side-rotunda-v19"',
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
console.log("Prepared A1 rigid parent orientation after photo registration, preserving the exact supplied GLB while keeping the Rotunda terminal joint fixed.");
