import { existsSync, readFileSync } from "node:fs";

const failures = [];
const requireFile = (path) => {
  if (!existsSync(path)) failures.push(`Missing required file: ${path}`);
};
const read = (path) => readFileSync(path, "utf8");
const requireMarker = (content, marker, label) => {
  if (!content.includes(marker)) failures.push(`${label}: ${marker}`);
};

for (const path of [
  "index.html",
  "vite.config.js",
  "src/main.jsx",
  "src/App.jsx",
  "src/components/PushbackTrainer.jsx",
  "src/components/RampReadyTrainerStable.jsx",
  "src/components/RampReadyTrainer.css",
  "src/components/aircraft/crj700Model.js",
  "public/models/crj700/crj700-mobile.glb",
  "scripts/prepare-crj700-model.mjs",
  "scripts/verify-crj700-runtime.mjs",
  "scripts/verify-physics.mjs",
  "scripts/verify-partial-throttle.mjs",
  "scripts/verify-tow-kinematics.mjs",
  "scripts/verify-runtime-kinematics-parity.mjs",
]) requireFile(path);

if (existsSync("package.json")) {
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  requireMarker(scripts.verify ?? "", "prepare:aircraft", "Verify script must prepare the aircraft asset");
  requireMarker(scripts.verify ?? "", "verify-crj700-runtime.mjs", "Verify script must validate the rendered aircraft integration");
  requireMarker(scripts.verify ?? "", "verify-physics.mjs", "Verify script must run physics checks");
  requireMarker(scripts.verify ?? "", "verify-partial-throttle.mjs", "Verify script must run partial-throttle checks");
  requireMarker(scripts.verify ?? "", "verify-tow-kinematics.mjs", "Verify script must run tow checks");
  requireMarker(scripts.verify ?? "", "verify-runtime-kinematics-parity.mjs", "Verify script must compare runtime towing behavior");
}

if (existsSync("src/components/aircraft/crj700Model.js")) {
  const aircraft = read("src/components/aircraft/crj700Model.js");
  for (const marker of [
    'new URL("models/crj700-mobile.glb", document.baseURI)',
    'import("three/addons/loaders/GLTFLoader.js")',
    "loader.loadAsync",
    'aircraftAssetState = "loading"',
    'aircraftAssetState = "ready"',
    'aircraftAssetState = "error"',
    'renderedAircraftSource = "CRJ700.stl"',
    'renderedAircraftSource = "procedural-fallback"',
    "new THREE.Box3().setFromObject(realModel)",
    "retainedProceduralChildren.has(child)",
    "child.visible = false",
    "noseGearCaptureOrigin = [0, 0, 0]",
    'orientation = { up: "+Y", forward: "-Z" }',
  ]) requireMarker(aircraft, marker, "CRJ700 integration missing marker");
}

if (existsSync("scripts/verify-physics.mjs")) {
  const physics = read("scripts/verify-physics.mjs");
  for (const marker of [
    "Partial free-drive throttle too weak",
    "Connected REV pushback did not travel backward far enough",
    "Connected FWD interlock leaked motion",
    "Correctly aligned capture should be ready",
    "Distant cradle must not capture",
    "Cradle offset outside integrated-pan range",
    "Initial tug-body-to-nose spacing",
    "Capture centering 30/60 Hz equivalence",
    "Aircraft yaw exceeded articulation rate",
  ]) requireMarker(physics, marker, "Physics verification missing marker");
}

if (failures.length) {
  console.error("RampReady current architecture verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("RampReady current architecture verification passed: real CRJ700 loader/fallback, current physics, throttle, and towing gates are present.");
