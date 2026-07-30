import fs from "node:fs";

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";

function replaceRequired(before, after, marker, label) {
  let source = fs.readFileSync(runtimePath, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${runtimePath}: missing ${label} anchor`);
  source = source.replace(before, after);
  fs.writeFileSync(runtimePath, source, "utf8");
}

replaceRequired(
  `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
  });`,
  `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
    transitionStartDeployment: 1,
    transitionStartedAt: 0,
    transitionDurationMs: 4200,
  });`,
  "transitionDurationMs: 4200",
  "clocked jetway state",
);

replaceRequired(
  `    jetwayRef.current.target = resetJetwayDeployment;
    jetwayRef.current.deployment = resetJetwayDeployment;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(resetJetwayDeployment);`,
  `    jetwayRef.current.target = resetJetwayDeployment;
    jetwayRef.current.deployment = resetJetwayDeployment;
    jetwayRef.current.transitionStartDeployment = resetJetwayDeployment;
    jetwayRef.current.transitionStartedAt = 0;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(resetJetwayDeployment);`,
  "transitionStartDeployment = resetJetwayDeployment",
  "reset transition state",
);

replaceRequired(
  `      jetwayRef.current.target = inspectionJetwayDeployment;
      jetwayRef.current.deployment = inspectionJetwayDeployment;
      jetwayRef.current.retractionRequested = false;
      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`,
  `      jetwayRef.current.target = inspectionJetwayDeployment;
      jetwayRef.current.deployment = inspectionJetwayDeployment;
      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;
      jetwayRef.current.transitionStartedAt = 0;
      jetwayRef.current.retractionRequested = false;
      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`,
  "transitionStartDeployment = inspectionJetwayDeployment",
  "inspection transition state",
);

replaceRequired(
  `      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
  `      jetwayRef.current.transitionStartDeployment = jetwayRef.current.deployment;
      jetwayRef.current.transitionStartedAt = performance.now();
      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
  "transitionStartedAt = performance.now()",
  "departure transition clock",
);

replaceRequired(
  `      const jetway = jetwayRef.current;
      if (jetway.controller) {
        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          const step = Math.min(Math.abs(difference), dt * 0.34);
          jetway.deployment += Math.sign(difference) * step;
          jetway.controller.setDeployment(jetway.deployment);
        }
        renderer.domElement.dataset.a1JetwayDeployment = jetway.deployment.toFixed(3);`,
  `      const jetway = jetwayRef.current;
      if (jetway.controller) {
        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          if (!(jetway.transitionStartedAt > 0)) {
            jetway.transitionStartDeployment = jetway.deployment;
            jetway.transitionStartedAt = now;
          }
          const transitionElapsedMs = Math.max(0, now - jetway.transitionStartedAt);
          const transitionDistance = Math.max(0.001, Math.abs(jetway.target - jetway.transitionStartDeployment));
          const transitionDurationMs = Math.max(900, jetway.transitionDurationMs * transitionDistance);
          const transitionProgress = Math.min(1, transitionElapsedMs / transitionDurationMs);
          const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
          jetway.deployment = jetway.transitionStartDeployment
            + (jetway.target - jetway.transitionStartDeployment) * easedProgress;
          if (transitionProgress >= 1) {
            jetway.deployment = jetway.target;
            jetway.transitionStartDeployment = jetway.target;
            jetway.transitionStartedAt = 0;
          }
          jetway.controller.setDeployment(jetway.deployment);
        }
        renderer.domElement.dataset.a1JetwayDeployment = jetway.deployment.toFixed(3);`,
  "const transitionElapsedMs = Math.max(0, now - jetway.transitionStartedAt)",
  "frame-rate-independent transition",
);

replaceRequired(
  `        renderer.domElement.dataset.a1JetwayState = jetway.controller.getState?.() || "unknown";`,
  `        const currentA1JetwayState = jetway.controller.getState?.() || "unknown";
        renderer.domElement.dataset.a1JetwayState = currentA1JetwayState;
        renderer.domElement.dataset.a1JetwayStateHistory = jetway.controller.getStateHistory?.().join(",") || currentA1JetwayState;`,
  "dataset.a1JetwayStateHistory",
  "persistent sequence dataset",
);

const prepared = fs.readFileSync(runtimePath, "utf8");
for (const token of [
  "transitionDurationMs: 4200",
  "transitionStartedAt = performance.now()",
  "const transitionElapsedMs = Math.max(0, now - jetway.transitionStartedAt)",
  "jetway.deployment = jetway.target",
  "dataset.a1JetwayStateHistory",
]) {
  if (!prepared.includes(token)) throw new Error(`${runtimePath}: clocked A1 motion is missing ${token}`);
}
if (prepared.includes("const step = Math.min(Math.abs(difference), dt * 0.34)")) {
  throw new Error(`${runtimePath}: obsolete frame-capped A1 movement remains`);
}

console.log("Prepared clock-based A1 jetway motion with persistent attached, hood-clear, telescoping, rotating and parked sequence evidence.");
