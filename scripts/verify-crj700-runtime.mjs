import { access, readFile, stat } from "node:fs/promises";

const modelSourceUrl = new URL("../src/components/aircraft/crj700Model.js", import.meta.url);
const loaderSourceUrl = new URL("../src/components/aircraft/aircraftRuntimeLoader.js", import.meta.url);
const contractSourceUrl = new URL("../src/components/aircraft/aircraftAssetContract.js", import.meta.url);
const fallbackAssetUrl = new URL("../public/models/crj700-mobile.glb", import.meta.url);
const fallbackManifestUrl = new URL("../public/models/crj700-mobile.manifest.json", import.meta.url);

const source = await readFile(modelSourceUrl, "utf8");
const loaderSource = await readFile(loaderSourceUrl, "utf8");
const contractSource = await readFile(contractSourceUrl, "utf8");
const requiredSourceMarkers = [
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
];

const missingMarkers = requiredSourceMarkers.filter((marker) => !source.includes(marker));
if (missingMarkers.length) {
  console.error(`CRJ700 runtime verification failed: missing candidate-aware integration markers: ${missingMarkers.join(", ")}`);
  process.exit(1);
}
if (source.includes('new URL("models/crj700-mobile.glb", document.baseURI)')) {
  console.error("CRJ700 runtime verification failed: active model still hardcodes the fallback asset URL.");
  process.exit(1);
}
for (const marker of [
  "selectAircraftAssetCandidate",
  "candidate.preserveMaterials",
  "metadata?.noseGearCaptureOrigin",
  "new THREE.Box3().setFromObject(model)",
  "dimensions.length",
  "dimensions.wingspan",
]) {
  if (!loaderSource.includes(marker)) {
    console.error(`CRJ700 runtime verification failed: loader missing ${marker}.`);
    process.exit(1);
  }
}
for (const marker of [
  'id: "user-painted-crj700"',
  'url: "models/crj700-user.glb"',
  'metadataUrl: "models/crj700-user.asset.json"',
  "preserveMaterials: true",
  'id: "prepared-crj700-fallback"',
  'url: "models/crj700-mobile.glb"',
]) {
  if (!contractSource.includes(marker)) {
    console.error(`CRJ700 runtime verification failed: candidate contract missing ${marker}.`);
    process.exit(1);
  }
}

await access(fallbackAssetUrl);
await access(fallbackManifestUrl);
const fallbackStats = await stat(fallbackAssetUrl);
if (fallbackStats.size < 10_000) {
  console.error(`CRJ700 runtime verification failed: fallback GLB is unexpectedly small (${fallbackStats.size} bytes).`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(fallbackManifestUrl, "utf8"));
const length = manifest?.dimensionsMeters?.length;
const wingspan = manifest?.dimensionsMeters?.wingspan;
if (Math.abs(length - 32.5) > 1.25 || Math.abs(wingspan - 23.64) > 1.25) {
  console.error(`CRJ700 runtime verification failed: fallback manifest dimensions are ${length} m x ${wingspan} m.`);
  process.exit(1);
}
if (manifest?.upAxis !== "+Y" || manifest?.forwardAxis !== "-Z") {
  console.error("CRJ700 runtime verification failed: fallback manifest orientation is not +Y up / -Z forward.");
  process.exit(1);
}
if (!Array.isArray(manifest?.noseGearOrigin) || manifest.noseGearOrigin.some((value) => value !== 0)) {
  console.error("CRJ700 runtime verification failed: fallback nose-gear capture origin is not [0,0,0].");
  process.exit(1);
}
if (manifest?.source !== "CRJ700.stl" || manifest?.format !== "glTF Binary 2.0") {
  console.error("CRJ700 runtime verification failed: fallback manifest does not identify the STL-derived GLB payload.");
  process.exit(1);
}

console.log(`CRJ700 runtime verification passed: candidate-aware authored-aircraft selection is active, authored materials and embedded gear are preserved, and the ${fallbackStats.size}-byte fallback remains valid at ${length.toFixed(2)} m x ${wingspan.toFixed(2)} m.`);
