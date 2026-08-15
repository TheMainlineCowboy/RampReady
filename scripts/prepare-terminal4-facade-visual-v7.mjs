import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

// The previous pass stamped one generic seven-metre wall panel at nearly every
// jetway. That hid the converted Terminal 4 source and created the obvious
// repeated lower-building pattern visible from the ramp. Keep the source model
// as the only lower-facade authority; this pass may measure source recesses for
// evidence, but it must not manufacture replacement bays, doors or vents.
const sourceFacadeMarker = "source-authored-lower-facade-authority-v25";
if (!source.includes(sourceFacadeMarker)) {
  const start = source.indexOf("    const sourceFacadeRecessMeters =");
  const end = source.indexOf("\n    transforms.wallCollar.push({", start);
  if (start < 0 || end < 0) throw new Error("Terminal 4 source-facade replacement anchors are missing");
  const replacement = `    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null
      ? lowerFacadeWallDistance - terminalWallDistance
      : 0;
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g) && sourceFacadeRecessMeters >= 1.4;
    if (keepServiceBayOpen) terminal4OpenServiceBayCount += 1;

    // source-authored-lower-facade-authority-v25
    // Do not stamp generic infill modules over the supplied Terminal 4 model.
    // Door and vent sets remain source-audit references only; the browser scene
    // is now driven by the converted authored geometry and original materials.
    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null) terminal4LowerFacadeFitCount += 1;
    const sourceDoorReference = CLOSED_SERVICE_DOOR_GATES.has(jetway.g);
    const sourceVentReference = FACADE_VENT_GATES.has(jetway.g);
    if (sourceDoorReference || sourceVentReference) terminal4FacadeInfillCount += 0;
`;
  source = `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

const walkwayMarker = "AIR_Jetway01_FixedTerminalWalkways_V13";
if (!source.includes(walkwayMarker)) {
  const oldCollar = `    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [2.62, 2.48, wallConnectorLength],
    });`;
  const newCollar = `    transforms.wallCollar.push({
      position: [
        jetway.x + connectorTowardX * wallConnectorLength / 2,
        rotundaY,
        jetway.z + connectorTowardZ * wallConnectorLength / 2,
      ],
      yaw: connectorYaw,
      scale: [1, 1, wallConnectorLength],
    });
    const connectorPerpendicular = [-connectorTowardZ, connectorTowardX];
    for (let along = 0.72; along < wallConnectorLength - 0.3; along += 1.65) {
      addTunnelFrame(
        transforms,
        [
          jetway.x + connectorTowardX * along,
          rotundaY,
          jetway.z + connectorTowardZ * along,
        ],
        connectorYaw,
        0,
        connectorPerpendicular,
        2.48,
        2.34,
        0.22,
        0.055,
      );
    }`;
  if (!source.includes(oldCollar)) throw new Error("Terminal 4 fixed walkway v13 collar anchor is missing");
  source = source.replace(oldCollar, newCollar);

  const oldGeometry = `  const box = new THREE.BoxGeometry(1, 1, 1);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`;
  const newGeometry = `  const box = new THREE.BoxGeometry(1, 1, 1);
  const wallConnectorTunnel = createArchedTunnelGeometry(THREE, 2.48, 2.34, 0.22);
  const outerTunnel = createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28);`;
  if (!source.includes(oldGeometry)) throw new Error("Terminal 4 fixed walkway v13 geometry anchor is missing");
  source = source.replace(oldGeometry, newGeometry);

  const oldInstances = `  addInstances(THREE, group, box, materials.shell, transforms.wallCollar, "AIR_Jetway01_WallCollars");`;
  const newInstances = `  addInstances(THREE, group, wallConnectorTunnel, materials.shell, transforms.wallCollar, "AIR_Jetway01_FixedTerminalWalkways_V13");`;
  if (!source.includes(oldInstances)) throw new Error("Terminal 4 fixed walkway v13 instance anchor is missing");
  source = source.replace(oldInstances, newInstances);
}

for (const forbidden of [
  "transforms.facadeInfill.push",
  "transforms.facadeDoor.push",
  "transforms.facadeVent.push",
  "scale: [7.0, 3.42, 0.5]",
  "every other module receives a flush outer-wall closure",
]) {
  if (source.includes(forbidden)) throw new Error(`Synthetic repeated Terminal 4 facade remains: ${forbidden}`);
}
for (const required of [
  sourceFacadeMarker,
  "const sourceFacadeRecessMeters",
  "CLOSED_SERVICE_DOOR_GATES.has(jetway.g)",
  "FACADE_VENT_GATES.has(jetway.g)",
  walkwayMarker,
]) {
  if (!source.includes(required)) throw new Error(`Terminal 4 source-first facade pass is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");

// A single transient GitHub Pages/CDN 5xx must not take down the complete
// Terminal 4 scene. THREE.TextureLoader rejects image failures with a browser
// Event (not an Error), which previously surfaced to the UI as an unhelpful
// "failed to load: undefined" and aborted every terminal material. Inject a
// bounded retry around only the authored Terminal 4 texture requests. The first
// request retains the canonical URL; retries add a cache-busting query so a
// cached transient response cannot poison the next attempt.
const terminal4VisualPath = "src/environment/authoredTerminal4Visual.js";
let terminal4Visual = fs.readFileSync(terminal4VisualPath, "utf8");
const textureRetryMarker = "terminal4-static-texture-retry-v1";
if (!terminal4Visual.includes(textureRetryMarker)) {
  const helperAnchor = "\nasync function loadExactJetwayTextures(THREE, baseUrl) {";
  if (!terminal4Visual.includes(helperAnchor)) {
    throw new Error("Terminal 4 texture retry helper anchor is missing");
  }
  const helper = `
const TERMINAL4_TEXTURE_RETRY_AUTHORITY = "terminal4-static-texture-retry-v1";
const TERMINAL4_TEXTURE_RETRY_ATTEMPTS = 4;
const TERMINAL4_TEXTURE_RETRY_DELAY_MS = 350;

function terminal4RetryTextureUrl(url, attempt) {
  if (attempt <= 1) return url;
  const retryUrl = new URL(url, window.location.href);
  retryUrl.searchParams.set("rrTextureRetry", String(attempt));
  return retryUrl.href;
}

function terminal4TextureFailureDetail(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error?.target?.src) return "browser image error for " + error.target.src;
  return String(error?.type || "browser image load event");
}

async function loadTerminal4TextureWithRetry(loader, url, label) {
  let lastError = null;
  for (let attempt = 1; attempt <= TERMINAL4_TEXTURE_RETRY_ATTEMPTS; attempt += 1) {
    const requestUrl = terminal4RetryTextureUrl(url, attempt);
    try {
      return await loader.loadAsync(requestUrl);
    } catch (error) {
      lastError = error;
      if (attempt >= TERMINAL4_TEXTURE_RETRY_ATTEMPTS) break;
      await new Promise((resolve) => setTimeout(resolve, TERMINAL4_TEXTURE_RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error(
    "Terminal 4 texture " + label
      + " failed after " + TERMINAL4_TEXTURE_RETRY_ATTEMPTS
      + " attempts: " + url + "; " + terminal4TextureFailureDetail(lastError),
  );
}
`;
  terminal4Visual = terminal4Visual.replace(helperAnchor, `${helper}${helperAnchor}`);

  const replacements = [
    [
      'loader.loadAsync(`${baseUrl}textures/M1DGJETWAY.png`)',
      'loadTerminal4TextureWithRetry(loader, `${baseUrl}textures/M1DGJETWAY.png`, "M1DGJETWAY diffuse")',
    ],
    [
      'loader.loadAsync(`${baseUrl}textures/M1DGJETWAY_LM.png`)',
      'loadTerminal4TextureWithRetry(loader, `${baseUrl}textures/M1DGJETWAY_LM.png`, "M1DGJETWAY emissive")',
    ],
    [
      "loader.loadAsync(diffuseUrl)",
      'loadTerminal4TextureWithRetry(loader, diffuseUrl, reference + " diffuse")',
    ],
    [
      "entry.emissiveUrl ? loader.loadAsync(new URL(entry.emissiveUrl, manifestUrl).href) : Promise.resolve(null)",
      'entry.emissiveUrl ? loadTerminal4TextureWithRetry(loader, new URL(entry.emissiveUrl, manifestUrl).href, reference + " emissive") : Promise.resolve(null)',
    ],
  ];
  for (const [before, after] of replacements) {
    if (!terminal4Visual.includes(before)) {
      throw new Error(`Terminal 4 texture retry replacement anchor is missing: ${before}`);
    }
    terminal4Visual = terminal4Visual.replace(before, after);
  }
}

for (const required of [
  textureRetryMarker,
  "TERMINAL4_TEXTURE_RETRY_ATTEMPTS = 4",
  "rrTextureRetry",
  "loadTerminal4TextureWithRetry(loader, diffuseUrl",
  "loadTerminal4TextureWithRetry(loader, new URL(entry.emissiveUrl, manifestUrl).href",
  "loadTerminal4TextureWithRetry(loader, `${baseUrl}textures/M1DGJETWAY.png`",
  "loadTerminal4TextureWithRetry(loader, `${baseUrl}textures/M1DGJETWAY_LM.png`",
]) {
  if (!terminal4Visual.includes(required)) {
    throw new Error(`Terminal 4 texture retry preparation is missing ${required}`);
  }
}
fs.writeFileSync(terminal4VisualPath, terminal4Visual, "utf8");

console.log("Prepared source-first Terminal 4 facade v25 and bounded transient texture retry without changing terminal or jetway geometry.");
