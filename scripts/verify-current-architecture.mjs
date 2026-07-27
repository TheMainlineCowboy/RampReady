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
  "src/components/aircraft/aircraftRuntimeLoader.js",
  "src/components/aircraft/aircraftAssetContract.js",
  "public/models/crj700/crj700-mobile.glb",
  "scripts/prepare-crj700-model.mjs",
  "scripts/verify-crj700-runtime.mjs",
  "scripts/verify-aircraft-runtime-loader.mjs",
  "scripts/verify-physics.mjs",
  "scripts/verify-partial-throttle.mjs",
  "scripts/verify-tow-kinematics.mjs",
  "scripts/verify-runtime-kinematics-parity.mjs",
]) requireFile(path);

if (existsSync("package.json")) {
  const scripts = JSON.parse(read("package.json")).scripts ?? {};
  requireMarker(scripts.verify ?? "", "prepare:aircraft", "Verify script must prepare the aircraft asset");
  requireMarker(scripts.verify ?? "", "verify-crj700-runtime.mjs", "Verify script must validate the rendered aircraft integration");
  requireMarker(scripts.verify ?? "", "verify-aircraft-runtime-loader.mjs", "Verify script must validate candidate-aware aircraft loading");
  requireMarker(scripts.verify ?? "", "verify-physics.mjs", "Verify script must run physics checks");
  requireMarker(scripts.verify ?? "", "verify-partial-throttle.mjs", "Verify script must run partial-throttle checks");
  requireMarker(scripts.verify ?? "", "verify-tow-kinematics.mjs", "Verify script must run tow checks");
  requireMarker(scripts.verify ?? "", "verify-runtime-kinematics-parity.mjs", "Verify script must compare runtime towing behavior");
}

if (existsSync("src/components/aircraft/crj700Model.js")) {
  const aircraft = read("src/components/aircraft/crj700Model.js");
  for (const marker of [
    'import { loadSelectedAircraftRuntime } from "./aircraftRuntimeLoader.js"',
    'import("three/addons/loaders/GLTFLoader.js")',
    "loadSelectedAircraftRuntime({",
    'aircraftAssetState = "loading"',
    'aircraftAssetState = "ready"',
    'aircraftAssetState = "error"',
    'renderedAircraftSource = "procedural-fallback"',
    "result.candidate.id",
    "result.preserveMaterials",
    'role === "operational-light"',
    'role === "training-capture-marker"',
    'role === "supplemental-landing-gear"',
    "aircraftRoot.userData.noseGearCaptureOrigin = [...result.captureOrigin]",
    "aircraftRoot.userData.authoredMaterialsPreserved = result.preserveMaterials",
  ]) requireMarker(aircraft, marker, "CRJ700 integration missing marker");
  if (aircraft.includes('new URL("models/crj700-mobile.glb", document.baseURI)')) failures.push("CRJ700 integration still hardcodes the fallback GLB");
  if (aircraft.includes("applyVisibleBaseLivery(THREE, realModel);")) failures.push("CRJ700 integration still repaints every selected model");
}

if (existsSync("src/components/aircraft/aircraftAssetContract.js")) {
  const contract = read("src/components/aircraft/aircraftAssetContract.js");
  for (const marker of [
    'id: "user-painted-crj700"',
    'url: "models/crj700-user.glb"',
    'metadataUrl: "models/crj700-user.asset.json"',
    "preserveMaterials: true",
    'id: "prepared-crj700-fallback"',
  ]) requireMarker(contract, marker, "Aircraft candidate contract missing marker");
}

if (existsSync("scripts/verify-physics.mjs")) {
  const physics = read("scripts/verify-physics.mjs");
  for (const marker of [
    "Partial free-drive throttle too weak",
    "Connected FWD pushback did not travel forward far enough",
    "Connected REV interlock leaked motion",
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

console.log("RampReady current architecture verification passed: candidate-aware authored-aircraft selection, isolated fallback livery, current physics, throttle, and towing gates are present.");
