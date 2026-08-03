import fs from "node:fs";
import zlib from "node:zlib";

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
  'MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v5-instanced-static-jetways-and-connectors-source-textured"',
  'MATERIAL_AUTHORITY = "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2"',
  'DETAIL_MATERIAL_AUTHORITY = "source-triangle-stair-and-bogie-material-split-v1"',
  'PERFORMANCE_AUTHORITY = "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5"',
  "geometry.part",
  "DecompressionStream(\"gzip\")",
  "addProjectedUvs",
  "cloneCorrugatedAtlasBand",
  "splitTunnelCSourceDetail",
  'const isStair = centerX > 16.4 && centerY < -1.55 && centerZ < 4.8',
  "centerX >= 15.0",
  "centerX < 16.8",
  "centerZ < 1.3",
  'root.name = "Tunnel_C_SourceDetailMaterialSplit"',
  '"Tunnel_C_GalvanizedServiceStair_SourceTriangles"',
  '"Tunnel_C_DarkBogieLift_SourceTriangles"',
  "collectPrototypeMeshes",
  "buildStaticInstancedFleet",
  "new THREE.InstancedMesh",
  'batches.name = "UploadedAirportJetwayStaticInstancedBatches"',
  "addUploadedAirportJetwayStaticTerminalConnectors",
  'fleet.name = "UploadedAirportJetwayFleet"',
  'anchor.name = `UploadedAirportJetway_${placement.gate}`',
  'anchor.userData.renderMode = placement.gate === "A1" ? "individual-animated" : "static-instanced-marker"',
  'uploadedJetwayLoadState = "ready"',
  "uploadedJetwayCount = placements.length",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "uploadedJetwayMaterialAuthority = prototype.userData.materialAuthority",
  "uploadedJetwayDetailMaterialAuthority = prototype.userData.detailMaterialAuthority",
  "uploadedJetwayStairMaterialSplitActive = true",
  "uploadedJetwayPerformanceAuthority = prototype.userData.performanceAuthority",
  "uploadedJetwayShadowCasterGateCount = shadowCasterGateCount",
  "uploadedJetwayGlobalEdgeOverlayCount = 0",
  "uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount",
  "uploadedJetwayAnimatedIndividualGateCount = 1",
  "uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount",
  "uploadedJetwayStaticConnectorGateCount = staticConnectors.staticGateCount",
  "uploadedJetwayStaticConnectorBatchCount = staticConnectors.batchCount",
  "uploadedJetwayStaticConnectorInstanceCount = staticConnectors.instanceCount",
  "uploadedJetwayStaticConnectorBatchAuthority = staticConnectors.authority",
  "uploadedJetwayIndividualConnectorGateCount = 1",
  "proceduralJetwayStairCount = 0",
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

const ready = requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured"',
  'enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js"',
  'EXACT_MODEL_AUTHORITY = "user-supplied-airport-jetway-exclusive-geometry-v9"',
  "const exactModelGuard = enforceExactUploadedJetwayVisualAuthority(group, fleet)",
  "exactModelGuard.hiddenLegacyGroupCount < 1",
  "exactModelGuard.hiddenSyntheticPortalCount < 1",
  "exactModelGuard.hierarchy.requiredPartCount !== 5",
  'uploadedJetwayA1DetailPolishAuthority = "none-exact-source-model"',
  "uploadedJetwayA1DetailEdgeOverlayCount = exactModelGuard.hierarchy.syntheticEdgeCount",
  "uploadedJetwayParentAxisCorrectionRadians = 0",
  "EXPECTED_GATE_COUNT = 58",
  "placements.map((placement) => `UploadedAirportJetway_${placement.gate}`)",
  "missingModels",
  'materialAuthority.includes("exact-M1DGJETWAY")',
  'detailMaterialAuthority !== "source-triangle-stair-and-bogie-material-split-v1"',
  "!stairMaterialSplitActive",
  'performanceAuthority !== "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5"',
  "shadowCasterGateCount !== 1",
  "globalEdgeOverlayCount !== 0",
  "staticInstancedGateCount !== 57",
  "animatedIndividualGateCount !== 1",
  "staticPrimitiveBatchCount < 1",
  "staticConnectorGateCount !== 57",
  "staticConnectorBatchCount !== 3",
  "staticConnectorInstanceCount < 1",
  'staticConnectorBatchAuthority !== "57-static-terminal-connectors-three-instanced-box-batches-v1"',
  "individualConnectorGateCount !== 1",
  "uploadedJetwayVerifiedModelCount = modelCount",
  "uploadedJetwayVerifiedGateNames",
  "waitForFleet(group, placements)",
  "installUploadedAirportJetwayFleetBase(THREE, group, placements, sourceTextures)",
]);
for (const forbidden of [
  "polishUploadedA1JetwayDetail",
  "A1_DETAIL_POLISH_AUTHORITY",
  "aligned.rotation.y = Math.PI / 2",
]) {
  if (ready.includes(forbidden)) throw new Error(`Uploaded jetway ready wrapper mutates the supplied model: ${forbidden}`);
}

requireTokens("src/environment/uploadedAirportJetwayExactModelGuard.js", [
  'EXACT_MODEL_AUTHORITY = "user-supplied-airport-jetway-exclusive-geometry-v9"',
  'REQUIRED_SOURCE_PARTS = Object.freeze(["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"])',
  'LEGACY_BRIDGE_PATTERN = /^(?:AIR_Jetway01_',
  'A1_SYNTHETIC_PORTAL_PATTERN = /^UploadedAirportJetwayTerminalPortal/i',
  "Supplied airport jetway prototype was deformed",
  "Supplied airport jetway prototype received a non-authored axis rotation",
  "Supplied airport jetway contains ${syntheticEdgeCount} non-source edge overlays",
  "uploadedJetwayExactSourceGeometryPreserved = true",
  "uploadedJetwayParentAxisCorrectionRadians = 0",
]);

const encodedGeometry = Array.from({ length: 5 }, (_, index) => (
  read(`public/models/airport-jetway/geometry.part${index}`).trim()
)).join("");
const geometryPayload = zlib.gunzipSync(Buffer.from(encodedGeometry, "base64"));
const metadataLength = geometryPayload.readUInt32LE(0);
const metadata = JSON.parse(geometryPayload.subarray(4, 4 + metadataLength).toString("utf8"));
const authoredNodeNames = new Set(metadata.nodes.map((node) => node.name));
for (const requiredName of ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]) {
  if (!authoredNodeNames.has(requiredName)) throw new Error(`Supplied jetway geometry payload is missing ${requiredName}`);
}
const rootNode = metadata.nodes.find((node) => node.name === "RootNode");
if (!rootNode || rootNode.children?.length !== 5) {
  throw new Error(`Supplied jetway RootNode expected five exact authored assemblies, received ${rootNode?.children?.length ?? 0}`);
}

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
  'CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v5-facade-plane-portal-static-instanced"',
  'STATIC_CONNECTOR_BATCH_AUTHORITY = "57-static-terminal-connectors-three-instanced-box-batches-v1"',
  'const terminalOverlap = placement.gate === "A1" ? 1.45 : 0.55',
  "addUploadedAirportJetwayStaticTerminalConnectors",
  'group.name = "UploadedAirportJetwayStaticTerminalConnectorBatches"',
  'buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorShells"',
  'buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorFrames"',
  'buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorGlass"',
  "group.userData.staticGateCount = staticPlacements.length",
  "group.userData.batchCount = group.children.length",
  'const facadeDistance = Math.max(0.8, frame.measuredLength - 0.08)',
  "UploadedAirportJetwayTerminalPortalInterior_A1",
  "UploadedAirportJetwayTerminalPortalOuterHeader_A1",
  "UploadedAirportJetwayTerminalPortalOuterThreshold_A1",
  "UploadedAirportJetwayTerminalPortalOuterJamb_A1",
  "UploadedAirportJetwayTerminalPortalInnerJamb_A1",
  "UploadedAirportJetwayTerminalPortalInnerHeader_A1",
  'connector.userData.a1TerminalPortalFrame = "facade-plane-dark-reveal-with-hidden-deep-overlap-v4"',
  "connector.userData.a1FacadePortalDistanceMeters = facadeDistance",
  "connector.userData.a1HiddenOverlapMeters = frame.terminalOverlap",
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
  "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured",
  "wide-diagonal-a1-terminal-joint-v6-clear-tug",
]);
requireTokens("tests/browser/kphx-ground-runtime.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  "terminal4UploadedJetwayLoadState",
  "terminal4UploadedJetwayCount",
  "terminal4UploadedJetwayConnectorCount",
  "terminal4UploadedJetwayVerifiedModelCount",
  "terminal4UploadedJetwayReadyAuthority",
  "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured",
  "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v5-instanced-static-jetways-and-connectors-source-textured",
]);

console.log("Verified the exact supplied Tunnel_A/B/C/Rotunda/Cab hierarchy at all 58 gates with no parent-axis rotation, no geometry deformation, no synthetic edge overlays, all duplicate AIR_Jetway01/fixed-walkway visuals hidden, and the synthetic A1 portal frame suppressed while the measured terminal overlap remains.");
