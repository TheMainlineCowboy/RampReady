import fs from "node:fs";

const walkway = fs.readFileSync("src/environment/terminal4FixedWalkwaySourceSkinV38.js", "utf8");
const polish = fs.readFileSync("scripts/prepare-terminal4-jetway-simulator-polish.mjs", "utf8");
const rendering = fs.readFileSync("scripts/prepare-simulator-render-quality.mjs", "utf8");

for (const token of [
  "exact-terminal4-T4_WALK-source-skin-and-roof-v38",
  "findSourceMaterial",
  '"T4_WALK.BMP"',
  '"T4_WALK2.BMP"',
  "Terminal4_FixedWalkway_ExactSourceSideSkins_V38",
  "Terminal4_FixedWalkway_ExactSourceRoofSkins_V38",
  "sourceGeometryUnmoved: true",
  "fixedWalkwayExactWallTexture",
  "fixedWalkwayExactRoofTexture",
]) {
  if (!walkway.includes(token)) throw new Error(`Exact fixed-walkway source contract is missing ${token}`);
}

for (const token of [
  'import { installTerminal4FixedWalkwaySourceSkinV38 } from "./terminal4FixedWalkwaySourceSkinV38.js";',
  "installTerminal4FixedWalkwaySourceSkinV38(sourcePlacedJetways, authored);",
  "exact-source-lightmaps-balanced-for-daylight-v39",
  "material.emissiveIntensity = emissiveMap ? 0.07 : 0",
  "material.dithering = true",
]) {
  if (!polish.includes(token)) throw new Error(`Fixed-walkway/daylight production wiring is missing ${token}`);
}
if (polish.includes("material.emissiveIntensity = emissiveMap ? 0.68 : 0")) {
  throw new Error("Terminal 4 still applies nighttime source lightmaps at the washed-out daylight intensity");
}

for (const token of [
  "srgb-aces-high-fidelity-dynamic-shadows-v2",
  "renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))",
  "renderer.shadowMap.type = THREE.PCFSoftShadowMap",
  "const shadowMapSize = coarsePointer ? 2048 : 4096",
  'dataset.shadowMode = "dynamic-high-fidelity"',
]) {
  if (!rendering.includes(token)) throw new Error(`High-fidelity renderer contract is missing ${token}`);
}

for (const forbidden of [
  "sim.renderer.shadowMap.enabled = !next",
  'dataset.shadowMode = next ? "inspection-ambient" : "training-dynamic"',
]) {
  if (rendering.includes(forbidden)) throw new Error(`Inspection still downgrades rendering: ${forbidden}`);
}

console.log("Verified exact T4_WALK fixed-corridor source skins, daylight-balanced package lightmaps, unmoved source transforms and persistent 2K/4K dynamic shadows.");
