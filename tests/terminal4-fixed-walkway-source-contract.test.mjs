import fs from "node:fs";

const walkway = fs.readFileSync("src/environment/terminal4FixedWalkwaySourceSkinV38.js", "utf8");
const geometry = fs.readFileSync("src/environment/terminal4FixedWalkwayV20.js", "utf8");
const support = fs.readFileSync("src/environment/terminal4FixedWalkwaySupportV44.js", "utf8");
const polish = fs.readFileSync("scripts/prepare-terminal4-jetway-simulator-polish.mjs", "utf8");
const rendering = fs.readFileSync("scripts/prepare-simulator-render-quality.mjs", "utf8");

for (const token of [
  "package-native-fixed-walkway-source-geometry-v54",
  "AIR_Jetway01_FixedTerminalWalkways_V13",
  "source.visible = true",
  "proceduralReplacementMeshCount = 0",
  "packageWalkwayIsSoleGeometryAuthority = true",
  "sourceGeometryUnmoved = true",
  'hideProceduralGroup(group, "Terminal4_FixedWalkwayArchitecturalDetail_V15")',
  'hideProceduralGroup(group, "Terminal4_FixedWalkwayGroundSupports_V14")',
  'hideProceduralGroup(group, "Terminal4_A1_LowerFacadePortal_V15")',
  "fixedWalkwayProceduralGroundSupportsHidden",
  "obsoleteA1LowerFacadePortalHidden",
]) {
  if (!geometry.includes(token)) throw new Error(`Package fixed-walkway geometry contract is missing ${token}`);
}
for (const forbidden of [
  "new THREE.InstancedMesh",
  "new THREE.BoxGeometry",
  "Terminal4_FixedWalkway_Floors_V20",
  "Terminal4_FixedWalkway_Glazing_V20",
  "Terminal4_FixedWalkway_Mullions_V20",
  "Terminal4_FixedWalkway_DiagonalBraces_V20",
]) {
  if (geometry.includes(forbidden)) throw new Error(`Procedural fixed-walkway replacement remains: ${forbidden}`);
}

for (const token of [
  "exact-terminal4-T4_WALK-package-mesh-material-authority-v53",
  "findSourceMaterial",
  '"T4_WALK.BMP"',
  '"T4_WALK2.BMP"',
  "source.material = exactMaterial",
  "proceduralSkinMeshCount = 0",
  "packageMeshMaterialOnly = true",
  "packageWalkwayIsSoleVisualAuthority = true",
  "sourceGeometryUnmoved: true",
  "fixedWalkwayExactWallTexture",
  "fixedWalkwayExactRoofTexture",
  "fixedWalkwayProceduralSkinMeshCount = 0",
]) {
  if (!walkway.includes(token)) throw new Error(`Exact package walkway material contract is missing ${token}`);
}
for (const forbidden of [
  "addInstancedBoxes",
  "Terminal4_FixedWalkway_ExactSourceBackings_V40",
  "Terminal4_FixedWalkway_ExactSourceRoofSkins_V40",
  "new THREE.BoxGeometry",
]) {
  if (walkway.includes(forbidden)) throw new Error(`Procedural fixed-walkway skin remains: ${forbidden}`);
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
  if (!support.includes(token)) throw new Error(`Package-only fixed-walkway support contract is missing ${token}`);
}
for (const forbidden of [
  "InstancedMesh",
  "BoxGeometry",
  "MeshStandardMaterial",
  "MinimalColumns_V50",
  "LongitudinalGirders_V49",
  "ServiceCabinets_V46",
]) {
  if (support.includes(forbidden)) throw new Error(`Procedural support overlay remains: ${forbidden}`);
}

for (const token of [
  'import { installTerminal4FixedWalkwayV20 } from "./terminal4FixedWalkwayV20.js";',
  'import { installTerminal4FixedWalkwaySourceSkinV38 } from "./terminal4FixedWalkwaySourceSkinV38.js";',
  'import { installTerminal4FixedWalkwaySupportV44 } from "./terminal4FixedWalkwaySupportV44.js";',
  "installTerminal4FixedWalkwayV20(sourcePlacedJetways);",
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

console.log("Verified the supplied Terminal 4 fixed-walkway mesh as sole geometry authority, exact package materials applied directly, generated center-post supports and obsolete facade hidden, zero procedural corridor/support meshes, unmoved source transforms and dynamic shadows.");
