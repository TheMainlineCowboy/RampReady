import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit";
let source = fs.readFileSync(path, "utf8");

const priorStart = source.indexOf("  // a1-final-visual-evidence-attach-runtime-v1\n");
if (priorStart >= 0) {
  const priorEndNeedle = "  const advance = useCallback(() => {";
  const priorEnd = source.indexOf(priorEndNeedle, priorStart);
  if (priorEnd < 0) throw new Error(`${path}: prior A1 evidence attach hook has no advance anchor`);
  source = source.slice(0, priorStart) + source.slice(priorEnd);
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
  "window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__",
  "a1-terminal-connection-attached-evidence-v1",
  "preserve-final-pre-vite-physical-fit-no-controller-replay-v1",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 evidence attach runtime is missing ${required}`);
  }
}
if (source.includes("jetway.controller.setDeployment(attachedEvidenceDeployment)")) {
  throw new Error(`${path}: stale evidence attach geometry replay remains`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Installed a1-final-visual-evidence-attach-runtime-v2-preserve-final-fit: evidence mode holds the already-fitted A1 attached state without replaying stale model-space controller child matrices over the final Cab/Tunnel-C/service-stair geometry.");
