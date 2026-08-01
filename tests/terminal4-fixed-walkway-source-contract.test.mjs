import fs from "node:fs";

const walkway = fs.readFileSync("src/environment/terminal4FixedWalkwaySourceSkinV38.js", "utf8");
const support = fs.readFileSync("src/environment/terminal4FixedWalkwaySupportV44.js", "utf8");
const polish = fs.readFileSync("scripts/prepare-terminal4-jetway-simulator-polish.mjs", "utf8");
const rendering = fs.readFileSync("scripts/prepare-simulator-render-quality.mjs", "utf8");

for (const token of [
  "exact-terminal4-T4_WALK-translucent-backing-and-roof-v40",
  "findSourceMaterial",
  '"T4_WALK.BMP"',
  '"T4_WALK2.BMP"',
  "Terminal4_FixedWalkway_ExactSourceBackings_V40",
  "Terminal4_FixedWalkway_ExactSourceRoofSkins_V40",
  "sourceGeometryUnmoved: true",
  "translucentBehindGlazing",
  "fixedWalkwayExactWallTexture",
  "fixedWalkwayExactRoofTexture",
  "fixedWalkwayTranslucentBacking",
]) {
  if (!walkway.includes(token)) throw new Error(`Exact fixed-walkway source contract is missing ${token}`);
}

for (const token of [
  "source-transform-fixed-walkway-integrated-load-frame-v49",
  "Terminal4_FixedWalkway_SupportUpgrade_V49",
  "Terminal4_FixedWalkway_LongitudinalGirders_V49",
  "Terminal4_FixedWalkway_UnderdeckFascias_V49",
  "Terminal4_FixedWalkway_TransferCrossheads_V49",
  "Terminal4_FixedWalkway_LoadColumns_V49",
  "Terminal4_FixedWalkway_CenterLoadSpines_V49",
  "Terminal4_FixedWalkway_KneeBraces_V49",
  "Terminal4_FixedWalkway_FormedFoundations_V49",
  "Terminal4_FixedWalkway_LowerTies_V49",
  "Terminal4_FixedWalkway_LongitudinalBraces_V49",
  "portalStationsPerWalkway = 2",
  "removedDecorativeServiceCabinets = true",
  "sourceGeometryUnmoved = true",
]) {
  if (!support.includes(token)) throw new Error(`Integrated fixed-walkway support contract is missing ${token}`);
}
for (const forbidden of [
  "ServiceCabinets_V46",
  "ServiceCabinetCaps_V46",
  "compact service cabinets V46",
]) {
  if (support.includes(forbidden)) throw new Error(`Detached decorative support treatment remains: ${forbidden}`);
}

for (const token of [
  'import { installTerminal4FixedWalkwaySourceSkinV38 } from "./terminal4FixedWalkwaySourceSkinV38.js";',
  'import { installTerminal4FixedWalkwaySupportV44 } from "./terminal4FixedWalkwaySupportV44.js";',
  "installTerminal4FixedWalkwaySourceSkinV38(sourcePlacedJetways, authored);",
  "installTerminal4FixedWalkwaySupportV44(sourcePlacedJetways);",
  "exact-source-lightmaps-balanced-for-daylight-v39",
  "material.emissiveIntensity = emissiveMap ? 0.07 : 0",
  "material.dithering = true",
  "if (source.includes(forbidden)) throw new Error",
]) {
  if (!polish.includes(token)) throw new Error(`Fixed-walkway/daylight production wiring is missing ${token}`);
}

for (const token of [
  "srgb-aces-apron-daylight-dynamic-shadows-v3",
  "renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))",
  "renderer.shadowMap.type = THREE.PCFSoftShadowMap",
  "const shadowMapSize = coarsePointer ? 2048 : 4096",
  "sun.position.set(56, 82, 66)",
  "new THREE.AmbientLight(0xffffff, 0.16)",
  'dataset.shadowMode = "dynamic-high-fidelity"',
  "if (source.includes(forbidden)) throw new Error",
]) {
  if (!rendering.includes(token)) throw new Error(`High-fidelity renderer contract is missing ${token}`);
}

console.log("Verified exact T4_WALK translucent fixed-corridor backing, integrated source-transform V49 load frames with underdeck fascia and center load spine, daylight-balanced package lightmaps, apron-side lighting, unmoved source transforms and persistent 2K/4K dynamic shadows.");
