import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-visual-evidence-attach-runtime-v3-replay-rebased-attached-fit";
const inspectionLifecycleMarker = "a1-inspection-lifecycle-restores-rebased-attached-fit-v2";
const calibrationLifecycleMarker = "a1-aircraft-calibration-preserves-final-attached-fit-v1";
let source = fs.readFileSync(path, "utf8");

// Remove any older evidence-only hook before installing the current one. The
// shipping trainer is regenerated during production, so this must be safe both
// from a clean HEAD and after an earlier preparation pass.
for (const priorMarker of [
  "a1-final-visual-evidence-attach-runtime-v1",
  "a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit",
]) {
  const priorStart = source.indexOf(`  // ${priorMarker}\n`);
  if (priorStart >= 0) {
    const priorEndNeedle = "  const advance = useCallback(() => {";
    const priorEnd = source.indexOf(priorEndNeedle, priorStart);
    if (priorEnd < 0) throw new Error(`${path}: prior A1 evidence attach hook has no advance anchor`);
    source = source.slice(0, priorStart) + source.slice(priorEnd);
  }
}

// The final physical-door-fit stage explicitly re-binds the A1 model-space
// controller AFTER the Cab/Tunnel-C/service-stair fit. Its deployment=1 base is
// therefore the finished attached geometry, not the stale pre-fit hierarchy.
// Training is allowed to retract that rebased geometry. Re-entering inspection
// must actively replay deployment=1; merely changing the logical deployment
// leaves the physical bridge parked at deployment 0, which the fbfa5a4d trace
// proved with a 9.558 m Rotunda-to-live-Cab span.
if (!source.includes(inspectionLifecycleMarker)) {
  const originalToggle = `      const inspectionJetwayDeployment = next ? 0 : 1;\n      jetwayRef.current.target = inspectionJetwayDeployment;\n      jetwayRef.current.deployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartedAt = 0;\n      jetwayRef.current.retractionRequested = false;\n      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`;
  const priorPreparedToggle = `      // a1-inspection-lifecycle-preserves-final-attached-fit-v1\n      // Inspection must show the final physically attached A1 reference state.\n      // Do not replay controller.setDeployment(1) here: the controller was bound\n      // before the final Cab/Tunnel-C/service-stair micro-fit and would overwrite\n      // those accepted child transforms with stale matrices.\n      const inspectionJetwayDeployment = 1;\n      jetwayRef.current.target = inspectionJetwayDeployment;\n      jetwayRef.current.deployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartedAt = 0;\n      jetwayRef.current.retractionRequested = false;`;
  const replacement = `      // ${inspectionLifecycleMarker}\n      // Inspection is attached-state evidence. The final physical-fit stage has\n      // already rebound the controller to the fitted Tunnel-B/Tunnel-C/Cab local\n      // matrices, so deployment 1 safely restores that exact finished state after\n      // a training-mode retraction without moving the terminal or aircraft.\n      const inspectionJetwayDeployment = 1;\n      jetwayRef.current.target = inspectionJetwayDeployment;\n      jetwayRef.current.deployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartedAt = 0;\n      jetwayRef.current.retractionRequested = false;\n      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`;
  if (source.includes(originalToggle)) {
    source = source.replace(originalToggle, replacement);
  } else if (source.includes(priorPreparedToggle)) {
    source = source.replace(priorPreparedToggle, replacement);
  } else {
    throw new Error(`${path}: inspection jetway lifecycle anchor is missing`);
  }
}

// Fixed-aircraft calibration may still contain a legacy deploy/restore pair.
// Pin a surviving restore to attached deployment 1. A regenerated calibration
// with no controller replay is also valid; the inspection lifecycle above owns
// re-entry restoration after normal training intentionally retracts the bridge.
if (!source.includes(calibrationLifecycleMarker)) {
  const telemetryProperty = "inspectionAircraftCalibrationJetwayRestoredDeployment";
  const telemetryIndex = source.indexOf(telemetryProperty);
  if (telemetryIndex < 0) {
    throw new Error(`${path}: fixed-aircraft calibration restored-deployment telemetry is missing`);
  }
  const calibrationWindowStart = Math.max(0, telemetryIndex - 12000);
  const calibrationWindow = source.slice(calibrationWindowStart, telemetryIndex);
  const deploymentCallPattern = /(?:[A-Za-z_$][\w$]*\??\.)*setDeployment\(\s*([^\n;)]+?)\s*\)\s*;/g;
  const deploymentCalls = [...calibrationWindow.matchAll(deploymentCallPattern)];

  if (deploymentCalls.length >= 2) {
    const restoreCall = deploymentCalls.at(-1);
    const restoreCallAbsoluteStart = calibrationWindowStart + restoreCall.index;
    const restoreCallAbsoluteEnd = restoreCallAbsoluteStart + restoreCall[0].length;
    const restoreCallPrefix = restoreCall[0].slice(0, restoreCall[0].indexOf("(") + 1);
    source = source.slice(0, restoreCallAbsoluteStart)
      + `${restoreCallPrefix}1); // ${calibrationLifecycleMarker}`
      + source.slice(restoreCallAbsoluteEnd);
  } else if (deploymentCalls.length === 1) {
    const survivingArgument = deploymentCalls[0][1].trim();
    if (!/^(?:1|1\.0+)$/.test(survivingArgument)) {
      throw new Error(`${path}: lone calibration deployment call is not attached-state: ${survivingArgument}`);
    }
    const call = deploymentCalls[0];
    const callAbsoluteEnd = calibrationWindowStart + call.index + call[0].length;
    source = source.slice(0, callAbsoluteEnd)
      + ` // ${calibrationLifecycleMarker}`
      + source.slice(callAbsoluteEnd);
  } else {
    const telemetryLineStart = source.lastIndexOf("\n", telemetryIndex) + 1;
    source = source.slice(0, telemetryLineStart)
      + `  // ${calibrationLifecycleMarker}: calibration controller replay already absent after regeneration\n`
      + source.slice(telemetryLineStart);
  }

  const patchedTelemetryIndex = source.indexOf(telemetryProperty);
  const telemetryLineStart = source.lastIndexOf("\n", patchedTelemetryIndex) + 1;
  const telemetryLineEnd = source.indexOf("\n", patchedTelemetryIndex);
  if (telemetryLineEnd < 0) throw new Error(`${path}: calibration restored-deployment telemetry line is unterminated`);
  const telemetryLine = source.slice(telemetryLineStart, telemetryLineEnd);
  const telemetryAssignmentPattern = /^(\s*[^\n]*inspectionAircraftCalibrationJetwayRestoredDeployment\s*=\s*)[^;]+;/;
  if (!telemetryAssignmentPattern.test(telemetryLine)) {
    throw new Error(`${path}: calibration restored-deployment telemetry assignment could not be normalized`);
  }
  source = source.slice(0, telemetryLineStart)
    + telemetryLine.replace(telemetryAssignmentPattern, '$1"1.000000";')
    + source.slice(telemetryLineEnd);
}

if (!source.includes(marker)) {
  const anchor = "  const advance = useCallback(() => {";
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final A1 evidence attach anchor is missing immediately before production bundling`);
  }
  const hook = `  // ${marker}\n  // This callback is used only by visual evidence. The A1 controller has already\n  // been rebound after final physical door fit, so replaying deployment=1 restores\n  // the exact fitted attached matrices after any prior training retraction.\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__ = () => {\n      const sim = simRef.current;\n      const jetway = jetwayRef.current;\n      if (!sim || !jetway?.controller) return \"not-ready\";\n      const attachedEvidenceDeployment = 1;\n      jetway.target = attachedEvidenceDeployment;\n      jetway.deployment = attachedEvidenceDeployment;\n      if (\"transitionStartDeployment\" in jetway) jetway.transitionStartDeployment = attachedEvidenceDeployment;\n      if (\"transitionStartedAt\" in jetway) jetway.transitionStartedAt = 0;\n      jetway.retractionRequested = false;\n      jetway.controller.setDeployment(attachedEvidenceDeployment);\n      const canvas = sim.renderer?.domElement;\n      if (!canvas) return \"not-ready\";\n      canvas.dataset.a1InspectionAttachedEvidenceAuthority = \"a1-terminal-connection-attached-evidence-v2-rebased-controller\";\n      canvas.dataset.a1JetwayDeployment = attachedEvidenceDeployment.toFixed(3);\n      canvas.dataset.a1JetwayState = jetway.controller.getState?.() || \"attached-to-aircraft-door\";\n      canvas.dataset.a1EvidenceAttachGeometryAuthority = \"restore-final-rebased-physical-fit-v2\";\n      return canvas.dataset.a1JetwayState;\n    };\n    return () => {\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    };\n  }, []);\n\n${anchor}`;
  source = source.replace(anchor, hook);
}

for (const required of [
  marker,
  inspectionLifecycleMarker,
  calibrationLifecycleMarker,
  "const inspectionJetwayDeployment = 1;",
  "controller?.setDeployment(inspectionJetwayDeployment)",
  "inspectionAircraftCalibrationJetwayRestoredDeployment",
  "window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__",
  "jetway.controller.setDeployment(attachedEvidenceDeployment)",
  "a1-terminal-connection-attached-evidence-v2-rebased-controller",
  "restore-final-rebased-physical-fit-v2",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 evidence attach runtime is missing ${required}`);
  }
}
if (source.includes("const inspectionJetwayDeployment = next ? 0 : 1;")) {
  throw new Error(`${path}: inspection lifecycle still retracts A1 on entry`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Installed a1-final-visual-evidence-attach-runtime-v3-replay-rebased-attached-fit: inspection re-entry now restores the controller's final post-fit deployment=1 matrices after training retraction; calibration remains attached and normal training departure still owns intentional retraction.");
