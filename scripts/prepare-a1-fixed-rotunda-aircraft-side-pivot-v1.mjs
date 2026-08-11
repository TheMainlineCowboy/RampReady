import fs from "node:fs";

// First let the current source-ownership pass put the aircraft-side bridge at
// the decoded KPHX heading while preserving the already measured real-wall
// Rotunda CENTER. That pass currently rotates the complete anchor, which also
// rotates the Rotunda's authored terminal portal away from the building.
await import(`./prepare-a1-source-bgl-rotunda-ownership-v1.mjs?fixed-wall-rotunda=${Date.now()}`);

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
let source = fs.readFileSync(sourcePath, "utf8");
const SOURCE_OWNERSHIP_AUTHORITY = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const ROTUNDA_ORIENTATION_AUTHORITY = "a1-fixed-real-wall-rotunda-source-orientation-aircraft-side-heading-v3";

// Do NOT reparent Tunnel A/B/C/Cab again. The earlier child-pivot experiment was
// conceptually aimed at the right articulation but produced a fragile hierarchy
// that later preparers could collapse. The equivalent stable operation is:
//  1. capture the Rotunda world orientation before the complete anchor receives
//     the decoded source heading;
//  2. let that anchor operation place Tunnel A/B/C/Cab exactly where it already
//     passes aircraft and bogie checks; then
//  3. restore ONLY the Rotunda to its pre-heading world orientation and exact
//     wall-registered center.
// Because Tunnel A/B/C/Cab are untouched after the anchor yaw, their rigid chain,
// Cab contact, and Tunnel-C ground height cannot be changed by this correction.
const captureAnchor = "  anchor.rotation.y = Number(placement.yaw);";
const captureBlock = `  const fixedWallRotundaWorldQuaternion = rotunda.getWorldQuaternion(new THREE.Quaternion());
  ${captureAnchor}`;
if (!source.includes("fixedWallRotundaWorldQuaternion")) {
  if (!source.includes(captureAnchor)) {
    throw new Error(`${sourcePath}: decoded-heading A1 anchor rotation is missing; refusing to guess Rotunda correction`);
  }
  source = source.replace(captureAnchor, captureBlock);
}

const recenterAnchor = `  anchor.position.x += sourceRotundaTarget.x - rotatedSourceHeadingRotundaCenter.x;
  anchor.position.z += sourceRotundaTarget.z - rotatedSourceHeadingRotundaCenter.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);`;
const rotundaRestoreBlock = `${recenterAnchor}

  // ${ROTUNDA_ORIENTATION_AUTHORITY}
  // Restore the authored terminal-side Rotunda orientation in WORLD space while
  // leaving the already source-headed Tunnel A/B/C/Cab siblings untouched.
  const rotundaParentWorldQuaternion = rotunda.parent.getWorldQuaternion(new THREE.Quaternion());
  const fixedWallRotundaLocalQuaternion = rotundaParentWorldQuaternion.clone().invert().multiply(fixedWallRotundaWorldQuaternion);
  rotunda.quaternion.copy(fixedWallRotundaLocalQuaternion);
  rotunda.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  // The exported Rotunda mesh center is slightly offset from its node pivot.
  // Counter-rotation can therefore move its Box3 center by a few centimeters.
  // Translate the Rotunda node in its parent frame so the measured real-wall
  // center remains exact without moving any aircraft-side supplied component.
  const counterRotatedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const desiredRotundaWorldPoint = fleet.localToWorld(sourceRotundaTarget.clone());
  const currentRotundaWorldPoint = fleet.localToWorld(counterRotatedRotundaCenter.clone());
  const desiredRotundaParentPoint = rotunda.parent.worldToLocal(desiredRotundaWorldPoint.clone());
  const currentRotundaParentPoint = rotunda.parent.worldToLocal(currentRotundaWorldPoint.clone());
  rotunda.position.add(desiredRotundaParentPoint.sub(currentRotundaParentPoint));
  rotunda.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const fixedWallRotundaFinalCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const fixedWallRotundaCenterErrorMeters = Math.hypot(
    fixedWallRotundaFinalCenter.x - sourceRotundaTarget.x,
    fixedWallRotundaFinalCenter.z - sourceRotundaTarget.z,
  );
  const fixedWallRotundaFinalWorldQuaternion = rotunda.getWorldQuaternion(new THREE.Quaternion());
  const fixedWallRotundaQuaternionDot = THREE.MathUtils.clamp(
    Math.abs(fixedWallRotundaFinalWorldQuaternion.dot(fixedWallRotundaWorldQuaternion)),
    -1,
    1,
  );
  const fixedWallRotundaOrientationErrorRadians = 2 * Math.acos(fixedWallRotundaQuaternionDot);
  if (fixedWallRotundaCenterErrorMeters > 0.002) {
    throw new Error(\`A1 fixed-wall Rotunda center moved during source-heading articulation: \${fixedWallRotundaCenterErrorMeters}\`);
  }
  if (fixedWallRotundaOrientationErrorRadians > 0.001) {
    throw new Error(\`A1 fixed-wall Rotunda orientation was not restored: \${fixedWallRotundaOrientationErrorRadians}\`);
  }
  group.userData.uploadedJetwayA1RotundaOrientationAuthority = "${ROTUNDA_ORIENTATION_AUTHORITY}";
  group.userData.uploadedJetwayA1RotundaFixedToTerminal = true;
  group.userData.uploadedJetwayA1RotundaOrientationErrorRadians = fixedWallRotundaOrientationErrorRadians;
  group.userData.uploadedJetwayA1RotundaCenterErrorMeters = fixedWallRotundaCenterErrorMeters;`;

if (!source.includes(ROTUNDA_ORIENTATION_AUTHORITY)) {
  if (!source.includes(recenterAnchor)) {
    throw new Error(`${sourcePath}: post-heading Rotunda recenter block is missing; refusing to install orientation correction`);
  }
  source = source.replace(recenterAnchor, rotundaRestoreBlock);
}

for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "uploadedJetwayA1AircraftSidePivotRootCount",
  "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: fragile child-pivot/raw-BGL-Rotunda behavior survived fixed-wall Rotunda preparation: ${forbidden}`);
  }
}

for (const required of [
  SOURCE_OWNERSHIP_AUTHORITY,
  ROTUNDA_ORIENTATION_AUTHORITY,
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const fixedWallRotundaWorldQuaternion = rotunda.getWorldQuaternion",
  "anchor.rotation.y = Number(placement.yaw)",
  "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
  "const fixedWallRotundaLocalQuaternion = rotundaParentWorldQuaternion.clone().invert().multiply(fixedWallRotundaWorldQuaternion);",
  "rotunda.quaternion.copy(fixedWallRotundaLocalQuaternion);",
  "fixedWallRotundaCenterErrorMeters",
  "fixedWallRotundaOrientationErrorRadians",
  "uploadedJetwayA1RotundaFixedToTerminal = true",
  "const yawDelta = 0;",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "uploadedJetwayA1MeasuredTerminalWallX",
  "A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: fixed-wall Rotunda / rigid aircraft-side requirement is missing ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Prepared A1 with the Rotunda world orientation and center fixed to the real terminal while the decoded KPHX heading continues to own Tunnel A/B/C/Cab. No aircraft-side node is reparented, no bridge section is moved vertically, and the Rotunda terminal portal can no longer rotate out toward the apron with the tunnel.");
