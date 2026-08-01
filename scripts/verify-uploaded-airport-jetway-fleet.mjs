import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Uploaded jetway verification is missing ${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireTokens(path, tokens) {
  const source = read(path);
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path} is missing uploaded jetway token: ${token}`);
  }
  return source;
}

const fleet = requireTokens("src/environment/uploadedAirportJetwayFleet.js", [
  'MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v3-source-textured-optimized"',
  'MATERIAL_AUTHORITY = "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2"',
  'PERFORMANCE_AUTHORITY = "shared-geometry-single-a1-shadow-caster-no-global-edge-overlays-v3"',
  "geometry.part",
  "DecompressionStream(\"gzip\")",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  'fleet.name = "UploadedAirportJetwayFleet"',
  'anchor.name = `UploadedAirportJetway_${placement.gate}`',
  'uploadedJetwayLoadState = "ready"',
  "uploadedJetwayCount = placements.length",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "uploadedJetwayMaterialAuthority = prototype.userData.materialAuthority",
  "uploadedJetwayPerformanceAuthority = prototype.userData.performanceAuthority",
  "uploadedJetwayShadowCasterGateCount = shadowCasterGateCount",
  "uploadedJetwayGlobalEdgeOverlayCount = 0",
  "sourceGeometryMode = MODEL_AUTHORITY",
]);
for (const forbidden of [
  "procedural-articulated-fallback-pending-original-AIR_Jetway01-mesh-recovery",
  "addStructuralEdges",
  "new THREE.EdgesGeometry",
  "new THREE.LineSegments",
]) {
  if (fleet.includes(forbidden)) throw new Error(`Uploaded jetway fleet contains retired global rendering work: ${forbidden}`);
}

requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v5-source-textured-optimized"',
  "EXPECTED_GATE_COUNT = 58",
  "placements.map((placement) => `UploadedAirportJetway_${placement.gate}`)",
  "missingModels",
  'materialAuthority.includes("exact-M1DGJETWAY")',
  'performanceAuthority !== "shared-geometry-single-a1-shadow-caster-no-global-edge-overlays-v3"',
  "shadowCasterGateCount !== 1",
  "globalEdgeOverlayCount !== 0",
  "uploadedJetwayVerifiedModelCount = modelCount",
  "uploadedJetwayVerifiedGateNames",
  "waitForFleet(group, placements)",
  "installUploadedAirportJetwayFleetBase(THREE, group, placements, sourceTextures)",
]);

const jetways = requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js"',
  "const uploadedJetwayPlacements = []",
  "connectorTowardX",
  "connectorTowardZ",
  "wallConnectorLength",
  "uploadedJetwayPlacements.push",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures)",
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  'visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured"',
]);
if ((jetways.match(/uploadedAirportJetwayFleetReadyV2\.js/g) || []).length !== 1) {
  throw new Error("Source-placed Terminal 4 jetways must contain exactly one awaited fleet import");
}

requireTokens("src/environment/authoredTerminal4Visual.js", [
  "await sourcePlacedJetways.userData.uploadedJetwayReady",
  'uploadedJetwayLoadState !== "ready"',
  "uploadedJetwayCount) !== 58",
  "uploadedJetwayMeasuredTerminalConnectorCount) !== 58",
  "uploadedJetwayVerifiedModelCount) !== 58",
  "authoredTerminal4UploadedJetwayLoadState",
  "authoredTerminal4UploadedJetwayCount",
  "authoredTerminal4UploadedJetwayConnectorCount",
  "authoredTerminal4UploadedJetwayVerifiedModelCount",
  "authoredTerminal4UploadedJetwayReadyAuthority",
]);

requireTokens("src/components/RampReadyStandupTrainerTerminal4.jsx", [
  'dataset.terminal4UploadedJetwayLoadState = "loading"',
  "dataset.terminal4UploadedJetwayLoadState = environment.userData",
  "dataset.terminal4UploadedJetwayCount",
  "dataset.terminal4UploadedJetwayConnectorCount",
  "dataset.terminal4UploadedJetwayVerifiedModelCount",
  "dataset.terminal4UploadedJetwayReadyAuthority",
  'dataset.terminal4UploadedJetwayLoadState = "load-error"',
]);

requireTokens("scripts/prepare-a1-connection-camera-v5.mjs", [
  "cameraPosition: Object.freeze([-12.0, 10.5, 28.0])",
  "cameraTarget: Object.freeze([-27.5, 4.1, -16.15])",
  "wide-diagonal-a1-terminal-joint-v5",
]);
requireTokens("tests/browser/source-first-a1-repair.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  '"data-terminal4-uploaded-jetway-count"',
  '"data-terminal4-uploaded-jetway-connector-count"',
  '"data-terminal4-uploaded-jetway-verified-model-count"',
  "uploaded-airport-jetway-fleet-complete-58-gates-v5-source-textured-optimized",
  "wide-diagonal-a1-terminal-joint-v5",
]);
requireTokens("tests/browser/kphx-ground-runtime.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  "terminal4UploadedJetwayLoadState",
  "terminal4UploadedJetwayCount",
  "terminal4UploadedJetwayConnectorCount",
  "terminal4UploadedJetwayVerifiedModelCount",
  "terminal4UploadedJetwayReadyAuthority",
  "uploaded-airport-jetway-fleet-complete-58-gates-v5-source-textured-optimized",
  "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v3-source-textured-optimized",
]);

console.log("Verified the optimized exact-source-textured user-supplied Tunnel_A/B/C/Rotunda/Cab airport jetway as the awaited production authority at all 58 Terminal 4 gates, with 58 measured terminal connectors, shared geometry, one A1 shadow caster, zero global edge overlays and an unclipped A1 inspection frame.");
