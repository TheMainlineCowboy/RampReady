import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");

function replaceJetway(oldText, newText, marker, label) {
  if (jetways.includes(marker)) return;
  if (!jetways.includes(oldText)) throw new Error(`Jetway terminal-connection anchor is missing for ${label}`);
  jetways = jetways.replace(oldText, newText);
}

replaceJetway(
  'const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));',
  `const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function findTerminalWallDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {
  if (!terminal?.isObject3D) return null;
  terminal.updateMatrixWorld(true);
  const direction = new THREE.Vector3(towardX, 0, towardZ).normalize();
  const origin = new THREE.Vector3(originX, height, originZ);
  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 24);
  const hit = raycaster.intersectObject(terminal, true).find((entry) => entry.object?.visible !== false);
  if (hit?.distance > 0.05) return hit.distance;

  // Some legacy terminal pieces are single-sided or contain no ray-facing triangle.
  // Fall back to the nearest source vertex inside a narrow rearward corridor.
  let nearest = Number.POSITIVE_INFINITY;
  const vertex = new THREE.Vector3();
  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      node.localToWorld(vertex);
      if (Math.abs(vertex.y - height) > 4.8) continue;
      const dx = vertex.x - originX;
      const dz = vertex.z - originZ;
      const longitudinal = dx * towardX + dz * towardZ;
      if (!(longitudinal > 0.05 && longitudinal <= 24)) continue;
      const lateral = Math.abs(dx * -towardZ + dz * towardX);
      if (lateral <= 4.5) nearest = Math.min(nearest, longitudinal);
    }
  });
  return Number.isFinite(nearest) ? nearest : null;
}`,
  "function findTerminalWallDistance",
  "terminal wall measurement helper",
);

replaceJetway(
  "export function buildSourcePlacedTerminal4Jetways(THREE) {",
  "export function buildSourcePlacedTerminal4Jetways(THREE, terminal) {",
  "buildSourcePlacedTerminal4Jetways(THREE, terminal)",
  "terminal-aware jetway builder signature",
);

replaceJetway(
  `  let highDetailCount = 0;

  for (const jetway of jetways) {`,
  `  let highDetailCount = 0;
  let terminalConnectedCount = 0;
  let a1TerminalWallDistance = null;

  for (const jetway of jetways) {`,
  "let terminalConnectedCount = 0",
  "terminal connection counters",
);

replaceJetway(
  `    transforms.wallCollar.push({
      position: [jetway.x - ux * 1.7, rotundaY, jetway.z - uz * 1.7],
      yaw,
      scale: [3.6, 3.1, 1.4],
    });`,
  `    const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2];
    const terminalWallDistance = findTerminalWallDistance(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );
    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 18);
    if (terminalWallDistance != null) terminalConnectedCount += 1;
    if (jetway.g === "A1") a1TerminalWallDistance = terminalWallDistance;
    transforms.wallCollar.push({
      position: [
        jetway.x - ux * wallConnectorLength / 2,
        rotundaY,
        jetway.z - uz * wallConnectorLength / 2,
      ],
      yaw,
      scale: [3.6, 3.1, wallConnectorLength],
    });`,
  "const terminalWallDistance = findTerminalWallDistance",
  "measured terminal-side wall connector",
);

replaceJetway(
  `  group.userData.highDetailJetwayCount = highDetailCount;
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;`,
  `  group.userData.highDetailJetwayCount = highDetailCount;
  group.userData.terminalConnectedJetwayCount = terminalConnectedCount;
  group.userData.a1TerminalWallDistance = a1TerminalWallDistance;
  group.userData.terminalConnectionAuthority = "raycast-and-source-vertex-fit-to-authored-terminal-mesh";
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;`,
  "terminalConnectionAuthority",
  "jetway terminal connection evidence",
);

fs.writeFileSync(jetwayPath, jetways, "utf8");

const terminalPath = "src/environment/authoredTerminal4Visual.js";
let terminal = fs.readFileSync(terminalPath, "utf8");
if (!terminal.includes("buildSourcePlacedTerminal4Jetways(THREE, authored)")) {
  const oldText = `  const {
    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
  } = applySourceMaterials(THREE, authored, textures, emissiveTextures);
  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, textures, emissiveTextures);`;
  const newText = `  const {
    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
  } = applySourceMaterials(THREE, authored, textures, emissiveTextures);
  authored.updateMatrixWorld(true);
  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored);`;
  if (!terminal.includes(oldText)) throw new Error("Authored Terminal 4 jetway-builder call anchor is missing");
  terminal = terminal.replace(oldText, newText);
}
if (!terminal.includes("authoredTerminal4A1JetwayWallDistance")) {
  const oldText = `  environment.userData.authoredTerminal4JetwayVisualCount = sourcePlacedJetways.userData.jetwayCount;
  environment.userData.authoredTerminal4JetwayDetailLevel = sourcePlacedJetways.userData.detailLevel;`;
  const newText = `  environment.userData.authoredTerminal4JetwayVisualCount = sourcePlacedJetways.userData.jetwayCount;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = sourcePlacedJetways.userData.terminalConnectedJetwayCount;
  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;
  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;
  environment.userData.authoredTerminal4JetwayDetailLevel = sourcePlacedJetways.userData.detailLevel;`;
  if (!terminal.includes(oldText)) throw new Error("Authored Terminal 4 jetway evidence anchor is missing");
  terminal = terminal.replace(oldText, newText);
}
fs.writeFileSync(terminalPath, terminal, "utf8");

for (const [path, tokens] of Object.entries({
  [jetwayPath]: [
    "function findTerminalWallDistance",
    "buildSourcePlacedTerminal4Jetways(THREE, terminal)",
    "const terminalWallDistance = findTerminalWallDistance",
    "wallConnectorLength / 2",
    "terminalConnectionAuthority",
  ],
  [terminalPath]: [
    "buildSourcePlacedTerminal4Jetways(THREE, authored)",
    "authoredTerminal4A1JetwayWallDistance",
    "authoredTerminal4TerminalConnectedJetwayCount",
  ],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: terminal-connected jetway preparation is missing ${token}`);
}

console.log("Prepared Terminal 4 jetways with measured terminal-wall connectors and explicit A1 connection evidence.");
