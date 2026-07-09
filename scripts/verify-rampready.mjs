import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/components/PushbackTrainer.jsx",
  "src/components/RampReadyTrainer.jsx",
  "src/components/RampReadyTrainer.css",
  "src/components/aircraft/crj700Model.js",
  "scripts/verify-physics.mjs",
  "netlify.toml",
];

const hardFailures = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) hardFailures.push(`Missing required file: ${file}`);
}

const read = (file) => readFileSync(file, "utf8");
const requireHard = (condition, message) => { if (!condition) hardFailures.push(message); };
const warnIfMissing = (content, marker, label) => { if (!content.includes(marker)) warnings.push(`${label}: ${marker}`); };

if (existsSync("src/components/PushbackTrainer.jsx")) {
  const bridge = read("src/components/PushbackTrainer.jsx");
  requireHard(bridge.includes("RampReadyTrainer.jsx"), "PushbackTrainer.jsx must route the legacy import to RampReadyTrainer.jsx");
}

if (existsSync("src/components/RampReadyTrainer.jsx")) {
  const trainer = read("src/components/RampReadyTrainer.jsx");

  // Hard blockers: these are deploy-breaking or known bad sim regressions.
  requireHard(trainer.includes("buildCRJ700Aircraft"), "Trainer must load the CRJ700 aircraft model");
  requireHard(trainer.includes("buildTug"), "Trainer must build the active tug model");
  requireHard(trainer.includes("CRADLE_OFFSET_Z = 5.6"), "Trainer must use the corrected short cradle offset");
  requireHard(!trainer.includes("CRADLE_OFFSET_Z = 11.5"), "Cradle geometry regressed to the oversized stretched bucket");
  requireHard(!trainer.includes("CRADLE_OFFSET_Z - 2.7"), "Cradle arms must not stretch from the cradle offset");
  requireHard(trainer.includes("const usefulThrottle = throttleNorm > 0.02 ? 0.18 + throttleNorm * 0.82 : 0"), "Trainer must preserve minimum usable throttle behavior");
  requireHard(trainer.includes("const targetSpeed = usefulThrottle * signedDirection * maxSpeed"), "Trainer must map throttle to target speed");
  requireHard(trainer.includes("Connect nose gear"), "Trainer must keep explicit nose-gear connect workflow");
  requireHard(!trainer.includes("}, [cameraMode, message])"), "Renderer lifecycle must not depend on live HUD message state");
  requireHard(!trainer.includes("}, [cameraMode") || trainer.includes("cameraModeRef.current"), "Camera changes should not recreate the renderer");
  requireHard(!trainer.includes("buildTerminal") && !trainer.includes("jetBridge"), "Clean trainer scene should not include terminal or jet bridge clutter yet");

  // Soft checks: useful for dev visibility, but they should not break Netlify deploys.
  const softMarkers = [
    "useMemo",
    "rr-checklist",
    "Pushback procedure checklist",
    "messageRef.current",
    "setTrainerMessage",
    "cameraModeRef.current",
    "currentCameraMode === \"overhead\"",
    "Hide diagnostics",
    "rr-diagnostics",
    "idleThrottle",
    "Power idle. Use brake if you need a faster stop.",
    "rr-idle",
    "Capture distance",
    "debug:",
    "cradleZ",
    "noseZ",
    "releaseNoseGear",
    "Nose gear released. Tug clear. Scenario complete.",
    "stageRef.current = 6",
    "rr-view-select",
  ];
  for (const marker of softMarkers) warnIfMissing(trainer, marker, "Trainer marker missing");
}

if (existsSync("scripts/verify-physics.mjs")) {
  const physics = read("scripts/verify-physics.mjs");
  const physicsMarkers = [
    "Partial free-drive throttle too weak",
    "Connected REV should produce positive pushback speed",
    "Cradle offset too long",
    "Initial tug-body-to-nose spacing",
  ];
  for (const marker of physicsMarkers) requireHard(physics.includes(marker), `Physics verification missing expected marker: ${marker}`);
}

if (existsSync("src/components/aircraft/crj700Model.js")) {
  const aircraft = read("src/components/aircraft/crj700Model.js");
  const aircraftMarkers = ["buildCRJ700Aircraft", "T-tail", "rear-mounted engines", "Window row dots", "Nose gear at origin"];
  for (const marker of aircraftMarkers) requireHard(aircraft.includes(marker), `CRJ model missing expected marker: ${marker}`);
}

if (existsSync("src/components/RampReadyTrainer.css")) {
  const css = read("src/components/RampReadyTrainer.css");
  const hardCssMarkers = [".rr-throttle", ".rr-direction", ".rr-steer", ".rr-view-select"];
  for (const marker of hardCssMarkers) requireHard(css.includes(marker), `CSS missing required marker: ${marker}`);

  const softCssMarkers = ["@import \"./throttle-visibility.css\"", "@import \"./throttle-force.css\"", ".rr-idle", ".rr-diagnostics", ".rr-checklist", ".rr-checkitem.active", ".rr-checknum"];
  for (const marker of softCssMarkers) warnIfMissing(css, marker, "CSS marker missing");
}

for (const optionalCss of ["src/components/throttle-visibility.css", "src/components/throttle-force.css"]) {
  if (existsSync(optionalCss)) {
    const css = read(optionalCss);
    if (optionalCss.includes("throttle-visibility")) {
      for (const marker of [".rr-custom-slider", ".rr-custom-fill", ".rr-custom-thumb"]) requireHard(css.includes(marker), `Throttle CSS missing expected marker: ${marker}`);
    }
  }
}

if (existsSync("netlify.toml")) {
  const netlify = read("netlify.toml");
  requireHard(netlify.includes("npm run build") && netlify.includes("dist"), "Netlify config must build with npm run build and publish dist");
}

for (const warning of warnings) console.warn(`RampReady verification warning: ${warning}`);

if (hardFailures.length) {
  console.error("RampReady verification failed:");
  for (const failure of hardFailures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RampReady verification passed.");
