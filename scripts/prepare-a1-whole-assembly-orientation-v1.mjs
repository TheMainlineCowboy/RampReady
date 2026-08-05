import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(installationPath, "utf8");
let readinessSource = fs.readFileSync(readinessPath, "utf8");

const AUTHORED_END_ORDER_AUTHORITY = "uploaded-glb-rotunda-tunnels-cab-zero-parent-reversal-v4";

source = source.replace(
  /const INSTALLATION_AUTHORITY = "photo-registered-[^"]+-v\d+";/,
  'const INSTALLATION_AUTHORITY = "photo-registered-authored-end-order-grounded-exact-chain-v17";',
);

for (const forbidden of [
  "a1Anchor.rotation.y += Math.PI",
  "wholeOrientationMidpointBefore",
  "wholeAssemblyOrientationCorrectionRadians",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: obsolete A1 parent reversal survived before authored-order preparation: ${forbidden}`);
  }
}

const authoredOrderAnchor = `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // Measure the exact supplied Rotunda before moving A1.`;

if (!source.includes("a1Anchor.userData.authoredEndOrderAuthority")) {
  if (!source.includes(authoredOrderAnchor)) {
    throw new Error(`${installationPath}: photo-registered A1 authored-order anchor is missing`);
  }
  source = source.replace(
    authoredOrderAnchor,
    `  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);

  // Preserve the uploaded GLB's authored end order exactly. The Rotunda is the
  // terminal-side root followed by Tunnel A/B/C and the Cab at the aircraft.
  // A parent half-turn makes the full bridge pass through the terminal, so the
  // installation correction must translate only and apply zero parent rotation.
  const authoredOrderRotunda = a1Model.getObjectByName("Rotunda");
  const authoredOrderTunnelA = a1Model.getObjectByName("Tunnel_A");
  const authoredOrderTunnelB = a1Model.getObjectByName("Tunnel_B");
  const authoredOrderTunnelC = a1Model.getObjectByName("Tunnel_C");
  const authoredOrderCab = a1Model.getObjectByName("Cab");
  if (!authoredOrderRotunda || !authoredOrderTunnelA || !authoredOrderTunnelB
    || !authoredOrderTunnelC || !authoredOrderCab) {
    throw new Error("A1 authored end-order verification requires Rotunda, Tunnel A/B/C and Cab");
  }
  const authoredOrderBox = new THREE.Box3();
  const authoredOrderRotundaCenter = authoredOrderBox
    .setFromObject(authoredOrderRotunda)
    .getCenter(new THREE.Vector3());
  const authoredOrderCabCenter = authoredOrderBox
    .setFromObject(authoredOrderCab)
    .getCenter(new THREE.Vector3());
  const authoredOrderAxis = authoredOrderCabCenter.clone().sub(authoredOrderRotundaCenter);
  authoredOrderAxis.y = 0;
  const authoredEndOrderSeparationMeters = authoredOrderAxis.length();
  if (!(authoredEndOrderSeparationMeters > 20 && authoredEndOrderSeparationMeters < 40)) {
    throw new Error(\`A1 authored Rotunda-to-Cab separation is invalid: \${authoredEndOrderSeparationMeters}\`);
  }
  authoredOrderAxis.normalize();
  a1Anchor.userData.authoredEndOrderAuthority = "${AUTHORED_END_ORDER_AUTHORITY}";
  a1Anchor.userData.authoredEndOrderCorrectionRadians = 0;
  a1Anchor.userData.authoredEndOrderSeparationMeters = authoredEndOrderSeparationMeters;
  a1Anchor.userData.authoredEndOrderRotundaToCabVector = [authoredOrderAxis.x, authoredOrderAxis.z];

  // Measure the exact supplied Rotunda before moving A1.`,
  );
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
    authoredEndOrderRotundaToCabVector: a1Anchor.userData.authoredEndOrderRotundaToCabVector,`,
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
  group.userData.uploadedJetwayA1AuthoredEndOrderRotundaToCabVector = report.authoredEndOrderRotundaToCabVector;`,
  );
}

// Validate telescope travel from measured reach instead of preserving the
// retired arbitrary 3–7 m window. The authored model order itself is unchanged.
const oldReadinessExtensionGuard = "            || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)";
const measuredReadinessExtensionGuard = `            || !(a1AttachedExtension > 0.25 && a1AttachedExtension < 7)
            || Math.abs(sourceContactDistance + a1AttachedExtension - a1TargetDoorDistance) > 0.05`;
if (readinessSource.includes(oldReadinessExtensionGuard)) {
  readinessSource = readinessSource.replace(
    oldReadinessExtensionGuard,
    measuredReadinessExtensionGuard,
  );
} else if (!readinessSource.includes(measuredReadinessExtensionGuard)) {
  throw new Error(`${readinessPath}: A1 attached-extension readiness guard is missing`);
}

for (const token of [
  'INSTALLATION_AUTHORITY = "photo-registered-authored-end-order-grounded-exact-chain-v17"',
  `authoredEndOrderAuthority = "${AUTHORED_END_ORDER_AUTHORITY}"`,
  "authoredEndOrderCorrectionRadians = 0",
  "authoredEndOrderRotundaToCabVector",
  "authoredEndOrderAuthority: a1Anchor.userData.authoredEndOrderAuthority",
  "uploadedJetwayA1AuthoredEndOrderAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${installationPath}: authored A1 end-order output is missing ${token}`);
}
for (const forbidden of [
  "a1Anchor.rotation.y += Math.PI",
  "wholeOrientationMidpointBefore",
  "wholeAssemblyOrientationCorrectionRadians",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: obsolete A1 parent reversal survived: ${forbidden}`);
  }
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
console.log("Prepared A1 in the uploaded GLB's authored Rotunda-to-Tunnel-A/B/C-to-Cab order with zero parent reversal, photo-registered the terminal-side Rotunda by translation only, and retained strict measured-reach articulation checks.");
