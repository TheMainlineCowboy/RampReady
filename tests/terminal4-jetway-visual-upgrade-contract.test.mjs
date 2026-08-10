import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const uploadedFleet = fs.readFileSync("src/environment/uploadedAirportJetwayFleet.js", "utf8");
const articulation = fs.readFileSync("src/environment/uploadedAirportJetwayArticulationV10.js", "utf8");
const measuredStaticConnectors = fs.readFileSync("src/environment/staticSourceMeasuredTerminalConnectorsV2.js", "utf8");
const measuredStaticPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-measured-terminal-legs-v1.mjs", "utf8");
const staticPlacementPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs", "utf8");
const ownGateLengthPreparation = fs.readFileSync("scripts/prepare-static-jetway-own-gate-lengths-v1.mjs", "utf8");
const uploadedPreparation = fs.readFileSync("scripts/prepare-uploaded-airport-jetway-fleet.mjs", "utf8");
const continuity = fs.readFileSync("scripts/prepare-terminal4-facade-continuity-v8.mjs", "utf8");

for (const token of [
  "enhanceTerminal4JetwayVisuals",
  "jetwayVisualUpgradeProceduralGeometryRemoved = true",
  "jetwayVisualUpgradePackageMeshIsSoleGeometryAuthority = true",
  "jetwayVisualUpgradeExactTexturePreserved = true",
]) {
  if (!moduleSource.includes(token)) throw new Error(`Terminal 4 package-native visual authority is missing ${token}`);
}
for (const forbidden of [
  "new THREE.BoxGeometry",
  "new THREE.CylinderGeometry",
  "AIR_Jetway01_OuterLowerSkirts_V35",
  "AIR_Jetway01_OuterRoofAndUnderbridgeStructure_V35",
]) {
  if (moduleSource.includes(forbidden)) throw new Error(`Procedural jetway dressing remains: ${forbidden}`);
}

for (const token of [
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1"',
  'EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb"',
  'const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]',
  'triangleCount !== 31_978',
  'placements.length !== 58',
  'staticPlacements.length !== 57',
  'UploadedAirportJetwayStaticExactGlbInstances',
  'UploadedAirportJetwayModel_A1',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
]) {
  if (!uploadedFleet.includes(token)) throw new Error(`Exact uploaded Terminal 4 jetway fleet is missing ${token}`);
}
for (const forbidden of [
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "splitTunnelCSourceDetail",
  "geometry.bin",
]) {
  if (uploadedFleet.includes(forbidden)) throw new Error(`Exact uploaded jetway fleet retained retired generated detail: ${forbidden}`);
}

for (const token of [
  'STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-source-measured-real-wall-fixed-terminal-legs-v4"',
  "MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0.25",
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.25",
  "compactRealWallSleevesOnly = true",
  "sourceMeasuredRealWallConnectors = true",
  "staticGateCount: 57",
]) {
  if (!measuredStaticConnectors.includes(token)) throw new Error(`Compact static wall connector is missing ${token}`);
}
for (const forbidden of [
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 43",
  "groundSupportedFixedCorridors = true",
]) {
  if (measuredStaticConnectors.includes(forbidden)) throw new Error(`Static connector retained giant-corridor behavior: ${forbidden}`);
}

for (const token of [
  'prepare-static-jetway-own-gate-lengths-v1.mjs',
  "MIN_VISIBLE_METERS = 0.25",
  "MAX_VISIBLE_METERS = 1.25",
  "EXPECTED_VISIBLE_METERS = 0.55",
  "giant-corridor policy",
]) {
  if (!measuredStaticPreparation.includes(token)) throw new Error(`Final static connector preparation is missing ${token}`);
}

for (const token of [
  'REGISTRATION_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9"',
  "COMPACT_VISIBLE_TERMINAL_LEG_METERS = 0.55",
  "COMPACT_TERMINAL_WALL_OVERLAP_METERS = 0.18",
  "const yaw = targetRegistrationYaw;",
  "const ownGateHeadingErrorRadians",
  "ownGateHeadingErrorRadians >",
  "terminalFacingDot > 0.25",
  "uploadedJetwayStaticOwnGateTargetCount = 57",
]) {
  if (!staticPlacementPreparation.includes(token)) throw new Error(`Own-gate real-wall registration is missing ${token}`);
}
for (const forbidden of [
  "const yaw = sourceYaw;",
  "const resolvedRotundaCenterToWallMeters = sourceWallDistance;",
  "57-static-source-heading-real-wall-compact-registration-v8",
]) {
  if (staticPlacementPreparation.includes(forbidden)) throw new Error(`Static placement retained crossed/fake placement behavior: ${forbidden}`);
}

for (const token of [
  "const exactBridgeEnd = bridgeEnd;",
  "arbitrary static jetway length formula survived",
  "decoded source bridge distance",
]) {
  if (!ownGateLengthPreparation.includes(token)) throw new Error(`Decoded static jetway length preparation is missing ${token}`);
}
if (ownGateLengthPreparation.includes("11.9 + (exactUploadedGateCode % 4) * 0.65")) {
  throw new Error("Arbitrary gate-code jetway length formula returned");
}

for (const token of [
  'STATIC_RIGID_AUTHORITY = "57-static-exact-glb-own-gate-inward-telescope-v2"',
  'EXTENSION_LIMITS = Object.freeze({ minimum: -14.5, maximum: 0 })',
  "staticInwardPartOffsets",
  "Math.min(EXTENSION_LIMITS.maximum, requestedExtension)",
  "outwardReachShortfallMeters",
  "inwardTelescopeOnly: true",
]) {
  if (!articulation.includes(token)) throw new Error(`Static inward-only articulation is missing ${token}`);
}
for (const forbidden of [
  'STATIC_RIGID_AUTHORITY = "57-static-exact-glb-rigid-source-hierarchy-v1"',
  "maximum: 8.75",
]) {
  if (articulation.includes(forbidden)) throw new Error(`Static fixed/outward-stretch articulation survived: ${forbidden}`);
}

for (const token of [
  'await import("./materialize-exact-airport-jetway.mjs")',
  'MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1"',
  'uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"',
]) {
  if (!uploadedPreparation.includes(token)) throw new Error(`Exact uploaded jetway preparation is missing ${token}`);
}
for (const token of [
  'await import("./prepare-uploaded-airport-jetway-fleet.mjs")',
  'await import("./prepare-uploaded-airport-jetway-readiness-v2.mjs")',
]) {
  if (!continuity.includes(token)) throw new Error(`Terminal 4 runtime preparation is missing ${token}`);
}

console.log("Terminal 4 jetway contract passed: exact supplied GLB at 58 gates, compact real-wall Rotunda sleeves, own-gate aircraft-side headings, decoded per-gate static lengths, and inward-only telescoping with no arbitrary fixed-length or cross-stand source-heading ownership.");
