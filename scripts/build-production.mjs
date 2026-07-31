import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const terminal4TrainerPath = new URL("../src/components/RampReadyStandupTrainerTerminal4.jsx", import.meta.url);
const sourcePlacedJetwayPath = new URL("../src/environment/sourcePlacedTerminal4Jetways.js", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);
const originalSource = await readFile(trainerPath, "utf8");
const generatedMobileImport = 'import "./mobile-hud-v9.css";';
const preparedTerminal4Source = await readFile(terminal4TrainerPath, "utf8");
const preparedSourcePlacedJetwaySource = await readFile(sourcePlacedJetwayPath, "utf8");

function restoreClockedA1Motion(source) {
  const replacements = [
    [
      `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
    transitionStartDeployment: 1,
    transitionStartedAt: 0,
    transitionDurationMs: 4200,
  });`,
      `  const jetwayRef = useRef({
    controller: null,
    deployment: 1,
    target: 1,
    retractionRequested: false,
  });`,
    ],
    [
      `    jetwayRef.current.target = resetJetwayDeployment;
    jetwayRef.current.deployment = resetJetwayDeployment;
    jetwayRef.current.transitionStartDeployment = resetJetwayDeployment;
    jetwayRef.current.transitionStartedAt = 0;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(resetJetwayDeployment);`,
      `    jetwayRef.current.target = resetJetwayDeployment;
    jetwayRef.current.deployment = resetJetwayDeployment;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(resetJetwayDeployment);`,
    ],
    [
      `      jetwayRef.current.target = inspectionJetwayDeployment;
      jetwayRef.current.deployment = inspectionJetwayDeployment;
      jetwayRef.current.transitionStartDeployment = inspectionJetwayDeployment;
      jetwayRef.current.transitionStartedAt = 0;
      jetwayRef.current.retractionRequested = false;
      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`,
      `      jetwayRef.current.target = inspectionJetwayDeployment;
      jetwayRef.current.deployment = inspectionJetwayDeployment;
      jetwayRef.current.retractionRequested = false;
      jetwayRef.current.controller?.setDeployment(inspectionJetwayDeployment);`,
    ],
    [
      `      jetwayRef.current.transitionStartDeployment = jetwayRef.current.deployment;
      jetwayRef.current.transitionStartedAt = performance.now();
      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
      `      jetwayRef.current.target = 0;
      jetwayRef.current.retractionRequested = true;`,
    ],
    [
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
      `      const jetway = jetwayRef.current;
      if (jetway.controller) {
        const difference = jetway.target - jetway.deployment;
        if (Math.abs(difference) > 0.0005) {
          const step = Math.min(Math.abs(difference), dt * 0.34);
          jetway.deployment += Math.sign(difference) * step;
          jetway.controller.setDeployment(jetway.deployment);
        }
        renderer.domElement.dataset.a1JetwayDeployment = jetway.deployment.toFixed(3);`,
    ],
    [
      `        const currentA1JetwayState = jetway.controller.getState?.() || "unknown";
        renderer.domElement.dataset.a1JetwayState = currentA1JetwayState;
        renderer.domElement.dataset.a1JetwayStateHistory = jetway.controller.getStateHistory?.().join(",") || currentA1JetwayState;`,
      `        renderer.domElement.dataset.a1JetwayState = jetway.controller.getState?.() || "unknown";`,
    ],
  ];
  let restored = source;
  for (const [prepared, baseline] of replacements) {
    if (restored.includes(prepared)) restored = restored.replace(prepared, baseline);
    else if (!restored.includes(baseline)) throw new Error("RampReady production build could not identify the A1 clocked-motion restoration contract.");
  }
  return restored;
}

function restoreInspectionElapsedMotion(source) {
  const replacements = [
    [
      `      const rawFrameDt = Math.max(0.001, (now - sim.last) / 1000);
      const dt = Math.min(0.04, rawFrameDt);
      sim.last = now;`,
      `      const dt = Math.min(0.04, Math.max(0.001, (now - sim.last) / 1000));
      sim.last = now;`,
    ],
    [
      `      const dynamicsCommand = {
        connected: towing,
        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,
        direction: inspectionDirection,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" ") || !motionAllowed,
        cradleOffset: rig.profile.cradleOffset,
        steeringMode: rig.profile.steeringMode,
        wheelbase: rig.profile.wheelbase,
      };
      if (inspectionActive) {
        let remainingInspectionDt = Math.min(0.5, rawFrameDt);
        while (remainingInspectionDt > 0.000001) {
          const inspectionStepDt = Math.min(0.04, remainingInspectionDt);
          sim.dynamics = stepPushbackDynamics(sim.dynamics, dynamicsCommand, inspectionStepDt);
          remainingInspectionDt -= inspectionStepDt;
        }
      } else {
        sim.dynamics = stepPushbackDynamics(sim.dynamics, dynamicsCommand, dt);
      }`,
      `      sim.dynamics = stepPushbackDynamics(sim.dynamics, {
        connected: towing,
        throttle: motionAllowed && (!towing || inspectionDirection === 1) ? inspectionThrottle : 0,
        direction: inspectionDirection,
        steer: clamp(steer, -1, 1),
        brake: drive.brake || keysRef.current.has(" ") || !motionAllowed,
        cradleOffset: rig.profile.cradleOffset,
        steeringMode: rig.profile.steeringMode,
        wheelbase: rig.profile.wheelbase,
      }, dt);`,
    ],
    [
      `      rig.setSteering(state.steerAngle || 0);
      const visualMotionDt = inspectionActive ? Math.min(0.5, rawFrameDt) : dt;
      rig.rotateWheels(state.speed * visualMotionDt);`,
      `      rig.setSteering(state.steerAngle || 0);
      rig.rotateWheels(state.speed * dt);`,
    ],
    [
      `      canvas.dataset.inspectionSpeed = Math.abs(state.speed).toFixed(3);
      canvas.dataset.inspectionTimeIntegration = inspectionActive ? "elapsed-substep-40ms" : "training-frame-capped";`,
      `      canvas.dataset.inspectionSpeed = Math.abs(state.speed).toFixed(3);`,
    ],
  ];
  let restored = source;
  for (const [prepared, baseline] of replacements) {
    if (restored.includes(prepared)) restored = restored.replace(prepared, baseline);
    else if (!restored.includes(baseline)) throw new Error("RampReady production build could not identify the elapsed inspection-motion restoration contract.");
  }
  return restored;
}

function restoreA1TerminalConnectorV11(source) {
  const replacements = [
    [
      "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 48);",
      "  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);",
    ],
    [
      "      if (!(longitudinal > 0.05 && longitudinal <= 48)) continue;",
      "      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;",
    ],
    [
      "      if (lateral <= 5.5) nearest = Math.min(nearest, longitudinal);",
      "      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);",
    ],
    [
      "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);",
      "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);",
    ],
    [
      "  group.userData.terminalConnectionAuthority = \"48m-raycast-and-source-vertex-fit-to-authored-terminal-mesh-v11\";",
      "  group.userData.terminalConnectionAuthority = \"raycast-and-source-vertex-fit-to-authored-terminal-mesh\";",
    ],
  ];
  let restored = source;
  for (const [prepared, baseline] of replacements) {
    if (restored.includes(prepared)) restored = restored.replace(prepared, baseline);
    else if (!restored.includes(baseline)) throw new Error("RampReady production build could not identify the A1 Terminal 4 connector v11 restoration contract.");
  }
  return restored;
}

const originalTerminal4Source = restoreInspectionElapsedMotion(restoreClockedA1Motion(preparedTerminal4Source))
  .replace(`${generatedMobileImport}\n`, "")
  .replace(`\n${generatedMobileImport}`, "");
const originalSourcePlacedJetwaySource = restoreA1TerminalConnectorV11(preparedSourcePlacedJetwaySource);
const originalPackage = await readFile(packagePath, "utf8");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

let buildError;
try {
  await run(process.execPath, ["scripts/prepare-crj700-model.mjs"]);
  await run(process.execPath, ["scripts/report-source-architecture.mjs"]);
  await run(npmCommand, ["run", "prepare:runtime"]);
  await run(process.execPath, ["scripts/verify-runtime-transform-scope.mjs"]);
  await run(process.execPath, ["scripts/verify-runtime-idempotence.mjs"]);
  await run(process.execPath, ["scripts/verify-current-architecture.mjs"]);
  await run(process.execPath, ["scripts/verify-prepared-runtime.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-scan-conversion-contract.mjs"]);
  await run(process.execPath, ["scripts/verify-terminal4-source-inventory.mjs"]);
  await run(process.execPath, ["scripts/verify-terminal4-gate-manifest.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-clearance.mjs"]);
  await run(process.execPath, ["scripts/verify-lektro-proportions.mjs"]);
  await run(process.execPath, ["scripts/verify-nose-gear-seating.mjs"]);
  await run(process.execPath, ["scripts/verify-capture-settling.mjs"]);
  await run(process.execPath, ["scripts/verify-training-route.mjs"]);
  await run(process.execPath, ["scripts/verify-physics.mjs"]);
  await run(process.execPath, ["scripts/verify-partial-throttle.mjs"]);
  await run(process.execPath, ["scripts/verify-tow-kinematics.mjs"]);
  await run(process.execPath, ["scripts/verify-tow-kinematics-module.mjs"]);
  await run(process.execPath, ["scripts/verify-runtime-kinematics-parity.mjs"]);
  await run(npmCommand, ["exec", "--", "vite", "build"]);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  await writeFile(trainerPath, originalSource, "utf8");
  await writeFile(terminal4TrainerPath, originalTerminal4Source, "utf8");
  await writeFile(sourcePlacedJetwayPath, originalSourcePlacedJetwaySource, "utf8");
  const restoredSource = await readFile(trainerPath, "utf8");
  const restoredTerminal4Source = await readFile(terminal4TrainerPath, "utf8");
  const restoredSourcePlacedJetwaySource = await readFile(sourcePlacedJetwayPath, "utf8");
  const currentPackage = await readFile(packagePath, "utf8");
  if (restoredSource !== originalSource) {
    throw new Error("RampReady production build failed to restore the tracked trainer source exactly.");
  }
  if (
    restoredTerminal4Source !== originalTerminal4Source
    || restoredTerminal4Source.includes(generatedMobileImport)
    || restoredTerminal4Source.includes("transitionDurationMs: 4200")
    || restoredTerminal4Source.includes("dataset.a1JetwayStateHistory")
    || restoredTerminal4Source.includes("remainingInspectionDt")
    || restoredTerminal4Source.includes("inspectionTimeIntegration")
  ) {
    throw new Error("RampReady production build failed to restore the committed Terminal 4 trainer baseline exactly.");
  }
  if (
    restoredSourcePlacedJetwaySource !== originalSourcePlacedJetwaySource
    || restoredSourcePlacedJetwaySource.includes("new THREE.Raycaster(origin, direction, 0.05, 48)")
    || restoredSourcePlacedJetwaySource.includes("1.25, 44")
    || restoredSourcePlacedJetwaySource.includes("Terminal 4 connector v11")
  ) {
    throw new Error("RampReady production build failed to restore the committed source-placed jetway baseline exactly.");
  }
  if (currentPackage !== originalPackage) {
    throw new Error("RampReady production build unexpectedly modified package.json.");
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "RampReady production build failed and source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady production build passed and restored both trainer sources and the source-placed jetway baseline exactly.");
