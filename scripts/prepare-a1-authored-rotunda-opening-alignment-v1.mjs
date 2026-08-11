import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const AUTHORITY = "a1-authored-rotunda-opening-physically-aligned-to-measured-wall-v1";
const MINIMUM_TERMINAL_FACING_DOT = 0.985;

let source = fs.readFileSync(installationPath, "utf8");

if (!source.includes(AUTHORITY)) {
  const measureFunctionAnchor = "function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection) {";
  if (!source.includes(measureFunctionAnchor)) {
    throw new Error(`${installationPath}: exact Rotunda opening measurement anchor is missing`);
  }

  const alignmentHelper = `function alignExactRotundaOpeningToTerminal(THREE, fleet, a1Model, terminalDirection) {
  const rotundaRoot = a1Model.getObjectByName("Rotunda");
  const rotundaMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  const tunnelAMesh = a1Model.getObjectByName("Tunnel_A_Jetway_0");
  if (!rotundaRoot?.isObject3D || !rotundaMesh?.isMesh || !tunnelAMesh?.isMesh || !rotundaRoot.parent) {
    throw new Error("A1 authored Rotunda alignment could not resolve Rotunda root/mesh/Tunnel A");
  }

  fleet.updateMatrixWorld(true);
  const rotundaVerticesBefore = transformedGeometryVertices(THREE, fleet, rotundaMesh);
  const tunnelVerticesBefore = transformedGeometryVertices(THREE, fleet, tunnelAMesh);
  const rotundaCenterBefore = vertexCentroid(THREE, rotundaVerticesBefore);
  const tunnelCenterBefore = vertexCentroid(THREE, tunnelVerticesBefore);
  const bridgeDirectionBefore = tunnelCenterBefore.clone().sub(rotundaCenterBefore).setY(0);
  if (bridgeDirectionBefore.lengthSq() < 0.25) throw new Error("A1 authored Rotunda/Tunnel-A axis is degenerate before portal alignment");
  bridgeDirectionBefore.normalize();

  // The supplied straight/default Airport_Jetway.glb defines the terminal portal
  // as the Rotunda face exactly opposite Tunnel A. A1 is an elbow: keep Tunnel A
  // where the decoded airport heading puts it, but yaw the Rotunda itself about
  // its fixed center until this authored terminal opening faces the measured
  // Terminal 4 wall.
  const authoredOpeningBefore = bridgeDirectionBefore.clone().multiplyScalar(-1);
  const openingHeadingBefore = Math.atan2(authoredOpeningBefore.x, authoredOpeningBefore.z);
  const terminalHeading = Math.atan2(terminalDirection.x, terminalDirection.z);
  const yawCorrectionRadians = Math.atan2(
    Math.sin(terminalHeading - openingHeadingBefore),
    Math.cos(terminalHeading - openingHeadingBefore),
  );
  const terminalFacingDotBefore = authoredOpeningBefore.dot(terminalDirection);

  const rotundaWorldQuaternionBefore = rotundaRoot.getWorldQuaternion(new THREE.Quaternion());
  const worldYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawCorrectionRadians);
  const desiredRotundaWorldQuaternion = worldYaw.multiply(rotundaWorldQuaternionBefore.clone());
  const rotundaParentWorldQuaternion = rotundaRoot.parent.getWorldQuaternion(new THREE.Quaternion());
  const desiredRotundaLocalQuaternion = rotundaParentWorldQuaternion.clone().invert().multiply(desiredRotundaWorldQuaternion);
  rotundaRoot.quaternion.copy(desiredRotundaLocalQuaternion);
  rotundaRoot.updateMatrix();
  fleet.updateMatrixWorld(true);

  // Rotunda_Jetway_0 is not perfectly centered on the exported node pivot. Keep
  // its exact measured mesh centroid fixed while changing only orientation.
  const rotundaCenterAfterYaw = vertexCentroid(THREE, transformedGeometryVertices(THREE, fleet, rotundaMesh));
  const desiredCenterWorld = fleet.localToWorld(rotundaCenterBefore.clone());
  const currentCenterWorld = fleet.localToWorld(rotundaCenterAfterYaw.clone());
  const desiredCenterInParent = rotundaRoot.parent.worldToLocal(desiredCenterWorld.clone());
  const currentCenterInParent = rotundaRoot.parent.worldToLocal(currentCenterWorld.clone());
  rotundaRoot.position.add(desiredCenterInParent.sub(currentCenterInParent));
  rotundaRoot.updateMatrix();
  fleet.updateMatrixWorld(true);

  const rotundaCenterAfter = vertexCentroid(THREE, transformedGeometryVertices(THREE, fleet, rotundaMesh));
  const centerErrorMeters = rotundaCenterAfter.distanceTo(rotundaCenterBefore);
  if (centerErrorMeters > 0.002) {
    throw new Error(\`A1 Rotunda center moved during terminal-opening articulation: \${centerErrorMeters}\`);
  }

  const openingDirection = authoredOpeningBefore.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yawCorrectionRadians).normalize();
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  const alignmentErrorRadians = Math.acos(THREE.MathUtils.clamp(terminalFacingDot, -1, 1));
  if (terminalFacingDot < ${MINIMUM_TERMINAL_FACING_DOT}) {
    throw new Error(\`A1 authored Rotunda opening is still not aligned to the measured terminal wall: dot=\${terminalFacingDot} error=\${alignmentErrorRadians}\`);
  }

  return Object.freeze({
    authority: "${AUTHORITY}",
    openingDirection,
    yawCorrectionRadians,
    terminalFacingDotBefore,
    terminalFacingDot,
    alignmentErrorRadians,
    centerErrorMeters,
  });
}

`;
  source = source.replace(measureFunctionAnchor, `${alignmentHelper}function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection, alignedOpeningDirection = null) {`);

  const openingBlockBefore = `  // The terminal opening is the authored side of the Rotunda opposite Tunnel A.
  // Never flip this vector to make a backwards installation pass validation.
  const openingDirection = bridgeDirection.clone().multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < 0.4) {
    throw new Error(\`A1 exact authored Rotunda opening does not face the measured terminal wall: \${terminalFacingDot}\`);
  }`;
  const openingBlockAfter = `  // The opening axis is measured from the supplied model and physically aligned
  // before installation. Never fall back to a vaguely terminal-facing side.
  const openingDirection = alignedOpeningDirection?.clone().normalize()
    || bridgeDirection.clone().multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < ${MINIMUM_TERMINAL_FACING_DOT}) {
    throw new Error(\`A1 exact authored Rotunda opening is not physically aligned to the measured terminal wall: \${terminalFacingDot}\`);
  }`;
  if (!source.includes(openingBlockBefore)) {
    throw new Error(`${installationPath}: loose Rotunda terminal-facing check is missing`);
  }
  source = source.replace(openingBlockBefore, openingBlockAfter);

  const beforeTransformsAnchor = "  const beforeTransforms = captureAuthoredPartTransforms(a1Model);";
  const beforeTransformsReplacement = `  const rotundaPortalAlignment = alignExactRotundaOpeningToTerminal(THREE, fleet, a1Model, terminalDirection);
  const beforeTransforms = captureAuthoredPartTransforms(a1Model);`;
  if (!source.includes(beforeTransformsAnchor)) throw new Error(`${installationPath}: authored transform baseline anchor is missing`);
  source = source.replace(beforeTransformsAnchor, beforeTransformsReplacement);

  const measureCallBefore = "  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);";
  const measureCallAfter = "  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection, rotundaPortalAlignment.openingDirection);";
  if (!source.includes(measureCallBefore)) throw new Error(`${installationPath}: Rotunda opening measurement call is missing`);
  source = source.replace(measureCallBefore, measureCallAfter);

  source = source.replace(
    "  group.userData.uploadedJetwayA1RotundaPortalCorrectionRadians = 0;\n  group.userData.uploadedJetwayA1PortalAlignmentErrorRadians = 0;",
    `  group.userData.uploadedJetwayA1RotundaPortalCorrectionAuthority = rotundaPortalAlignment.authority;
  group.userData.uploadedJetwayA1RotundaPortalCorrectionRadians = rotundaPortalAlignment.yawCorrectionRadians;
  group.userData.uploadedJetwayA1PortalAlignmentErrorRadians = rotundaPortalAlignment.alignmentErrorRadians;
  group.userData.uploadedJetwayA1PortalTerminalFacingDotBefore = rotundaPortalAlignment.terminalFacingDotBefore;
  group.userData.uploadedJetwayA1PortalTerminalFacingDot = rotundaPortalAlignment.terminalFacingDot;
  group.userData.uploadedJetwayA1PortalCenterErrorMeters = rotundaPortalAlignment.centerErrorMeters;`,
  );
}

for (const forbidden of [
  "terminalFacingDot < 0.4",
  "uploadedJetwayA1RotundaPortalCorrectionRadians = 0;",
  "uploadedJetwayA1PortalAlignmentErrorRadians = 0;",
]) {
  if (source.includes(forbidden)) throw new Error(`${installationPath}: stale non-physical Rotunda portal rule survived: ${forbidden}`);
}
for (const required of [
  AUTHORITY,
  "function alignExactRotundaOpeningToTerminal",
  "const rotundaPortalAlignment = alignExactRotundaOpeningToTerminal",
  "alignedOpeningDirection = null",
  `terminalFacingDot < ${MINIMUM_TERMINAL_FACING_DOT}`,
  "rotundaRoot.quaternion.copy(desiredRotundaLocalQuaternion);",
  "rotundaRoot.position.add(desiredCenterInParent.sub(currentCenterInParent));",
  "uploadedJetwayA1RotundaPortalCorrectionAuthority = rotundaPortalAlignment.authority",
  "uploadedJetwayA1PortalTerminalFacingDot = rotundaPortalAlignment.terminalFacingDot",
]) {
  if (!source.includes(required)) throw new Error(`${installationPath}: physical Rotunda portal alignment is missing ${required}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Prepared A1 Rotunda as the real elbow: the supplied terminal opening (opposite Tunnel A in the authored GLB) is yawed about its fixed center to the measured Terminal 4 wall, while Tunnel A/B/C/Cab remain untouched; final portal/wall alignment must exceed 0.985 dot product.");
