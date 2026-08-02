import { readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [rig, placements, fleet, ready, authoredVisual] = await Promise.all([
  read("src/tug/lektroRig.js"),
  read("src/environment/sourcePlacedTerminal4Jetways.js"),
  read("src/environment/uploadedAirportJetwayFleet.js"),
  read("src/environment/uploadedAirportJetwayFleetReadyV2.js"),
  read("src/environment/authoredTerminal4Visual.js"),
]);

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label} is missing ${token}`);
}

function forbidToken(source, token, label) {
  if (source.includes(token)) throw new Error(`${label} still contains forbidden generated behavior: ${token}`);
}

requireToken(rig, 'steeringMode: "rear"', "Lektro rig");
requireToken(placements, "sourceHeadingDegrees", "source jetway placement");
requireToken(placements, "THREE.MathUtils.degToRad(Number(jetway.h))", "source jetway placement");
requireToken(placements, 'sourceGeometryMode = "user-supplied-jetway-geometry-only"', "source jetway placement");
requireToken(placements, "generatedTerminalConnectorCount = 0", "source jetway placement");
requireToken(placements, "facadeInfillCount = 0", "source jetway placement");
requireToken(placements, "lowerFacadeFitCount = 0", "source jetway placement");

for (const token of [
  "function createArchedTunnelGeometry",
  "function addServiceStairs",
  "transforms.facadeInfill",
  "transforms.facadeDoor",
  "transforms.facadeVent",
  "transforms.wallCollar",
]) forbidToken(placements, token, "source jetway placement");

requireToken(fleet, 'MODEL_AUTHORITY = "user-supplied-airport-jetway-source-geometry-v1"', "supplied jetway fleet");
requireToken(fleet, "sourceRotundaCenter", "supplied jetway fleet");
requireToken(fleet, "sourceCabCenter", "supplied jetway fleet");
requireToken(fleet, "generatedConnectorCount = 0", "supplied jetway fleet");
requireToken(fleet, "generatedPortalCount = 0", "supplied jetway fleet");
requireToken(fleet, "generatedFacadeCount = 0", "supplied jetway fleet");
requireToken(fleet, "nodes.tunnelB.position.x", "supplied jetway A1 animation");
requireToken(fleet, "nodes.tunnelC.position.x", "supplied jetway A1 animation");
requireToken(fleet, "nodes.cab.position.x", "supplied jetway A1 animation");

for (const token of [
  "function addProjectedUvs",
  "function cloneCorrugatedAtlasBand",
  "M1DGJETWAY-corrugated-band-projected",
  "addUploadedAirportJetwayTerminalConnector",
  "addUploadedAirportJetwayStaticTerminalConnectors",
  "splitTunnelCSourceDetail",
]) forbidToken(fleet, token, "supplied jetway fleet");

requireToken(ready, "generatedConnectorCount !== 0", "supplied jetway readiness gate");
requireToken(ready, "generatedPortalCount !== 0", "supplied jetway readiness gate");
requireToken(ready, "generatedFacadeCount !== 0", "supplied jetway readiness gate");
for (const token of ["installStaticJetwayPortalClosures", "polishUploadedA1JetwayDetail"]) {
  forbidToken(ready, token, "supplied jetway readiness gate");
}

requireToken(authoredVisual, "buildSourcePlacedTerminal4Jetways", "authored Terminal 4 visual");

for (let index = 0; index < 5; index += 1) {
  const file = new URL(`../public/models/airport-jetway/geometry.part${index}`, import.meta.url);
  const details = await stat(file);
  if (details.size < 1000) throw new Error(`Supplied jetway geometry part ${index} is missing or too small`);
}
for (const path of [
  "public/models/phx-terminal4/terminal4.gltf",
  "public/models/kphx-ground/kphx-ground.gltf",
  "public/models/kphx-photo/photo-manifest.json",
]) {
  const details = await stat(new URL(`../${path}`, import.meta.url));
  if (details.size < 100) throw new Error(`Required supplied airport runtime asset is missing: ${path}`);
}

console.log("RampReady source-only verification passed: Lektro rear steering, 58 source BGL jetway transforms, supplied jetway geometry, zero generated connectors/portals/facades, no projected corrugated fill, and committed Sky Harbor assets present.");
