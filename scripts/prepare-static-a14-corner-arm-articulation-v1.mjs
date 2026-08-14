import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-a14-terminal-corner-measured-zero-overlap-articulation-v2";
const authority = "a14-terminal-corner-exact-arm-minus-7.5deg-zero-raw-overlap-v2";
const articulationDegrees = -7.5;
const articulationRadians = -Math.PI / 24;
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const validationAnchor = "  const finalOccupiedCenterlines = staticRegisteredPlacements.map(staticFinalOccupiedCenterline);";
  if (!source.includes(validationAnchor)) {
    throw new Error(`${runtimePath}: final static occupied-centerline validation anchor is missing`);
  }

  const patch = `  // ${marker}\n  // A12 and A14 occupy adjacent faces of a 90-degree Terminal 4 corner. Keep\n  // A14's measured real-wall Rotunda fixed and articulate only the exact\n  // supplied downstream passenger arm (Tunnel A/B/C + Cab) around that pivot.\n  // Browser exact-envelope measurement established -7.50 degrees as the\n  // smallest tested pose with literal zero A12/A14 raw X/Z envelope overlap:\n  // -7.25 degrees still penetrated 0.100507 m, while -7.50 degrees measured 0.\n  // The global seven-part fleet overlap validator below remains fail-closed.\n  const a14CornerArmIndex = staticRegisteredPlacements.findIndex((placement) => placement.gate === "A14");\n  if (a14CornerArmIndex < 0) throw new Error("Static A14 corner-arm articulation is missing Gate A14");\n  const a14CornerPlacement = staticRegisteredPlacements[a14CornerArmIndex];\n  const a14PivotX = Number(a14CornerPlacement.staticModelRootX);\n  const a14PivotZ = Number(a14CornerPlacement.staticModelRootZ);\n  if (![a14PivotX, a14PivotZ].every(Number.isFinite)) {\n    throw new Error("Static A14 corner-arm articulation has an invalid measured Rotunda pivot");\n  }\n  const a14ToOrigin = new THREE.Matrix4().makeTranslation(-a14PivotX, 0, -a14PivotZ);\n  const a14Rotation = new THREE.Matrix4().makeRotationY(${articulationRadians});\n  const a14FromOrigin = new THREE.Matrix4().makeTranslation(a14PivotX, 0, a14PivotZ);\n  const a14ArmDelta = new THREE.Matrix4().multiplyMatrices(a14FromOrigin, a14Rotation).multiply(a14ToOrigin);\n  const a14CurrentMatrix = new THREE.Matrix4();\n  const a14NextMatrix = new THREE.Matrix4();\n  for (const batch of staticBatches) {\n    if (batch.userData?.sourcePartName === "Rotunda") continue;\n    batch.getMatrixAt(a14CornerArmIndex, a14CurrentMatrix);\n    a14NextMatrix.multiplyMatrices(a14ArmDelta, a14CurrentMatrix);\n    batch.setMatrixAt(a14CornerArmIndex, a14NextMatrix);\n    batch.instanceMatrix.needsUpdate = true;\n    batch.computeBoundingBox();\n    batch.computeBoundingSphere();\n  }\n  a14CornerPlacement.staticCornerArmArticulationRadians = ${articulationRadians};\n  a14CornerPlacement.staticCornerArmArticulationDegrees = ${articulationDegrees};\n  a14CornerPlacement.staticCornerArmArticulationAuthority = "${authority}";\n\n  const a14CornerPartEnvelopes = staticBatches.map((batch) => ({\n    sourcePartName: batch.userData?.sourcePartName,\n    envelope: staticExactInstanceEnvelope(THREE, batch, a14CornerArmIndex),\n  }));\n  const a14RotundaEnvelope = a14CornerPartEnvelopes.find((entry) => entry.sourcePartName === "Rotunda")?.envelope;\n  const a14TunnelAEnvelope = a14CornerPartEnvelopes.find((entry) => entry.sourcePartName === "Tunnel_A")?.envelope;\n  if (!a14RotundaEnvelope || !a14TunnelAEnvelope) {\n    throw new Error("Static A14 corner-arm articulation lost Rotunda/Tunnel A exact-part evidence");\n  }\n  const a14RotundaTunnelAEnvelopeOverlapMeters = staticEnvelopeOverlapDepthXZ(a14RotundaEnvelope, a14TunnelAEnvelope);\n  if (!(a14RotundaTunnelAEnvelopeOverlapMeters > 0.5)) {\n    throw new Error(\`Static A14 corner-arm articulation separated Tunnel A from its supplied Rotunda: \${a14RotundaTunnelAEnvelopeOverlapMeters} m\`);\n  }\n  a14CornerPlacement.staticCornerArmRotundaTunnelAEnvelopeOverlapMeters = a14RotundaTunnelAEnvelopeOverlapMeters;\n\n${validationAnchor}`;
  source = source.replace(validationAnchor, patch);

  const telemetryAnchor = "  group.userData.uploadedJetwayStaticMaximumExactPartOverlapDepthMeters = maximumStaticExactPartOverlapDepthMeters;";
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${runtimePath}: static exact-part telemetry anchor is missing`);
  }
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  group.userData.uploadedJetwayStaticA14CornerArmAuthority = "${authority}";\n  group.userData.uploadedJetwayStaticA14CornerArmArticulationDegrees = ${articulationDegrees};\n  group.userData.uploadedJetwayStaticA14RotundaTunnelAEnvelopeOverlapMeters = a14CornerPlacement.staticCornerArmRotundaTunnelAEnvelopeOverlapMeters;`,
  );
}

for (const required of [
  marker,
  authority,
  "a14CornerArmIndex",
  "a14ArmDelta",
  'batch.userData?.sourcePartName === "Rotunda"',
  `staticCornerArmArticulationDegrees = ${articulationDegrees}`,
  "a14RotundaTunnelAEnvelopeOverlapMeters",
  `uploadedJetwayStaticA14CornerArmArticulationDegrees = ${articulationDegrees}`,
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: A14 measured corner-arm articulation is missing ${required}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Applied the measured -7.50 degree A14 exact passenger-arm articulation around its fixed real-wall Rotunda; raw A12/A14 envelope overlap is zero at this pose and the global seven-part fleet overlap validator remains fail-closed.");
