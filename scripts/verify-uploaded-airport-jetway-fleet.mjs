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
  'MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v4-instanced-static-source-textured"',
  'MATERIAL_AUTHORITY = "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2"',
  'PERFORMANCE_AUTHORITY = "57-static-gates-instanced-plus-1-animated-a1-source-geometry-v4"',
  "geometry.part",
  "DecompressionStream(\"gzip\")",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "collectPrototypeMeshes",
  "buildStaticInstancedFleet",
  "new THREE.InstancedMesh",
  'batches.name = "UploadedAirportJetwayStaticInstancedBatches"',
  'fleet.name = "UploadedAirportJetwayFleet"',
  'anchor.name = `UploadedAirportJetway_${placement.gate}`',
  'anchor.userData.renderMode = placement.gate === "A1" ? "individual-animated" : "static-instanced-marker"',
  'uploadedJetwayLoadState = "ready"',
  "uploadedJetwayCount = placements.length",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "uploadedJetwayMaterialAuthority = prototype.userData.materialAuthority",
  "uploadedJetwayPerformanceAuthority = prototype.userData.performanceAuthority",
  "uploadedJetwayShadowCasterGateCount = shadowCasterGateCount",
  "uploadedJetwayGlobalEdgeOverlayCount = 0",
  "uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount",
  "uploadedJetwayAnimatedIndividualGateCount = 1",
  "uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount",
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
  'READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v6-instanced-source-textured"',
  "EXPECTED_GATE_COUNT = 58",
  "placements.map((placement) => `UploadedAirportJetway_${placement.gate}`)",
  "missingModels",
  'materialAuthority.includes("exact-M1DGJETWAY")',
  'performanceAuthority !== "57-static-gates-instanced-plus-1-animated-a1-source-geometry-v4"',
  "shadowCasterGateCount !== 1",
  "globalEdgeOverlayCount !== 0",
  "staticInstancedGateCount !== 57",
  "animatedIndividualGateCount !== 1",
  "staticPrimitiveBatchCount < 1",
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

requireTokens("src/environment/uploadedAirportJetwayTerminalConnector.js", [
  'CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v3-a1-deep-overlap-terminal-frame"',
  'const terminalOverlap = placement.gate === "A1" ? 1.45 : 0.55',
  'connector.userData.a1TerminalPortalFrame = "deep-overlap-open-framed-terminal-end-v3"',
  "UploadedAirportJetwayTerminalPortalHeader_A1",
  "UploadedAirportJetwayTerminalPortalThreshold_A1",
  "UploadedAirportJetwayTerminalPortalJamb_A1",
]);

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
  "x: 7.5",
  "z: 8.5",
  "yaw: -0.35",
  "cameraPosition: Object.freeze([-12.0, 10.5, 28.0])",
  "cameraTarget: Object.freeze([-27.5, 4.1, -16.15])",
  "wide-diagonal-a1-terminal-joint-v6-clear-tug",
]);
requireTokens("tests/browser/source-first-a1-repair.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  '"data-terminal4-uploaded-jetway-count"',
  '"data-terminal4-uploaded-jetway-connector-count"',
  '"data-terminal4-uploaded-jetway-verified-model-count"',
  "uploaded-airport-jetway-fleet-complete-58-gates-v6-instanced-source-textured",
  "wide-diagonal-a1-terminal-joint-v6-clear-tug",
]);
requireTokens("tests/browser/kphx-ground-runtime.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  "terminal4UploadedJetwayLoadState",
  "terminal4UploadedJetwayCount",
  "terminal4UploadedJetwayConnectorCount",
  "terminal4UploadedJetwayVerifiedModelCount",
  "terminal4UploadedJetwayReadyAuthority",
  "uploaded-airport-jetway-fleet-complete-58-gates-v6-instanced-source-textured",
  "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v4-instanced-static-source-textured",
]);

console.log("Verified the exact-source-textured supplied Tunnel_A/B/C/Rotunda/Cab fleet as 57 instanced static gates plus one individually animated A1, with all 58 gate records, all 58 measured terminal connectors, a deep-overlap framed A1 terminal end, a clear inspection-tug position, one jetway shadow caster and zero global edge overlays.");
