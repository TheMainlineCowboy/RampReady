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
  "package-native-fixed-walkway-no-procedural-support-v51",
  "Terminal4_FixedWalkway_PackageAuthority_V51",
  "proceduralSupportMeshCount = 0",
  "packageWalkwayIsSoleVisualAuthority = true",
  "fixedWalkwaySupportDetailCount = 0",
  "fixedWalkwayProceduralSupportRemoved = true",
  "sourceGeometryUnmoved = true",
]) {
  if (!support.includes(token)) throw new Error(`Package-only fixed-walkway contract is missing ${token}`);
}

for (const forbidden of [
  "InstancedMesh",
  "BoxGeometry",
  "MeshStandardMaterial",
  "MinimalColumns_V50",
  "MinimalCrossheads_V50",
  "CompactFootings_V50",
  "LongitudinalGirders_V49",
  "UnderdeckFascias_V49",
  "CenterLoadSpines_V49",
  "LongitudinalBraces_V49",
  "ServiceCabinets_V46",
]) {
  if (support.includes(forbidden)) throw new Error(`Procedural support overlay remains: ${forbidden}`);
}

for (const token of [
  'import { installTerminal4FixedWalkwaySourceSkinV38 } from "./terminal4FixedWalkwaySourceSkinV38.js";',
  'import { installTerminal4FixedWalkwaySupportV44 } from "./terminal4FixedWalkwaySupportV44.js";',
  "installTerminal4FixedWalkwaySourceSkinV38(sourcePlacedJetways, authored);",
  "installTerminal4FixedWalkwaySupportV44(sourcePlacedJetways);",
  "exact-source-lightmaps-balanced-for-daylight-v39",
  "material.emissiveIntensity = emissiveMap ? 0.07 : 0",
  "material.dithering = true",
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
]) {
  if (!rendering.includes(token)) throw new Error(`High-fidelity renderer contract is missing ${token}`);
}

console.log("Verified exact package T4_WALK skins as the sole fixed-walkway visual authority, zero procedural support meshes, unmoved source transforms, daylight-balanced lightmaps and persistent dynamic shadows.");
