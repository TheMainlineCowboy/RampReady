import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "index.html",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/components/PushbackTrainer.jsx",
  "src/components/RampReadyTrainer.jsx",
  "src/components/RampReadyTrainer.css",
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
    "buildLektro",
    "buildAircraft",
    "buildGround",
    "FWD",
    "REV",
    "type=\"range\"",
    "deviceorientation",
    "Request clearance",
    "Confirm brake released",
    "rr-view-select",
    "rr-slider-wrap",
  ];

  for (const snippet of requiredSnippets) {
    if (!trainer.includes(snippet)) failures.push(`Trainer missing expected feature marker: ${snippet}`);
  }

  if (trainer.includes("buildTerminal") || trainer.includes("jetBridge")) {
    failures.push("Clean trainer scene should not include terminal or jet bridge clutter yet");
  }
}

if (existsSync("src/components/RampReadyTrainer.css")) {
  const css = read("src/components/RampReadyTrainer.css");
  const cssMarkers = [".rr-throttle", ".rr-direction", ".rr-steer", ".rr-view-select", ".rr-slider-wrap", "transform: rotate(-90deg)"];
  for (const marker of cssMarkers) {
    if (!css.includes(marker)) failures.push(`CSS missing expected marker: ${marker}`);
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
