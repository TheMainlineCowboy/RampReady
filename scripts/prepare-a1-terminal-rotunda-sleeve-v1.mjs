import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
const TERMINAL_WALL_HIDDEN_OVERLAP_METERS = 0.18;
const REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.14;
const STATIONARY_SUPPORT_AUTHORITY = "a1-authored-rotunda-stationary-support-stretched-to-bogie-ramp-plane-v1";
const STATIONARY_SUPPORT_SOURCE_SPAN_METERS = 1.72;
const MINIMUM_EXPECTED_SUPPORT_GAP_METERS = 1.30;
const MAXIMUM_EXPECTED_SUPPORT_GAP_METERS = 2.15;
const MAXIMUM_FINAL_SUPPORT_GAP_METERS = 0.012;
const MAXIMUM_SUPPORT_CORRECTION_PASSES = 3;

let source = fs.readFileSync(sourcePath, "utf8");

source = source
  .replace(
    /const ROTUNDA_SHELL_OVERLAP_METERS = [^;]+;/,
    `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  )
  .replace(
    /const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  );

const supportHelperMarker = "A1 stationary Rotunda support owns its own ramp contact v3";
const legacySupportHelperMarkers = [
  "A1 stationary Rotunda support owns its own ramp contact v1",
  "A1 stationary Rotunda support owns its own ramp contact v2",
];

// Replace any earlier helper wholesale. V3 measures the actual transformed
// pedestal after deformation and applies bounded corrective stretches rather
// than trusting a single source-bounds ratio to land the rendered foot.
const helperStart = source.indexOf("function groundA1StationaryRotundaSupport(");
const wrappedAngleStart = source.indexOf("function wrappedAngle(THREE, radians) {");
if (helperStart >= 0 && wrappedAngleStart > helperStart) {
  source = source.slice(0, helperStart) + source.slice(wrappedAngleStart);
}

if (!source.includes(supportHelperMarker)) {
  const helperAnchor = "function wrappedAngle(THREE, radians) {";
  if (!source.includes(helperAnchor)) {
    throw new Error(`${sourcePath}: wrapped-angle anchor is missing for stationary Rotunda support grounding`);
  }
  const supportHelper = `function groundA1StationaryRotundaSupport(THREE, group, fleet, model, rotunda) {
  // ${supportHelperMarker}
  // The exact supplied GLB has two legitimate ground-contact families at
  // different authored Y levels: the moving Tunnel-C/bogie assembly and the
  // stationary Rotunda pedestal. Grounding the complete parent by the bogie
  // alone leaves the Rotunda pedestal roughly two metres in the air in the
  // final production pose. Keep every object transform and every passenger-
  // level Rotunda vertex fixed; stretch only the authored lower pedestal.
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  rotunda.updateWorldMatrix(true, true);
  const modelBoundsBefore = new THREE.Box3().setFromObject(model);
  const rotundaBoundsBefore = new THREE.Box3().setFromObject(rotunda);
  if (modelBoundsBefore.isEmpty() || rotundaBoundsBefore.isEmpty()) {
    throw new Error("A1 stationary Rotunda support bounds are empty");
  }
  const sourceModelGroundY = modelBoundsBefore.min.y;
  const sourceRotundaFootY = rotundaBoundsBefore.min.y;
  const sourceGapMeters = sourceRotundaFootY - sourceModelGroundY;
  if (!(sourceGapMeters >= ${MINIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)} && sourceGapMeters <= ${MAXIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)})) {
    throw new Error("A1 stationary Rotunda authored support gap is outside the exact-source envelope: " + sourceGapMeters);
  }

  const supportTopWorldY = sourceRotundaFootY + ${STATIONARY_SUPPORT_SOURCE_SPAN_METERS.toFixed(2)};
  const sourceSupportSpanMeters = supportTopWorldY - sourceRotundaFootY;
  const targetSupportSpanMeters = supportTopWorldY - sourceModelGroundY;
  const supportStretch = targetSupportSpanMeters / sourceSupportSpanMeters;
  if (!(supportStretch > 1.5 && supportStretch < 2.4)) {
    throw new Error("A1 stationary Rotunda support stretch is invalid: " + supportStretch);
  }

  let changedVertexCount = 0;
  let correctionPassCount = 0;
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();

  const stretchLowerPedestalFromFixedTop = (stretchFactor) => {
    if (!(Number.isFinite(stretchFactor) && stretchFactor > 0.90 && stretchFactor < 2.50)) {
      throw new Error("A1 stationary Rotunda support corrective scale is invalid: " + stretchFactor);
    }
    rotunda.traverse((entry) => {
      if (!entry?.isMesh || !entry.geometry?.getAttribute?.("position")) return;
      const geometry = entry.geometry.clone();
      const position = geometry.getAttribute("position");
      entry.geometry = geometry;
      entry.updateWorldMatrix(true, false);
      for (let index = 0; index < position.count; index += 1) {
        localPoint.fromBufferAttribute(position, index);
        worldPoint.copy(localPoint).applyMatrix4(entry.matrixWorld);
        if (worldPoint.y > supportTopWorldY + 1e-5) continue;
        const distanceBelowSupportTop = supportTopWorldY - worldPoint.y;
        worldPoint.y = supportTopWorldY - distanceBelowSupportTop * stretchFactor;
        entry.worldToLocal(localPoint.copy(worldPoint));
        position.setXYZ(index, localPoint.x, localPoint.y, localPoint.z);
        changedVertexCount += 1;
      }
      position.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    });
    fleet.updateWorldMatrix(true, true);
    model.updateWorldMatrix(true, true);
    rotunda.updateWorldMatrix(true, true);
  };

  stretchLowerPedestalFromFixedTop(supportStretch);
  if (changedVertexCount < 100) {
    throw new Error("A1 stationary Rotunda support changed too few authored vertices: " + changedVertexCount);
  }

  let rotundaBoundsAfter = new THREE.Box3().setFromObject(rotunda);
  let finalGroundGapMeters = rotundaBoundsAfter.min.y - sourceModelGroundY;
  while (Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)} && correctionPassCount < ${MAXIMUM_SUPPORT_CORRECTION_PASSES}) {
    const currentSupportSpanMeters = supportTopWorldY - rotundaBoundsAfter.min.y;
    const desiredSupportSpanMeters = supportTopWorldY - sourceModelGroundY;
    const correctionScale = desiredSupportSpanMeters / currentSupportSpanMeters;
    if (!(Number.isFinite(correctionScale) && correctionScale > 0.95 && correctionScale < 1.15)) {
      throw new Error("A1 stationary Rotunda support residual correction is outside the bounded envelope: gap=" + finalGroundGapMeters + " scale=" + correctionScale);
    }
    stretchLowerPedestalFromFixedTop(correctionScale);
    correctionPassCount += 1;
    rotundaBoundsAfter = new THREE.Box3().setFromObject(rotunda);
    finalGroundGapMeters = rotundaBoundsAfter.min.y - sourceModelGroundY;
  }

  if (Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)}) {
    throw new Error("A1 stationary Rotunda support did not reach the bogie ramp plane after corrective seating: " + finalGroundGapMeters);
  }
  const appliedExtensionMeters = sourceRotundaFootY - rotundaBoundsAfter.min.y;

  rotunda.userData.a1StationarySupportGroundAuthority = "${STATIONARY_SUPPORT_AUTHORITY}";
  rotunda.userData.a1StationarySupportSourceGapMeters = sourceGapMeters;
  rotunda.userData.a1StationarySupportAppliedExtensionMeters = appliedExtensionMeters;
  rotunda.userData.a1StationarySupportFinalGroundGapMeters = finalGroundGapMeters;
  rotunda.userData.a1StationarySupportChangedVertexCount = changedVertexCount;
  rotunda.userData.a1StationarySupportCorrectionPassCount = correctionPassCount;
  group.userData.uploadedJetwayA1StationaryRotundaSupportGroundAuthority = "${STATIONARY_SUPPORT_AUTHORITY}";
  group.userData.uploadedJetwayA1StationaryRotundaSupportSourceGapMeters = sourceGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportAppliedExtensionMeters = appliedExtensionMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportFinalGroundGapMeters = finalGroundGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportChangedVertexCount = changedVertexCount;
  group.userData.uploadedJetwayA1StationaryRotundaSupportStretch = supportStretch;
  group.userData.uploadedJetwayA1StationaryRotundaSupportCorrectionPassCount = correctionPassCount;

  return Object.freeze({
    authority: "${STATIONARY_SUPPORT_AUTHORITY}",
    sourceGapMeters,
    appliedExtensionMeters,
    finalGroundGapMeters,
    changedVertexCount,
    supportStretch,
    correctionPassCount,
  });
}

`;
  source = source.replace(helperAnchor, `${supportHelper}${helperAnchor}`);
}

source = source
  .replace(/\n\s*const stationaryRotundaSupport = groundA1StationaryRotundaSupport\([^;]+;\n/g, "\n")
  .replace(/\n\s*groundA1StationaryRotundaSupport\(THREE, group, fleet, model, rotunda\);\n/g, "\n")
  .replace(/\n\s*group\.userData\.uploadedJetwayA1StationaryRotundaSupportGroundAuthority = stationaryRotundaSupport\.authority;\n\s*group\.userData\.uploadedJetwayA1StationaryRotundaSupportSourceGapMeters = stationaryRotundaSupport\.sourceGapMeters;\n\s*group\.userData\.uploadedJetwayA1StationaryRotundaSupportAppliedExtensionMeters = stationaryRotundaSupport\.appliedExtensionMeters;\n\s*group\.userData\.uploadedJetwayA1StationaryRotundaSupportFinalGroundGapMeters = stationaryRotundaSupport\.finalGroundGapMeters;\n\s*group\.userData\.uploadedJetwayA1StationaryRotundaSupportChangedVertexCount = stationaryRotundaSupport\.changedVertexCount;\n/g, "\n");

const stableLateCallAnchor = "  group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters = cabTargetHorizontalErrorMeters;";
if (!source.includes(stableLateCallAnchor)) {
  throw new Error(`${sourcePath}: stable Cab telemetry anchor is missing for stationary support grounding`);
}
source = source.replace(
  stableLateCallAnchor,
  `  groundA1StationaryRotundaSupport(THREE, group, fleet, model, rotunda);\n${stableLateCallAnchor}`,
);

const compactBellowsFunction = source.indexOf("function addCompactRotundaBellows(");
const nextFunction = source.indexOf("function addRotundaBridgeBellowsSleeve(", compactBellowsFunction);
if (compactBellowsFunction < 0 || nextFunction < 0) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows function was not found`);
}
const bellowsBlock = source.slice(compactBellowsFunction, nextFunction);
const requiredDepth = `  const depth = ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)};`;
if (!bellowsBlock.includes(requiredDepth)) {
  throw new Error(`${sourcePath}: terminal-to-Rotunda bellows must remain the compact ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m seam`);
}

for (const forbidden of [
  ...legacySupportHelperMarkers,
  "stationaryRotundaSupport.authority",
  "stationaryRotundaSupport.sourceGapMeters",
  "stationaryRotundaSupport.appliedExtensionMeters",
  "stationaryRotundaSupport.finalGroundGapMeters",
  "stationaryRotundaSupport.changedVertexCount",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 1.50;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;",
  "  const depth = 1.50;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden stale stationary-support or masking code survived: ${forbidden}`);
  }
}
for (const required of [
  `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  supportHelperMarker,
  "groundA1StationaryRotundaSupport(THREE, group, fleet, model, rotunda);",
  "uploadedJetwayA1StationaryRotundaSupportGroundAuthority",
  "uploadedJetwayA1StationaryRotundaSupportCorrectionPassCount",
  STATIONARY_SUPPORT_AUTHORITY,
  `sourceGapMeters >= ${MINIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `sourceGapMeters <= ${MAXIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)}`,
  `correctionPassCount < ${MAXIMUM_SUPPORT_CORRECTION_PASSES}`,
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: missing final A1 stationary-support requirement ${required}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda joint with ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m Rotunda overlap and ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m terminal-wall overlap; the exact passenger-level Rotunda stays fixed while its authored stationary pedestal is iteratively seated on the measured bogie ramp plane under ${STATIONARY_SUPPORT_AUTHORITY}.`);
