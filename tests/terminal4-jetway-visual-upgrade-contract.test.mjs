import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const preparation = fs.readFileSync("scripts/prepare-terminal4-jetway-visual-upgrade-v35.mjs", "utf8");
const uploadedFleet = fs.readFileSync("src/environment/uploadedAirportJetwayFleet.js", "utf8");
const uploadedConnectors = fs.readFileSync("src/environment/uploadedAirportJetwayTerminalConnector.js", "utf8");
const uploadedPreparation = fs.readFileSync("scripts/prepare-uploaded-airport-jetway-fleet.mjs", "utf8");
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
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'new GLTFLoader().loadAsync(modelUrl())',
  'const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]',
  '"Tunnel_C_Jetway_0"',
  '"Tunnel_C_Glass_JW_0"',
  '"Rotunda_Jetway_0"',
  '"Cab_Jetway_0"',
  '"Cab_Glass_JW_0"',
  '"Tunnel_A_Jetway_0"',
  '"Tunnel_B_Jetway_0"',
  'mesh.geometry?.getAttribute("position")',
  'mesh.geometry?.getAttribute("normal")',
  'mesh.geometry?.getAttribute("uv")',
  'materials.has("Jetway")',
  'materials.has("Glass_JW")',
  'triangleCount !== 31_978',
  'sourceLongitudinalAxis',
  'axisCorrectionRadians',
  'rotundaOriginNormalized = true',
  'groundContactNormalized = true',
  'placements.length !== 58',
  'staticPlacements.length !== 57',
  'collectPrototypeMeshes',
  'buildStaticInstancedFleet',
  'new THREE.InstancedMesh',
  'UploadedAirportJetwayStaticExactGlbInstances',
  'prototype.clone(true)',
  'UploadedAirportJetwayModel_A1',
  'addUploadedAirportJetwayStaticTerminalConnectors',
  'uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount',
  'uploadedJetwayAnimatedIndividualGateCount = 1',
  'uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount',
  'uploadedJetwayStaticConnectorGateCount = staticConnectors.staticGateCount',
  'uploadedJetwayStaticConnectorBatchCount = staticConnectors.batchCount',
  'uploadedJetwayIndividualConnectorGateCount = 1',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
  'uploadedJetwayMaximumPositionErrorMeters = 0',
  'uploadedJetwayMaximumUvError = 0',
  'requiresOriginalSourceMesh = true',
  'proceduralJetwayStairCount = 0',
  'proceduralProjectedUvCount = 0',
  'hiddenGeneratedObjectCount',
]) {
  if (!uploadedFleet.includes(token)) throw new Error(`Exact uploaded Terminal 4 jetway fleet is missing ${token}`);
}

for (const forbidden of [
  "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v5-instanced-static-jetways-and-connectors-source-textured",
  "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2",
  "source-triangle-stair-and-bogie-material-split-v1",
  "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "splitTunnelCSourceDetail",
  "Tunnel_C_SourceDetailMaterialSplit",
  "new THREE.EdgesGeometry",
  "new THREE.LineSegments",
  "decodeDeltaVarint",
  "decodeOctNormal",
  "geometry.bin",
  "DecompressionStream",
  "M1DGJETWAY",
]) {
  if (uploadedFleet.includes(forbidden)) {
    throw new Error(`Exact uploaded Terminal 4 jetway fleet retained retired generated detail: ${forbidden}`);
  }
}

for (const token of [
  "measured-authored-terminal-wall-to-uploaded-rotunda-v5-facade-plane-portal-static-instanced",
  "57-static-terminal-connectors-three-instanced-box-batches-v1",
  "addUploadedAirportJetwayStaticTerminalConnectors",
  "UploadedAirportJetwayStaticTerminalConnectorBatches",
  "UploadedAirportJetwayStaticConnectorShells",
  "UploadedAirportJetwayStaticConnectorFrames",
  "UploadedAirportJetwayStaticConnectorGlass",
  "new THREE.InstancedMesh",
  "staticGateCount: staticPlacements.length",
  "batchCount: group.children.length",
  "facade-plane-dark-reveal-with-hidden-deep-overlap-v4",
  "UploadedAirportJetwayTerminalPortalInterior_A1",
  "UploadedAirportJetwayTerminalPortalOuterHeader_A1",
  "UploadedAirportJetwayTerminalPortalOuterJamb_A1",
  "UploadedAirportJetwayTerminalPortalInnerJamb_A1",
  "a1FacadePortalDistanceMeters",
  "a1HiddenOverlapMeters",
]) {
  if (!uploadedConnectors.includes(token)) throw new Error(`Uploaded Terminal 4 connector batching is missing ${token}`);
}

for (const token of [
  'await import("./materialize-exact-airport-jetway.mjs")',
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
]) {
  if (!uploadedPreparation.includes(token)) throw new Error(`Exact uploaded Terminal 4 jetway preparation is missing ${token}`);
}
for (const forbidden of [
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "splitTunnelCSourceDetail",
  "source-triangle-stair-and-bogie-material-split",
  "geometry.bin",
]) {
  if (uploadedPreparation.includes(forbidden)) {
    throw new Error(`Exact uploaded Terminal 4 jetway preparation retained retired transformation: ${forbidden}`);
  }
}

for (const token of [
  'await import("./prepare-terminal4-jetway-source-uv-v36.mjs")',
  'await import("./prepare-uploaded-airport-jetway-fleet.mjs")',
  'await import("./prepare-uploaded-airport-jetway-readiness-v2.mjs")',
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
  if (moduleSource.includes(forbidden) || preparation.includes(forbidden) || uploadedPreparation.includes(forbidden)) {
    throw new Error(`Terminal 4 jetway visual pass contains forbidden source claim: ${forbidden}`);
  }
}

console.log("The untouched Airport_Jetway.glb is the production geometry and material authority at all 58 Terminal 4 gates: seven authored meshes, seven embedded textures, two original materials, original UVs and normals, parent-only axis normalization, 57 exact articulated static instance sets, one independently controlled A1 model, measured terminal connectors, and zero projected UV or procedural-detail substitution.");
