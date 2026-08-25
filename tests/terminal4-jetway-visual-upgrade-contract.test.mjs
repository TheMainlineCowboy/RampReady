import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const uploadedFleet = fs.readFileSync("src/environment/uploadedAirportJetwayFleet.js", "utf8");
const articulation = fs.readFileSync("src/environment/uploadedAirportJetwayArticulationV10.js", "utf8");
const measuredStaticConnectors = fs.readFileSync("src/environment/staticSourceMeasuredTerminalConnectorsV2.js", "utf8");
const measuredStaticPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-measured-terminal-legs-v1.mjs", "utf8");
const staticPlacementPreparation = fs.readFileSync("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs", "utf8");
const sourceRegistrationPreparation = fs.readFileSync("scripts/prepare-terminal4-jetway-source-registration-v1.mjs", "utf8");
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
  'replace(\'const AUTHORITY = "57-static-source-heading-real-wall-compact-registration-v8";\'',
]) {
  if (!staticPlacementPreparation.includes(token)) throw new Error(`Own-gate real-wall registration is missing ${token}`);
}
if (staticPlacementPreparation.includes("const resolvedRotundaCenterToWallMeters = sourceWallDistance;")) {
  throw new Error("Static placement retained fake raw source wall distance ownership");
}

// A1 and the 57 static gates intentionally have different heading ownership.
// A1 is the independently animated source gate and must keep the decoded KPHX
// airport yaw as physical authority. The static gates retain decoded source yaw
// as provenance, then use their own authored stand target for aircraft-side yaw
// after real-wall Rotunda registration so they cannot cross neighboring stands.
for (const token of [
  'STATIC_SOURCE_HEADING_AUTHORITY = "57-static-bgl-jetway-heading-provenance-v3"',
  'A1_SOURCE_HEADING_AUTHORITY = "a1-decoded-kphx-bgl-heading-preserved-v1"',
  'yaw: sourceJetwayYaw',
  'sourceHeadingAuthority: jetway.g === "A1" ? "${A1_SOURCE_HEADING_AUTHORITY}" : "${STATIC_SOURCE_HEADING_AUTHORITY}"',
  'const yaw = targetRegistrationYaw;',
  'replaceAll("  const yaw = sourceYaw;", "  const yaw = targetRegistrationYaw;")',
  "uploadedJetwayStaticSourceHeadingProvenanceGateCount = 57",
  'const oldA1Exception = \'yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw\';',
]) {
  if (!sourceRegistrationPreparation.includes(token)) throw new Error(`Source-heading ownership migration is missing ${token}`);
}
for (const forbidden of [
  'a1-photo-registered-animated-exception',
]) {
  if (sourceRegistrationPreparation.includes(forbidden) && !sourceRegistrationPreparation.includes(`forbidden`)) {
    throw new Error(`Retired A1 source-heading exception survived: ${forbidden}`);
  }
}

// The final static length stage must preserve the Aug. 15 photo-compact A3+
// deployment even when later source-measured connector preparation invokes it
// again. Decoded bridgeEnd remains A1/provenance authority, but may not retake
// rendered length authority for the 57 static bridges and re-extend them.
for (const token of [
  'compactLengthMarker = "static-a3plus-photo-compact-gate-specific-bridge-end-v1"',
  "const photoCompactLengthBlock =",
  'const exactBridgeEnd = jetway.g === "A1"',
  ': 8.2 + (exactUploadedGateCode % 5) * 0.45;',
  "source.includes(decodedSourceLengthBlock)",
  "source.replace(decodedSourceLengthBlock, photoCompactLengthBlock)",
  "stale static jetway length authority survived",
  "can no longer re-extend the 57 static bridges",
]) {
  if (!ownGateLengthPreparation.includes(token)) throw new Error(`Photo-compact static jetway final length authority is missing ${token}`);
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

console.log("Terminal 4 jetway contract passed: exact supplied GLB at 58 gates; A1 keeps decoded KPHX source yaw and decoded bridge length as its physical airport authority; static gates use compact real-wall Rotunda sleeves, own-gate aircraft-side headings, final 8.2-10.0 m photo-compact inward telescope targets, decoded source distance as provenance only, and no cross-stand source-heading ownership.");
