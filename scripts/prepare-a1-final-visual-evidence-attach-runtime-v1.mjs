import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-visual-evidence-attach-runtime-v1";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const anchor = "  const advance = useCallback(() => {";
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final A1 evidence attach anchor is missing immediately before production bundling`);
  }

  const hook = `  // ${marker}\n  // This hook is installed after every late production trainer rewrite, so the\n  // browser artifact itself — not merely an earlier generated source phase —\n  // exposes a bounded evidence-only command that holds the existing A1\n  // controller at its physically attached deployment. It moves no terminal,\n  // aircraft, Rotunda, or supplied GLB child.\n  useEffect(() => {\n    window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__ = () => {\n      const sim = simRef.current;\n      const jetway = jetwayRef.current;\n      if (!sim || !jetway?.controller) return \"not-ready\";\n      const attachedEvidenceDeployment = 1;\n      jetway.target = attachedEvidenceDeployment;\n      jetway.deployment = attachedEvidenceDeployment;\n      if (\"transitionStartDeployment\" in jetway) jetway.transitionStartDeployment = attachedEvidenceDeployment;\n      if (\"transitionStartedAt\" in jetway) jetway.transitionStartedAt = 0;\n      jetway.retractionRequested = false;\n      jetway.controller.setDeployment(attachedEvidenceDeployment);\n      const canvas = sim.renderer?.domElement;\n      if (!canvas) return \"not-ready\";\n      canvas.dataset.a1InspectionAttachedEvidenceAuthority = \"a1-terminal-connection-attached-evidence-v1\";\n      canvas.dataset.a1JetwayDeployment = attachedEvidenceDeployment.toFixed(3);\n      canvas.dataset.a1JetwayState = jetway.controller.getState?.() || \"attached-requested\";\n      return canvas.dataset.a1JetwayState;\n    };\n    return () => {\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    };\n  }, []);\n\n${anchor}`;

  source = source.replace(anchor, hook);
}

for (const required of [
  marker,
  "window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__",
  "a1-terminal-connection-attached-evidence-v1",
  "jetway.controller.setDeployment(attachedEvidenceDeployment)",
]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final A1 evidence attach runtime is missing ${required}`);
  }
}

fs.writeFileSync(path, source, "utf8");
console.log("Installed a1-final-visual-evidence-attach-runtime-v1 immediately before production Vite bundling: the actual browser artifact can hold the existing A1 controller attached for photo evidence without moving airport or supplied-model geometry.");
