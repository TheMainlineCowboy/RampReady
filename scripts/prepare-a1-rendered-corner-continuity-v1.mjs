import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const authority = "rendered-a1-terminal-rotunda-tunnel-a-continuous-exterior-v1";
const ROTUNDA_BRIDGE_OVERLAP_METERS = 0.65;
const TUNNEL_A_OVERLAP_METERS = 0.65;

let source = fs.readFileSync(sourcePath, "utf8");

source = source
  .replace(
    /const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  )
  .replace(
    /const TUNNEL_A_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  );

// The previous exterior joint could pass endpoint math while still reading as
// an open black break from the ramp. Keep the authored Rotunda and supplied
// bridge hierarchy intact, but make the short Rotunda->Tunnel-A sleeve use the
// same exterior shell finish as the terminal-side leg. The dark bellows remain
// represented at the compact terminal collar; the long visible outside corner
// may not be a black void.
const bridgeMaterialNeedle = `    materials.bellows,\n    bridgeSealStartLocal,`;
if (source.includes(bridgeMaterialNeedle)) {
  source = source.replace(
    bridgeMaterialNeedle,
    `    materials.shell,\n    bridgeSealStartLocal,`,
  );
}

const shroudMarker = `connector.userData.renderedCornerContinuityAuthority = "${authority}";`;
if (!source.includes(shroudMarker)) {
  const anchor = "  fleet.add(connector);\n\n  const bridgeJoint = new THREE.Group();";
  if (!source.includes(anchor)) {
    throw new Error(`${sourcePath}: rendered A1 corner continuity insertion anchor is missing`);
  }
  const injection = `  // Rendered exterior continuity v1: the authored Rotunda remains the physical\n  // pivot, while a compact source-sized outer housing prevents the passenger-\n  // level corner from presenting as an open apron-facing hole. This housing is\n  // derived from the measured Rotunda/Tunnel-A envelope and does not move,\n  // rotate, telescope, or replace any supplied GLB child.\n  const rotundaOuterRadiusMeters = THREE.MathUtils.clamp(\n    Math.max(rotundaTerminalSurfaceMeters, rotundaBridgeSurfaceMeters) * 0.82,\n    1.42,\n    1.92,\n  );\n  const rotundaOuterHeightMeters = THREE.MathUtils.clamp(\n    Math.max(height, bridgeBellowsHeightMeters) + 0.20,\n    2.58,\n    3.34,\n  );\n  const rotundaOuterShroud = new THREE.Mesh(\n    new THREE.CylinderGeometry(\n      rotundaOuterRadiusMeters,\n      rotundaOuterRadiusMeters,\n      rotundaOuterHeightMeters,\n      12,\n      1,\n      false,\n    ),\n    materials.shell,\n  );\n  rotundaOuterShroud.name = "UploadedAirportJetwayA1TerminalRotundaOuterShroud";\n  rotundaOuterShroud.position.copy(rotundaCenter);\n  rotundaOuterShroud.castShadow = true;\n  rotundaOuterShroud.receiveShadow = true;\n  connector.add(rotundaOuterShroud);\n  connector.userData.renderedCornerContinuityAuthority = "${authority}";\n  connector.userData.rotundaOuterRadiusMeters = rotundaOuterRadiusMeters;\n  connector.userData.rotundaOuterHeightMeters = rotundaOuterHeightMeters;\n  fleet.add(connector);\n\n  const bridgeJoint = new THREE.Group();`;
  source = source.replace(anchor, injection);
}

const telemetryAnchor = "  group.userData.uploadedJetwayA1RotundaTunnelAVisibleOpenAreaMeters = 0;";
if (!source.includes(telemetryAnchor)) {
  throw new Error(`${sourcePath}: A1 Rotunda/Tunnel-A visible-open-area telemetry anchor is missing`);
}
if (!source.includes("uploadedJetwayA1RenderedCornerContinuityAuthority")) {
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  group.userData.uploadedJetwayA1RenderedCornerContinuityAuthority = "${authority}";\n  group.userData.uploadedJetwayA1RenderedCornerExteriorClosed = true;`,
  );
}

for (const required of [
  `const ROTUNDA_BRIDGE_HIDDEN_OVERLAP_METERS = ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)};`,
  `const TUNNEL_A_HIDDEN_OVERLAP_METERS = ${TUNNEL_A_OVERLAP_METERS.toFixed(2)};`,
  "UploadedAirportJetwayA1TerminalRotundaOuterShroud",
  `renderedCornerContinuityAuthority = "${authority}"`,
  `uploadedJetwayA1RenderedCornerContinuityAuthority = "${authority}"`,
  "materials.shell,\n    bridgeSealStartLocal,",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: missing rendered-corner continuity requirement ${required}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 rendered exterior continuity: compact source-sized Rotunda housing, white exterior Rotunda/Tunnel-A sleeve, ${ROTUNDA_BRIDGE_OVERLAP_METERS.toFixed(2)} m Rotunda overlap and ${TUNNEL_A_OVERLAP_METERS.toFixed(2)} m Tunnel-A overlap under ${authority}.`);
