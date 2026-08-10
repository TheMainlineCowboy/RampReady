import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
const TERMINAL_WALL_HIDDEN_OVERLAP_METERS = 0.18;
const REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.14;
const STATIONARY_SUPPORT_AUTHORITY = "a1-authored-rotunda-stationary-support-stretched-to-bogie-ramp-plane-v1";
const STATIONARY_SUPPORT_SOURCE_SPAN_METERS = 1.72;
const MINIMUM_EXPECTED_SUPPORT_GAP_METERS = 1.30;
const MAXIMUM_EXPECTED_SUPPORT_GAP_METERS = 1.90;
const MAXIMUM_FINAL_SUPPORT_GAP_METERS = 0.012;

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

const supportHelperMarker = "A1 stationary Rotunda support owns its own ramp contact v2";
const legacySupportHelperMarker = "A1 stationary Rotunda support owns its own ramp contact v1";

// Replace the v1 helper wholesale when present. The v2 helper writes its own
// telemetry directly onto the A1 group so later production transforms cannot
// leave a dead local variable behind while preserving its evidence lines.
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
  // alone leaves the Rotunda pedestal roughly 1.6 m in the air. Keep every
  // object transform and every passenger-level Rotunda vertex fixed; stretch
  // only the authored lower pedestal geometry so its original foot reaches the
  // same physical ramp plane as the bogie.
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
  const localPoint = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();
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
      worldPoint.y = supportTopWorldY - distanceBelowSupportTop * supportStretch;
      entry.worldToLocal(localPoint.copy(worldPoint));
      position.setXYZ(index, localPoint.x, localPoint.y, localPoint.z);
      changedVertexCount += 1;
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
  if (changedVertexCount < 100) {
    throw new Error("A1 stationary Rotunda support changed too few authored vertices: " + changedVertexCount);
  }

  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  rotunda.updateWorldMatrix(true, true);
  const rotundaBoundsAfter = new THREE.Box3().setFromObject(rotunda);
  const finalGroundGapMeters = rotundaBoundsAfter.min.y - sourceModelGroundY;
  if (Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)}) {
    throw new Error("A1 stationary Rotunda support did not reach the bogie ramp plane: " + finalGroundGapMeters);
  }
  const appliedExtensionMeters = sourceRotundaFootY - rotundaBoundsAfter.min.y;

  rotunda.userData.a1StationarySupportGroundAuthority = "${STATIONARY_SUPPORT_AUTHORITY}";
  rotunda.userData.a1StationarySupportSourceGapMeters = sourceGapMeters;
  rotunda.userData.a1StationarySupportAppliedExtensionMeters = appliedExtensionMeters;
  rotunda.userData.a1StationarySupportFinalGroundGapMeters = finalGroundGapMeters;
  rotunda.userData.a1StationarySupportChangedVertexCount = changedVertexCount;
  group.userData.uploadedJetwayA1StationaryRotundaSupportGroundAuthority = "${STATIONARY_SUPPORT_AUTHORITY}";
  group.userData.uploadedJetwayA1StationaryRotundaSupportSourceGapMeters = sourceGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportAppliedExtensionMeters = appliedExtensionMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportFinalGroundGapMeters = finalGroundGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportChangedVertexCount = changedVertexCount;
  group.userData.uploadedJetwayA1StationaryRotundaSupportStretch = supportStretch;

  return Object.freeze({
    authority: "${STATIONARY_SUPPORT_AUTHORITY}",
    sourceGapMeters,
    appliedExtensionMeters,
    finalGroundGapMeters,
    changedVertexCount,
    supportStretch,
  });
}

`;
  source = source.replace(helperAnchor, `${supportHelper}${helperAnchor}`);
}

// Remove the fragile v1 local declaration and any old telemetry block that
// dereferenced it. Later production transforms rewrite the Rotunda positioning
// section, but preserve the Cab telemetry section; attach the grounding call
// there so the final bundled source always executes it.
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
  legacySupportHelperMarker,
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
  STATIONARY_SUPPORT_AUTHORITY,
  `sourceGapMeters >= ${MINIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `sourceGapMeters <= ${MAXIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)}`,
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: missing final A1 stationary-support requirement ${required}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda joint with ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m Rotunda overlap and ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m terminal-wall overlap; the exact passenger-level Rotunda stays fixed while its authored stationary pedestal is independently grounded to the bogie ramp plane under ${STATIONARY_SUPPORT_AUTHORITY}.`);
