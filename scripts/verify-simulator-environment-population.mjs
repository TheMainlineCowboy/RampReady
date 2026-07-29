import fs from "node:fs";

const staticSource = fs.readFileSync("src/environment/staticGateAircraft.js", "utf8");
const apronSource = fs.readFileSync("src/environment/a1SimulatorApron.js", "utf8");
const equipmentSource = fs.readFileSync("src/environment/staticRampEquipment.js", "utf8");
const objectSource = fs.readFileSync("src/environment/sourceAuthoredAirportObjects.js", "utf8");
const materializer = fs.readFileSync("scripts/materialize-kphx-source-objects.mjs", "utf8");
const converter = fs.readFileSync("scripts/lib/legacyBmpPng.mjs", "utf8");
const patchSource = fs.readFileSync("scripts/prepare-simulator-environment.mjs", "utf8");
const generated = fs.readFileSync("src/components/RampReadyStandupTrainerTerminal4.jsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const failures = [];
const requireText = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label} is missing`);
};

for (const gate of ["A2", "A3", "A4", "A5", "A6", "A7", "A8"]) requireText(staticSource, `"${gate}"`, `static gate ${gate}`);
requireText(staticSource, "loadSelectedAircraftRuntime", "authored aircraft loader");
requireText(staticSource, "result.preserveMaterials", "authored livery preservation gate");
requireText(staticSource, "decoded KPHX ADEX parking position and heading", "source aircraft placement authority");
requireText(staticSource, "root.rotation.y = (270 - gate.h)", "source aircraft heading transform");
requireText(staticSource, "authored-crj700-static-gate-population-v1", "static aircraft detail level");

for (const token of [
  'sourceTexture: "models/phx-terminal4/textures/PARKRAMPS.png"',
  'bounds: Object.freeze({ minX: -35, maxX: 300, minZ: -92, maxZ: 38 })',
  "textureResolution: 1024",
  "drawApronCanvas",
  "sampleSourceAverage",
  "apron.receiveShadow = false",
  "a1-a8-source-derived-close-range-apron-v1",
]) requireText(apronSource, token, `close-range apron ${token}`);

for (const token of [
  'tugGates: Object.freeze(["A2", "A4", "A6"])',
  'conedGates: Object.freeze(["A2", "A3", "A4", "A5", "A6", "A7", "A8"])',
  "models/standup-tug.glb",
  "installA1SimulatorApron",
  "applyPiedmontFinish",
  "buildSafetyCone",
  "staticRampAuthoredTugCount",
  "staticRampSafetyConeCount",
  "staticRampApronDetailLevel",
  "staticRampApronTextureResolution",
  "authored-standup-ramp-equipment-and-cones-v1",
]) requireText(equipmentSource, token, `static ramp equipment ${token}`);

for (const token of [
  "58115954e8d8294448e6e06d1be24d81a8e22764",
  "source-authored-textured-airport-object-population-v2",
  "sourceAuthoredAirportObjectPlacementCount",
  "sourceAuthoredAirportObjectModelCount",
  "sourceAuthoredAirportObjectTextureCount",
  "sourceAuthoredAirportObjectTexturedMaterialCount",
  "90 - placement.headingDegrees",
  "texture.anisotropy = 16",
]) requireText(objectSource, token, `source object runtime ${token}`);
for (const token of [
  'expectedPlacements: 3',
  'expectedPlacements: 13',
  'expectedPlacements: 1',
  "inspection.libraryObjectPlacementCount !== 579",
  "placements.length !== 19",
  "textureCount: Object.keys(textureManifest).length",
  '"BACKHOE.BMP"',
  '"TRAILER.BMP"',
]) requireText(materializer, token, `source object materializer ${token}`);
for (const token of ["decodeLegacyBmp", "decodeDxt1", "encodePng", "pngChunk"]) requireText(converter, token, `legacy texture converter ${token}`);

for (const [token, label] of [
  ["installStaticGateAircraft", "static aircraft preparation import"],
  ["installSourceAuthoredAirportObjects", "source object preparation import"],
  ["installStaticRampEquipment", "static ramp equipment preparation import"],
  ["sourceObjectLoad", "source object readiness promise"],
  ["rampEquipmentLoad", "ramp equipment readiness promise"],
  ["sourceObjectTextureCount", "source object texture browser evidence"],
  ["staticRampAuthoredTugCount", "ramp tug browser evidence"],
  ["THREE.ACESFilmicToneMapping", "ACES tone mapping"],
  ["THREE.PCFSoftShadowMap", "soft shadow filtering"],
  ["sun.shadow.mapSize.set(2048, 2048)", "high-resolution sun shadow map"],
  ['dataset.visualQuality = "simulator-rendering-v1"', "visual quality browser evidence"],
]) requireText(patchSource, token, label);
requireText(generated, 'import { installStaticGateAircraft } from "../environment/staticGateAircraft.js";', "generated static aircraft import");
requireText(generated, 'import { installSourceAuthoredAirportObjects } from "../environment/sourceAuthoredAirportObjects.js";', "generated source object import");
requireText(generated, 'import { installStaticRampEquipment } from "../environment/staticRampEquipment.js";', "generated static ramp equipment import");
requireText(generated, "installStaticGateAircraft(THREE, environment)", "generated static aircraft loader");
requireText(generated, "installSourceAuthoredAirportObjects(THREE, environment)", "generated source object loader");
requireText(generated, "installStaticRampEquipment(THREE, environment)", "generated static ramp equipment loader");
requireText(generated, "renderer.toneMapping = THREE.ACESFilmicToneMapping", "generated ACES rendering");
requireText(generated, "sun.shadow.camera.left = -190", "generated airport-wide shadow camera");
requireText(generated, "Promise.all([terminalLoad, groundLoad, photoGroundLoad, staticAircraftLoad, sourceObjectLoad, rampEquipmentLoad])", "combined simulator readiness gate");

if (packageJson.scripts?.["materialize:kphx-source-objects"] !== "node scripts/materialize-kphx-source-objects.mjs") failures.push("package source object materializer script is incorrect");
if (packageJson.scripts?.["prepare:simulator-environment"] !== "node scripts/prepare-simulator-environment.mjs") failures.push("package simulator preparation script is incorrect");
for (const scriptName of ["build", "dev", "verify"]) {
  if (!packageJson.scripts?.[scriptName]?.includes("materialize:kphx-source-objects")) failures.push(`${scriptName} skips source object materialization`);
  if (!packageJson.scripts?.[scriptName]?.includes("prepare:simulator-environment")) failures.push(`${scriptName} skips simulator environment preparation`);
}

if (failures.length) {
  console.error("Simulator environment population verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Simulator environment population verified: close-range A1-A8 apron, ACES rendering, airport-wide soft shadows, seven aircraft, three authored stand-up tugs, twenty-eight cones and nineteen textured source placements participate in browser readiness.");
