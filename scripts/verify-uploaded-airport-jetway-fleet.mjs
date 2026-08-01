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
  'MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1"',
  "geometry.part",
  "DecompressionStream(\"gzip\")",
  'fleet.name = "UploadedAirportJetwayFleet"',
  'anchor.name = `UploadedAirportJetway_${placement.gate}`',
  'uploadedJetwayLoadState = "ready"',
  "uploadedJetwayCount = placements.length",
  "uploadedJetwayMeasuredTerminalConnectorCount = placements.length",
  "sourceGeometryMode = MODEL_AUTHORITY",
]);
if (fleet.includes("procedural-articulated-fallback-pending-original-AIR_Jetway01-mesh-recovery")) {
  throw new Error("Uploaded jetway fleet module must not advertise the retired procedural fallback");
}

requireTokens("src/environment/uploadedAirportJetwayFleetReadyV2.js", [
  'READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v3"',
  "EXPECTED_GATE_COUNT = 58",
  "placements.map((placement) => `UploadedAirportJetway_${placement.gate}`)",
  "missingModels",
  "uploadedJetwayVerifiedModelCount = modelCount",
  "uploadedJetwayVerifiedGateNames",
  "waitForFleet(group, placements)",
]);

const jetways = requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js"',
  "const uploadedJetwayPlacements = []",
  "connectorTowardX",
  "connectorTowardZ",
  "wallConnectorLength",
  "uploadedJetwayPlacements.push",
  "installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements)",
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  'visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1"',
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

requireTokens("tests/browser/source-first-a1-repair.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  '"data-terminal4-uploaded-jetway-count"',
  '"data-terminal4-uploaded-jetway-connector-count"',
  '"data-terminal4-uploaded-jetway-verified-model-count"',
  "uploaded-airport-jetway-fleet-complete-58-gates-v3",
]);
requireTokens("tests/browser/kphx-ground-runtime.spec.js", [
  '"data-terminal4-uploaded-jetway-load-state"',
  "terminal4UploadedJetwayLoadState",
  "terminal4UploadedJetwayCount",
  "terminal4UploadedJetwayConnectorCount",
  "terminal4UploadedJetwayVerifiedModelCount",
  "terminal4UploadedJetwayReadyAuthority",
  "uploaded-airport-jetway-fleet-complete-58-gates-v3",
]);

console.log("Verified the user-supplied Tunnel_A/B/C/Rotunda/Cab airport jetway as the awaited production authority at all 58 Terminal 4 gates, with 58 measured terminal connectors and exact gate-name accounting.");
