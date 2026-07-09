import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/components/PushbackTrainer.jsx",
  "src/components/RampReadyTrainer.jsx",
  "src/components/RampReadyTrainer.css",
  "src/components/throttle-visibility.css",
  "src/components/aircraft/crj700Model.js",
  "scripts/verify-physics.mjs",
  "netlify.toml",
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`Missing required file: ${file}`);
}

const read = (file) => readFileSync(file, "utf8");

if (existsSync("src/components/PushbackTrainer.jsx")) {
  const bridge = read("src/components/PushbackTrainer.jsx");
  if (!bridge.includes("RampReadyTrainer.jsx")) {
    failures.push("PushbackTrainer.jsx must route the legacy import to RampReadyTrainer.jsx");
  }
}

if (existsSync("src/components/RampReadyTrainer.jsx")) {
  const trainer = read("src/components/RampReadyTrainer.jsx");
  const requiredSnippets = [
    "buildCRJ700Aircraft",
    "buildTug",
    "buildGround",
    "CRADLE_OFFSET_Z = 5.6",
    "Short realistic towbarless cradle arms",
    "useMemo",
    "rr-checklist",
    "Pushback procedure checklist",
    "rr-checkitem",
    "messageRef.current",
    "setTrainerMessage",
    "cameraModeRef.current",
    "const currentCameraMode = cameraModeRef.current",
    "currentCameraMode === \"overhead\"",
    "Hide diagnostics",
    "rr-diagnostics",
    "idleThrottle",
    "Power idle. Use brake if you need a faster stop.",
    "rr-idle",
    "const usefulThrottle = throttleNorm > 0.02 ? 0.18 + throttleNorm * 0.82 : 0",
    "const targetSpeed = usefulThrottle * signedDirection * maxSpeed",
    "Connect nose gear",
    "Capture distance",
    "debug:",
    "cradleZ",
    "noseZ",
    "FWD",
    "REV",
    "rr-custom-slider",
    "Request pushback clearance",
    "Confirm aircraft parking brake released",
    "releaseNoseGear",
    "Nose gear released. Tug clear. Scenario complete.",
    "stageRef.current = 6",
    "rr-view-select",
  ];

  for (const snippet of requiredSnippets) {
    if (!trainer.includes(snippet)) failures.push(`Trainer missing expected feature marker: ${snippet}`);
  }

  if (trainer.includes("CRADLE_OFFSET_Z = 11.5") || trainer.includes("CRADLE_OFFSET_Z - 2.7")) {
    failures.push("Cradle geometry regressed to the oversized stretched bucket");
  }

  if (trainer.includes("}, [cameraMode") || trainer.includes("}, [cameraMode, message])")) {
    failures.push("Renderer lifecycle must not depend on camera mode or live HUD message state");
  }

  if (trainer.includes("style={{position:\"absolute\"") || trainer.includes("style={{ position: \"absolute\"")) {
    failures.push("Diagnostics panel should use the reusable rr-diagnostics class instead of inline absolute styles");
  }

  if (trainer.includes("buildTerminal") || trainer.includes("jetBridge")) {
    failures.push("Clean trainer scene should not include terminal or jet bridge clutter yet");
  }
}

if (existsSync("scripts/verify-physics.mjs")) {
  const physics = read("scripts/verify-physics.mjs");
  const physicsMarkers = [
    "Partial free-drive throttle too weak",
    "Connected REV should produce positive pushback speed",
    "Cradle offset too long",
    "Initial tug-body-to-nose spacing",
  ];
  for (const marker of physicsMarkers) {
    if (!physics.includes(marker)) failures.push(`Physics verification missing expected marker: ${marker}`);
  }
}

if (existsSync("src/components/aircraft/crj700Model.js")) {
  const aircraft = read("src/components/aircraft/crj700Model.js");
  const aircraftMarkers = ["buildCRJ700Aircraft", "T-tail", "rear-mounted engines", "Window row dots", "Nose gear at origin"];
  for (const marker of aircraftMarkers) {
    if (!aircraft.includes(marker)) failures.push(`CRJ model missing expected marker: ${marker}`);
  }
}

if (existsSync("src/components/RampReadyTrainer.css")) {
  const css = read("src/components/RampReadyTrainer.css");
  const cssMarkers = [
    "@import \"./throttle-visibility.css\"",
    ".rr-throttle",
    ".rr-direction",
    ".rr-idle",
    ".rr-diagnostics",
    ".rr-steer",
    ".rr-view-select",
    ".rr-checklist",
    ".rr-checkitem.active",
    ".rr-checknum",
  ];
  for (const marker of cssMarkers) {
    if (!css.includes(marker)) failures.push(`CSS missing expected marker: ${marker}`);
  }
}

if (existsSync("src/components/throttle-visibility.css")) {
  const throttleCss = read("src/components/throttle-visibility.css");
  const throttleMarkers = [".rr-custom-slider", ".rr-custom-fill", ".rr-custom-thumb"];
  for (const marker of throttleMarkers) {
    if (!throttleCss.includes(marker)) failures.push(`Throttle CSS missing expected marker: ${marker}`);
  }
}

if (existsSync("netlify.toml")) {
  const netlify = read("netlify.toml");
  if (!netlify.includes("npm run build") || !netlify.includes("dist")) {
    failures.push("Netlify config must build with npm run build and publish dist");
  }
}

if (failures.length) {
  console.error("RampReady verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RampReady verification passed.");
