import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const preparation = fs.readFileSync("scripts/prepare-terminal4-jetway-visual-upgrade-v35.mjs", "utf8");
const uploadedFleet = fs.readFileSync("src/environment/uploadedAirportJetwayFleet.js", "utf8");
const uploadedConnectors = fs.readFileSync("src/environment/uploadedAirportJetwayTerminalConnector.js", "utf8");
const measuredStaticConnectors = fs.readFileSync("src/environment/staticSourceMeasuredTerminalConnectorsV2.js", "utf8");
const measuredStaticPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-measured-terminal-legs-v1.mjs", "utf8");
const staticPlacementPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs", "utf8");
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
  'uploadedJetwayStaticConnectorGateCount = 0',
  'uploadedJetwayStaticConnectorBatchCount = 0',
  'uploadedJetwayStaticConnectorBatchAuthority = "waiting-for-measured-static-facade-registration"',
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
  "addUploadedAirportJetwayStaticTerminalConnectors",
  "57-static-terminal-connectors-three-instanced-box-batches-v1",
  "57-static-short-solid-white-terminal-vestibules-v1",
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
    throw new Error(`Exact uploaded Terminal 4 jetway fleet retained retired generated/static-connector detail: ${forbidden}`);
  }
}

// A1 keeps its individual facade portal implementation. The 57 static bridges
// deliberately do not use this legacy compact connector path anymore.
for (const token of [
  "addUploadedAirportJetwayTerminalConnector",
  "facade-plane-dark-reveal-with-hidden-deep-overlap-v4",
  "UploadedAirportJetwayTerminalPortalInterior_A1",
  "UploadedAirportJetwayTerminalPortalOuterHeader_A1",
  "UploadedAirportJetwayTerminalPortalOuterJamb_A1",
  "UploadedAirportJetwayTerminalPortalInnerJamb_A1",
  "a1FacadePortalDistanceMeters",
  "a1HiddenOverlapMeters",
]) {
  if (!uploadedConnectors.includes(token)) throw new Error(`A1 Terminal 4 connector is missing ${token}`);
}

// Static bridges keep the decoded KPHX source HEADING, but their complete rigid
// parents are translated to the measured real facade so the authored Rotunda is
// actually at the building. Generated geometry is allowed only as a short sleeve
// through the facade/Rotunda joint; it can never become a substitute jetway.
for (const token of [
  'STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-source-measured-real-wall-fixed-terminal-legs-v4"',
  "MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0.25",
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.25",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.30",
  "staticAuthoredRotundaRadiusMeters",
  "staticVisibleTerminalLegMeters",
  "staticTerminalWallOverlapMeters",
  "wallConnectorLength",
  "expectedCenterToWall",
  "UploadedAirportJetwayStaticSourceMeasuredTerminalConnectors",
  "UploadedAirportJetwayStaticTerminalConnectorBatches",
  "compactRealWallSleevesOnly = true",
  "sourceMeasuredRealWallConnectors = true",
  "staticGateCount: 57",
  "addStaticSolidTerminalVestibules",
]) {
  if (!measuredStaticConnectors.includes(token)) throw new Error(`Compact static Terminal 4 connector is missing ${token}`);
}
for (const forbidden of [
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 43",
  "SUPPORT_SPACING_METERS",
  "groundSupportedFixedCorridors = true",
  "addUploadedAirportJetwayStaticTerminalConnectors",
]) {
  if (measuredStaticConnectors.includes(forbidden)) throw new Error(`Static connector retained giant-corridor behavior: ${forbidden}`);
}
for (const token of [
  "staticSourceMeasuredTerminalConnectorsV2.js",
  "MIN_VISIBLE_METERS = 0.25",
  "MAX_VISIBLE_METERS = 1.25",
  "EXPECTED_VISIBLE_METERS = 0.55",
  "giant-corridor policy",
]) {
  if (!measuredStaticPreparation.includes(token)) throw new Error(`Compact static connector preparation is missing ${token}`);
}
for (const token of [
  'REGISTRATION_AUTHORITY = "57-static-source-heading-real-wall-compact-registration-v8"',
  "COMPACT_VISIBLE_TERMINAL_LEG_METERS = 0.55",
  "COMPACT_TERMINAL_WALL_OVERLAP_METERS = 0.18",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = sourceYaw;",
  "Giant synthetic corridors and CRJ-target re-aiming are now fail-closed",
]) {
  if (!staticPlacementPreparation.includes(token)) throw new Error(`Static source-heading real-wall registration is missing ${token}`);
}
for (const forbidden of [
  "MAX_VISIBLE_METERS = 43",
  "const resolvedRotundaCenterToWallMeters = sourceWallDistance;",
  "source-locked wall fit would require an invalid visible terminal leg",
]) {
  if (staticPlacementPreparation.includes(forbidden)) throw new Error(`Static placement retained bad source-position lock: ${forbidden}`);
}

for (const token of [
  'await import("./materialize-exact-airport-jetway.mjs")',
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
  '"addProjectedUvs"',
  '"cloneCorrugatedAtlasBand"',
  '"splitTunnelCSourceDetail"',
  '"source-triangle-stair-and-bogie-material-split"',
  '"geometry.bin"',
]) {
  if (!uploadedPreparation.includes(token)) throw new Error(`Exact uploaded Terminal 4 jetway preparation is missing ${token}`);
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

for (const forbidden of ["usesTerminalBuildingTextures = true", "CanvasTexture"]) {
  if (moduleSource.includes(forbidden) || preparation.includes(forbidden) || uploadedPreparation.includes(forbidden)) {
    throw new Error(`Terminal 4 jetway visual pass contains forbidden source claim: ${forbidden}`);
  }
}

console.log("The exact Airport_Jetway.glb remains the production geometry/material authority at all 58 Terminal 4 gates. Static jetways preserve decoded KPHX headings, their rigid parents register to the measured real facade, and generated fixed geometry is hard-limited to compact wall/Rotunda sleeves instead of long substitute corridors. A1 retains its individual real-wall portal and airport-owned bridge pose.");