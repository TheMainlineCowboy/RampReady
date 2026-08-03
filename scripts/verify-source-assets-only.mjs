import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const read = (path, encoding = "utf8") => readFile(new URL(`../${path}`, import.meta.url), encoding);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const [rig, placements, fleet, ready, authoredVisual, exactA1, packageMaterializer, groundMaterializer, jetwayMaterializer, buildScript, manifestText] = await Promise.all([
  read("src/tug/lektroRig.js"),
  read("src/environment/sourcePlacedTerminal4Jetways.js"),
  read("src/environment/uploadedAirportJetwayFleet.js"),
  read("src/environment/uploadedAirportJetwayFleetReadyV2.js"),
  read("src/environment/authoredTerminal4Visual.js"),
  read("src/environment/kphxExactA1/index.js"),
  read("scripts/materialize-terminal4-package-first.mjs"),
  read("scripts/materialize-kphx-ground.mjs"),
  read("scripts/materialize-uploaded-airport-jetway-glb.mjs"),
  read("scripts/build-source-only.mjs"),
  read("public/models/airport-jetway/source-manifest.json"),
]);
const manifest = JSON.parse(manifestText);

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label} is missing ${token}`);
}

function forbidToken(source, token, label) {
  if (source.includes(token)) throw new Error(`${label} still contains forbidden generated behavior: ${token}`);
}

requireToken(rig, 'steeringMode: "rear"', "Lektro rig");
requireToken(placements, "sourceHeadingDegrees", "source jetway placement");
requireToken(placements, "Math.PI - THREE.MathUtils.degToRad", "source jetway heading conversion");
requireToken(placements, 'headingConversion: "three-yaw-radians = PI - source-heading-radians"', "source jetway heading conversion");
requireToken(placements, 'sourcePlacementOffsetAuthority = "no-manual-post-decode-shift"', "source jetway placement");
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

requireToken(fleet, 'MODEL_AUTHORITY = "user-supplied-airport-jetway-complete-glb-v2"', "supplied jetway fleet");
requireToken(fleet, 'MATERIAL_AUTHORITY = "supplied-embedded-webp-materials-source-uvs-and-tangents"', "supplied jetway fleet");
requireToken(fleet, 'SOURCE_FILE = "Airport_Jetway.source-web.glb"', "supplied jetway fleet");
requireToken(fleet, "sourceRotundaCenter", "supplied jetway fleet");
requireToken(fleet, "sourceCabCenter", "supplied jetway fleet");
requireToken(fleet, "generatedConnectorCount = 0", "supplied jetway fleet");
requireToken(fleet, "generatedPortalCount = 0", "supplied jetway fleet");
requireToken(fleet, "generatedFacadeCount = 0", "supplied jetway fleet");
requireToken(fleet, "entry.geometry?.getAttribute(\"uv\")", "supplied jetway UV verification");
requireToken(fleet, "entry.geometry?.getAttribute(\"tangent\")", "supplied jetway tangent verification");
requireToken(fleet, "material.map || material.normalMap", "supplied jetway texture verification");
requireToken(fleet, "nodes.tunnelB.position.z", "supplied jetway A1 animation");
requireToken(fleet, "nodes.tunnelC.position.z", "supplied jetway A1 animation");
requireToken(fleet, "nodes.cab.position.z", "supplied jetway A1 animation");
requireToken(fleet, 'A1_RETRACTION_AUTHORITY = "supplied-tunnel-node-native-z-axis-retraction"', "supplied jetway A1 animation");
forbidToken(fleet, "nodes.tunnelB.position.x", "supplied jetway A1 animation");
forbidToken(fleet, "nodes.tunnelC.position.x", "supplied jetway A1 animation");
forbidToken(fleet, "nodes.cab.position.x", "supplied jetway A1 animation");
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
requireToken(exactA1, "paintedLineBaseHeightMeters: 0.004", "exact A1 markings");
requireToken(exactA1, 'contactMode = "pavement-coincident-decals"', "exact A1 markings");
forbidToken(exactA1, "const y = 0.091", "exact A1 markings");
requireToken(packageMaterializer, 'SOURCE_REPOSITORY = "SkyHarborPhx"', "supplied Terminal 4 materializer");
requireToken(packageMaterializer, 'SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe"', "supplied Terminal 4 materializer");
requireToken(packageMaterializer, '"scenery/term4.BGL"', "supplied Terminal 4 materializer");
requireToken(packageMaterializer, '"scenery/KPHX_ADEX.BGL"', "supplied Terminal 4 materializer");
requireToken(groundMaterializer, "KPHX_ADEX.BGL", "supplied airport ground materializer");
requireToken(groundMaterializer, "markingSegments", "supplied airport ground materializer");
requireToken(jetwayMaterializer, "manifest.compressedFile", "complete jetway materializer");
requireToken(jetwayMaterializer, '["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"]', "complete jetway attribute gate");
requireToken(buildScript, 'scripts/materialize-uploaded-airport-jetway-glb.mjs', "production build");

const compressed = await read(`public/models/airport-jetway/${manifest.compressedFile}`, null);
if (compressed.length !== manifest.xzBytes) throw new Error(`Complete supplied jetway archive size mismatch: ${compressed.length} != ${manifest.xzBytes}`);
if (sha256(compressed) !== manifest.xzSha256) throw new Error("Complete supplied jetway archive SHA-256 mismatch");
if (manifest.webGlbBytes < 2_000_000) throw new Error("Complete supplied jetway GLB is unexpectedly small");
if (!Array.isArray(manifest.nodes) || manifest.nodes.join("|") !== "Tunnel_A|Tunnel_B|Tunnel_C|Rotunda|Cab") {
  throw new Error("Complete supplied jetway hierarchy manifest is wrong");
}

console.log("RampReady source-only verification passed: exact complete supplied jetway archive pinned by SHA-256, source UVs/tangents/seven maps required, 58 unshifted BGL transforms, zero generated connectors/portals/facades, Lektro rear steering, and pavement-coincident markings.");
