import { access, readFile, stat } from "node:fs/promises";

const modelSourceUrl = new URL("../src/components/aircraft/crj700Model.js", import.meta.url);
const assetUrl = new URL("../public/models/crj700-mobile.glb", import.meta.url);
const manifestUrl = new URL("../public/models/crj700-mobile.manifest.json", import.meta.url);

const source = await readFile(modelSourceUrl, "utf8");
const requiredSourceMarkers = [
  'new URL("models/crj700-mobile.glb", document.baseURI)',
  'import("three/addons/loaders/GLTFLoader.js")',
  "loader.loadAsync",
  'aircraftAssetState = "loading"',
  'aircraftAssetState = "ready"',
  'aircraftAssetState = "error"',
  'renderedAircraftSource = "CRJ700.stl"',
  'renderedAircraftSource = "procedural-fallback"',
  "new THREE.Box3().setFromObject(realModel)",
  "rawSize.z",
  "rawSize.x",
  "child.visible = false",
  "retainedProceduralChildren.has(child)",
  "noseGearCaptureOrigin = [0, 0, 0]",
  'orientation = { up: "+Y", forward: "-Z" }',
];

const missingMarkers = requiredSourceMarkers.filter((marker) => !source.includes(marker));
if (missingMarkers.length) {
  console.error(`CRJ700 runtime verification failed: missing integration markers: ${missingMarkers.join(", ")}`);
  process.exit(1);
}

await access(assetUrl);
await access(manifestUrl);
const assetStats = await stat(assetUrl);
if (assetStats.size < 10_000) {
  console.error(`CRJ700 runtime verification failed: prepared GLB is unexpectedly small (${assetStats.size} bytes).`);
  process.exit(1);
}

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const length = manifest?.dimensionsMeters?.length;
const wingspan = manifest?.dimensionsMeters?.wingspan;
if (Math.abs(length - 32.5) > 1.25 || Math.abs(wingspan - 23.64) > 1.25) {
  console.error(`CRJ700 runtime verification failed: manifest dimensions are ${length} m x ${wingspan} m.`);
  process.exit(1);
}
if (manifest?.orientation?.up !== "+Y" || manifest?.orientation?.forward !== "-Z") {
  console.error("CRJ700 runtime verification failed: manifest orientation is not +Y up / -Z forward.");
  process.exit(1);
}
if (!Array.isArray(manifest?.noseGearCaptureOrigin) || manifest.noseGearCaptureOrigin.some((value) => value !== 0)) {
  console.error("CRJ700 runtime verification failed: nose-gear capture origin is not [0,0,0].");
  process.exit(1);
}

console.log(`CRJ700 runtime verification passed: ${assetStats.size} byte GLB, ${length.toFixed(2)} m length, ${wingspan.toFixed(2)} m span, runtime loader/fallback/render-source checks present.`);
