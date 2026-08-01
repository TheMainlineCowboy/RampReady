import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const preparation = fs.readFileSync("scripts/prepare-terminal4-jetway-visual-upgrade-v35.mjs", "utf8");
const uploadedFleet = fs.readFileSync("src/environment/uploadedAirportJetwayFleet.js", "utf8");
const uploadedPreparation = fs.readFileSync("scripts/prepare-uploaded-airport-jetway-fleet.mjs", "utf8");
const uvPreparation = fs.readFileSync("scripts/prepare-terminal4-jetway-source-uv-v36.mjs", "utf8");
const continuity = fs.readFileSync("scripts/prepare-terminal4-facade-continuity-v8.mjs", "utf8");

for (const token of [
  "enhanceTerminal4JetwayVisuals",
  "package-native-terminal4-jetway-material-pass-no-procedural-detail-v52",
  "jetwayVisualUpgradeDetailInstanceCount = 0",
  "jetwayVisualUpgradeProceduralGeometryRemoved = true",
  "jetwayVisualUpgradePackageMeshIsSoleGeometryAuthority = true",
  "jetwayVisualUpgradeExactTexturePreserved = true",
  "jetwayVisualUpgradeMissingSourceMeshDisclosure = true",
]) {
  if (!moduleSource.includes(token)) throw new Error(`Package-native Terminal 4 jetway visual module is missing ${token}`);
}

for (const forbidden of [
  "new THREE.InstancedMesh",
  "new THREE.BoxGeometry",
  "new THREE.CylinderGeometry",
  "AIR_Jetway01_OuterLowerSkirts_V35",
  "AIR_Jetway01_OuterRoofAndUnderbridgeStructure_V35",
  "AIR_Jetway01_InnerSafetyBands_V35",
  "AIR_Jetway01_CabinFramesAndSkirts_V35",
  "AIR_Jetway01_CabinThresholds_V35",
  "AIR_Jetway01_RotundaStructuralBands_V35",
]) {
  if (moduleSource.includes(forbidden)) throw new Error(`Procedural jetway dressing remains: ${forbidden}`);
}

for (const token of [
  'import { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";',
  "const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);",
  "group.userData.jetwayVisualUpgradeDetailInstanceCount = jetwayVisualUpgrade.detailInstanceCount;",
]) {
  if (!preparation.includes(token)) throw new Error(`Terminal 4 legacy visual compatibility preparation is missing ${token}`);
}

for (const token of [
  "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v4-instanced-static-source-textured",
  "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2",
  "57-static-gates-instanced-plus-1-animated-a1-source-geometry-v4",
  "Tunnel_B",
  "Tunnel_C",
  "Cab",
  "UploadedAirportJetwayFleet",
  "UploadedAirportJetwayStaticInstancedBatches",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "collectPrototypeMeshes",
  "buildStaticInstancedFleet",
  "new THREE.InstancedMesh",
  "uploadedJetwayShadowCasterGateCount = shadowCasterGateCount",
  "uploadedJetwayGlobalEdgeOverlayCount = 0",
  "uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount",
  "uploadedJetwayAnimatedIndividualGateCount = 1",
  "uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount",
  "proceduralJetwayStairCount = 0",
  "hiddenGeneratedObjectCount",
  "PART_COUNT = 5",
]) {
  if (!uploadedFleet.includes(token)) throw new Error(`Uploaded Terminal 4 jetway fleet is missing ${token}`);
}
for (const forbidden of [
  "addStructuralEdges",
  "new THREE.EdgesGeometry",
  "new THREE.LineSegments",
]) {
  if (uploadedFleet.includes(forbidden)) throw new Error(`Uploaded Terminal 4 jetway fleet retained an all-gate rendering cost: ${forbidden}`);
}
for (const token of [
  "uploadedJetwayPlacements",
  "installUploadedAirportJetwayFleet",
  "sourceTextures",
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  "supersededFallbackDisclosure",
]) {
  if (!uploadedPreparation.includes(token)) throw new Error(`Uploaded Terminal 4 jetway preparation is missing ${token}`);
}

for (const token of [
  "source-length-height-shell-projection-v36",
  "const longitudinalShell = nz < 0.72",
  "clamp(z + 0.5, 0, 1)",
  "M1DGJETWAY's recovered shell strip",
]) {
  if (!uvPreparation.includes(token)) throw new Error(`Terminal 4 exact jetway UV preparation is missing ${token}`);
}

for (const token of [
  'await import("./prepare-terminal4-jetway-source-uv-v36.mjs")',
  'await import("./prepare-uploaded-airport-jetway-fleet.mjs")',
]) {
  if (!continuity.includes(token)) throw new Error(`Terminal 4 runtime preparation is missing ${token}`);
}
if (continuity.includes('await import("./prepare-terminal4-jetway-visual-upgrade-v35.mjs")')) {
  throw new Error("Obsolete V35 procedural jetway pass returned to the production runtime chain");
}

for (const forbidden of [
  "usesTerminalBuildingTextures = true",
  "CanvasTexture",
]) {
  if (moduleSource.includes(forbidden) || preparation.includes(forbidden) || uvPreparation.includes(forbidden)) {
    throw new Error(`Terminal 4 jetway visual pass contains forbidden source claim: ${forbidden}`);
  }
}

console.log("The supplied source-textured Tunnel_A/B/C/Rotunda/Cab fleet is the production authority at all 58 gates: 57 static gates are batched from the exact shared geometry and materials, A1 remains an individual animated model and no procedural replacement or all-gate edge dressing is wired into runtime.");
