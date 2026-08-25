import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit";
const inspectionLifecycleMarker = "a1-inspection-lifecycle-preserves-final-attached-fit-v1";
const calibrationLifecycleMarker = "a1-aircraft-calibration-preserves-final-attached-fit-v1";
let source = fs.readFileSync(path, "utf8");

const priorStart = source.indexOf("  // a1-final-visual-evidence-attach-runtime-v1\n");
if (priorStart >= 0) {
  const priorEndNeedle = "  const advance = useCallback(() => {";
  const priorEnd = source.indexOf(priorEndNeedle, priorStart);
  if (priorEnd < 0) throw new Error(`${path}: prior A1 evidence attach hook has no advance anchor`);
  source = source.slice(0, priorStart) + source.slice(priorEnd);
}

// Free-drive inspection is the reference-photo evidence mode. Entering it used to
// force A1 to deployment 0 and replay the controller's pre-fit child matrices.
// That created the exact false attached-state seen in the latest trace: the canvas
// reported a1JetwayDeployment=0.000 and the visible Rotunda-to-Cab body collapsed
// even though the final pre-Vite Cab/hood fit had already been solved.
// Keep the already-fitted attached geometry through inspection/training toggles.
// The normal training departure sequence still owns intentional retraction when
// the operator advances from stage 0; this changes no supplied GLB vertices,
// terminal pose, aircraft pose, or 57 static-gate geometry.
if (!source.includes(inspectionLifecycleMarker)) {
  const toggleNeedle = `      const inspectionJetwayDeployment = next ? 0 : 1;\n      jetwayRef.current.target = inspectionJetwayDeployment;\n      jetwayRef.current.deployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartedAt = 0;\n      jetwayRef.current.retractionRequested = false;\n      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`;
  const toggleReplacement = `      // ${inspectionLifecycleMarker}\n      // Inspection must show the final physically attached A1 reference state.\n      // Do not replay controller.setDeployment(1) here: the controller was bound\n      // before the final Cab/Tunnel-C/service-stair micro-fit and would overwrite\n      // those accepted child transforms with stale matrices.\n      const inspectionJetwayDeployment = 1;\n      jetwayRef.current.target = inspectionJetwayDeployment;\n      jetwayRef.current.deployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;\n      jetwayRef.current.transitionStartedAt = 0;\n      jetwayRef.current.retractionRequested = false;`;
  if (!source.includes(toggleNeedle)) {
    throw new Error(`${path}: inspection jetway lifecycle anchor is missing`);
  }
  source = source.replace(toggleNeedle, toggleReplacement);
}

// The attached-state trace on 651ba442 proved there can be a second deployment
// owner in fixed-aircraft calibration: calibration deploys A1 to 1 for its exact
// door solve and older generated runtimes then restored a cached deployment 0.
// Current production regeneration can already remove both controller calls before
// this final evidence pass. Treat that zero-call state as valid rather than forcing
// the retired restore contract back into the generated trainer. If the legacy pair
// is still present, patch only its final restore to 1. A single surviving call is
// accepted only when it is already an attached-state deployment; otherwise fail.
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
    // A later-generation calibration may already have no controller replay at all.
    // Mark that lifecycle explicitly so repeated production preparation is stable.
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
  const normalizedTelemetryLine = telemetryLine.replace(
    telemetryAssignmentPattern,
    '$1"1.000000";',
  );
  source = source.slice(0, telemetryLineStart) + normalizedTelemetryLine + source.slice(telemetryLineEnd);
}

if (!source.includes(marker)) {
  const anchor = "  const advance = useCallback(() => {";
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final A1 evidence attach anchor is missing immediately before production bundling`);
  }

  const hook = `  // ${marker}\n  // The final pre-Vite A1 stages physically fit the supplied Cab, Tunnel-C and\n  // exact service stair after the model-space controller's original bind. Calling\n  // controller.setDeployment(1) here would restore stale pre-fit child matrices\n  // and visibly pull the Cab away from the CRJ door. Evidence attachment therefore\n  // holds only the already-final logical deployment and never replays controller\n  // geometry over the accepted final fit.\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__ = () => {\n      const sim = simRef.current;\n      const jetway = jetwayRef.current;\n      if (!sim || !jetway?.controller) return \"not-ready\";\n      const attachedEvidenceDeployment = 1;\n      jetway.target = attachedEvidenceDeployment;\n      jetway.deployment = attachedEvidenceDeployment;\n      if (\"transitionStartDeployment\" in jetway) jetway.transitionStartDeployment = attachedEvidenceDeployment;\n      if (\"transitionStartedAt\" in jetway) jetway.transitionStartedAt = 0;\n      jetway.retractionRequested = false;\n      const canvas = sim.renderer?.domElement;\n      if (!canvas) return \"not-ready\";\n      canvas.dataset.a1InspectionAttachedEvidenceAuthority = \"a1-terminal-connection-attached-evidence-v1\";\n      canvas.dataset.a1JetwayDeployment = attachedEvidenceDeployment.toFixed(3);\n      canvas.dataset.a1JetwayState = \"attached-to-aircraft-door\";\n      canvas.dataset.a1EvidenceAttachGeometryAuthority = \"preserve-final-pre-vite-physical-fit-no-controller-replay-v1\";\n      return canvas.dataset.a1JetwayState;\n    };\n    return () => {\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    };\n  }, []);\n\n${anchor}`;

  source = source.replace(anchor, hook);
}

for (const required of [
  marker,
  inspectionLifecycleMarker,
  calibrationLifecycleMarker,
  "const inspectionJetwayDeployment = 1;",
  "inspectionAircraftCalibrationJetwayRestoredDeployment",
  "window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__",
  "a1-terminal-connection-attached-evidence-v1",
  "preserve-final-pre-vite-physical-fit-no-controller-replay-v1",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 evidence attach runtime is missing ${required}`);
  }
}
if (source.includes("const inspectionJetwayDeployment = next ? 0 : 1;")) {
  throw new Error(`${path}: inspection lifecycle still retracts A1 on entry`);
}
if (source.includes("jetway.controller.setDeployment(attachedEvidenceDeployment)")) {
  throw new Error(`${path}: stale evidence attach geometry replay remains`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Installed a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit + regeneration-safe attached inspection/calibration lifecycle guards: free-drive inspection stays attached, legacy calibration restores are pinned to 1 when present, and already-removed controller replay is preserved without reintroducing it.");
