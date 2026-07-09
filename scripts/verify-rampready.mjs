import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/components/PushbackTrainer.jsx",
  "src/components/RampReadyTrainerStable.jsx",
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

if (existsSync("package.json")) {
  const pkg = read("package.json");
  requireHard(pkg.includes('"build": "npm run verify && vite build"'), "Production build must run RampReady verification before Vite build");
  requireHard(pkg.includes('"verify": "node scripts/verify-rampready.mjs && node scripts/verify-physics.mjs"'), "Verify script must run structural and physics checks");
}

if (existsSync("src/components/PushbackTrainer.jsx")) {
  const bridge = read("src/components/PushbackTrainer.jsx");
  requireHard(bridge.includes("RampReadyTrainerStable.jsx"), "PushbackTrainer.jsx must route to the stable trainer implementation");
}

if (existsSync("src/components/RampReadyTrainerStable.jsx")) {
  const trainer = read("src/components/RampReadyTrainerStable.jsx");

  requireHard(trainer.includes("buildCRJ700Aircraft"), "Stable trainer must load the CRJ700 aircraft model");
  requireHard(trainer.includes("buildTug"), "Stable trainer must build the active tug model");
  requireHard(trainer.includes("CRADLE_Z = 3.45"), "Stable trainer must use the integrated short cradle position");
  requireHard(trainer.includes("Short integrated towbarless cradle"), "Stable trainer must document short integrated cradle geometry");
  requireHard(!trainer.includes("CRADLE_OFFSET_Z = 11.5"), "Cradle geometry regressed to the oversized stretched bucket");
  requireHard(!trainer.includes("CRADLE_OFFSET_Z - 2.7"), "Cradle arms must not stretch from the cradle offset");
  requireHard(trainer.includes("const usefulThrottle = throttleNorm > 0.02 ? 0.16 + throttleNorm * 0.84 : 0"), "Stable trainer must preserve minimum usable throttle behavior");
  requireHard(trainer.includes("const targetSpeed = usefulThrottle * signedDirection * maxSpeed"), "Stable trainer must map throttle to target speed");
  requireHard(trainer.includes("Connect nose gear"), "Stable trainer must keep explicit nose-gear connect workflow");
  requireHard(trainer.includes("releaseNoseGear"), "Stable trainer must keep explicit nose-gear release workflow");
  requireHard(trainer.includes("Nose gear released. Tug clear. Scenario complete."), "Release workflow must mark scenario completion");
  requireHard(trainer.includes("cameraModeRef.current"), "Camera changes should not recreate the renderer");
  requireHard(!trainer.includes("}, [cameraMode") && !trainer.includes("}, [cameraMode, message])"), "Renderer lifecycle must not depend on camera mode or live HUD message state");
  requireHard(!trainer.includes("buildTerminal") && !trainer.includes("jetBridge"), "Clean trainer scene should not include terminal or jet bridge clutter yet");
  requireHard(trainer.includes("useMemo"), "Checklist state should be memoized instead of recalculated inside the render tree");
  requireHard(trainer.includes("rr-checklist"), "Trainer must render the live procedure checklist");
  requireHard(trainer.includes("rr-checkitem"), "Trainer must render checklist item states");
  requireHard(trainer.includes("rr-idle") && trainer.includes("setIdle"), "Trainer must expose an explicit Idle control");
  requireHard(trainer.includes("rr-guidance") && trainer.includes("Controls:"), "Trainer must show a plain-language controls guide");
  requireHard(trainer.includes("showDiagnostics") && trainer.includes("Diagnostics"), "Diagnostics must be hidden behind an explicit toggle");

  const softMarkers = [
    "cradleZ",
    "noseZ",
    "rr-view-select",
  ];
  for (const marker of softMarkers) warnIfMissing(trainer, marker, "Stable trainer marker missing");
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
  const hardCssMarkers = [".rr-throttle", ".rr-direction", ".rr-steer", ".rr-view-select", ".rr-diagnostics", ".rr-checklist", ".rr-checkitem.active", ".rr-checknum", ".rr-guidance", ".rr-idle"];
  for (const marker of hardCssMarkers) requireHard(css.includes(marker), `CSS missing required marker: ${marker}`);

  const softCssMarkers = ["@import \"./throttle-visibility.css\"", ".rr-custom-slider", ".rr-custom-fill", ".rr-custom-thumb"];
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
