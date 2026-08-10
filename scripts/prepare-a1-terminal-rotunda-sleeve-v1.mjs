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

// The same-day A1 reference shows a short rigid white vestibule meeting the
// terminal-side Rotunda at a normal joint. Do not hide a placement error by
// burying metres of generated shell inside the authored Rotunda or terminal.
// Keep only a small construction overlap at each end so the exact supplied
// Rotunda remains visually readable and the real wall owns the attachment.
source = source
  .replace(
    /const ROTUNDA_SHELL_OVERLAP_METERS = [^;]+;/,
    `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  )
  .replace(
    /const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  );

const supportHelperMarker = "A1 stationary Rotunda support owns its own ramp contact v1";
if (!source.includes(supportHelperMarker)) {
  const helperAnchor = "function wrappedAngle(THREE, radians) {";
  if (!source.includes(helperAnchor)) {
    throw new Error(`${sourcePath}: wrapped-angle anchor is missing for stationary Rotunda support grounding`);
  }
  const supportHelper = `function groundA1StationaryRotundaSupport(THREE, fleet, model, rotunda) {
  // ${supportHelperMarker}
  // The exact supplied GLB has two legitimate ground-contact families at
  // different authored Y levels: the moving Tunnel-C/bogie assembly and the
  // stationary Rotunda pedestal. Grounding the complete parent by the bogie
  // alone leaves the Rotunda pedestal roughly 1.6 m in the air. Preserve every
  // node transform and every passenger-level Rotunda vertex; stretch only the
  // authored lower pedestal geometry so its original foot reaches the same
  // physical ramp plane as the bogie.
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

const supportCallMarker = "const stationaryRotundaSupport = groundA1StationaryRotundaSupport";
if (!source.includes(supportCallMarker)) {
  const supportCallAnchor = "  if (rotundaPreservationErrorMeters > 1e-6) throw new Error(`A1 real-wall Rotunda moved during aircraft-side pivot: ${rotundaPreservationErrorMeters}`);\n\n";
  if (!source.includes(supportCallAnchor)) {
    throw new Error(`${sourcePath}: Rotunda preservation anchor is missing for stationary support grounding`);
  }
  source = source.replace(
    supportCallAnchor,
    `${supportCallAnchor}  const stationaryRotundaSupport = groundA1StationaryRotundaSupport(THREE, fleet, model, rotunda);\n\n`,
  );
}

const supportTelemetryMarker = "uploadedJetwayA1StationaryRotundaSupportGroundAuthority";
if (!source.includes(supportTelemetryMarker)) {
  const telemetryAnchor = "  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;";
  if (!source.includes(telemetryAnchor)) {
    throw new Error(`${sourcePath}: A1 elbow telemetry anchor is missing for stationary support evidence`);
  }
  const telemetry = `  group.userData.uploadedJetwayA1StationaryRotundaSupportGroundAuthority = stationaryRotundaSupport.authority;
  group.userData.uploadedJetwayA1StationaryRotundaSupportSourceGapMeters = stationaryRotundaSupport.sourceGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportAppliedExtensionMeters = stationaryRotundaSupport.appliedExtensionMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportFinalGroundGapMeters = stationaryRotundaSupport.finalGroundGapMeters;
  group.userData.uploadedJetwayA1StationaryRotundaSupportChangedVertexCount = stationaryRotundaSupport.changedVertexCount;
`;
  source = source.replace(telemetryAnchor, `${telemetry}${telemetryAnchor}`);
}

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
  "const ROTUNDA_SHELL_OVERLAP_METERS = 1.50;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;",
  "  const depth = 1.50;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden masking overlap survived: ${forbidden.trim()}`);
  }
}
for (const required of [
  `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  supportHelperMarker,
  supportCallMarker,
  supportTelemetryMarker,
  STATIONARY_SUPPORT_AUTHORITY,
  `sourceGapMeters >= ${MINIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `sourceGapMeters <= ${MAXIMUM_EXPECTED_SUPPORT_GAP_METERS.toFixed(2)}`,
  `Math.abs(finalGroundGapMeters) > ${MAXIMUM_FINAL_SUPPORT_GAP_METERS.toFixed(3)}`,
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: missing final A1 requirement ${required}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda joint with only ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m Rotunda overlap and ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m terminal-wall overlap; the exact supplied Rotunda passenger geometry stays fixed while its authored stationary pedestal is stretched down to the bogie ramp plane under ${STATIONARY_SUPPORT_AUTHORITY}.`);
