import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit";
const inspectionLifecycleMarker = "a1-inspection-lifecycle-preserves-final-attached-fit-v1";
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
// to ~9.56 m even though the final pre-Vite Cab/hood fit had already been solved.
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
  "const inspectionJetwayDeployment = 1;",
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
console.log("Installed a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit + a1-inspection-lifecycle-preserves-final-attached-fit-v1: free-drive inspection now keeps the final physically attached A1 geometry instead of retracting/replaying stale controller matrices; normal training departure still owns intentional retraction.");
