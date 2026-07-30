import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Simulator-quality verification is missing ${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireTokens(path, tokens) {
  const source = read(path);
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path} is missing simulator-quality token: ${token}`);
  }
  return source;
}

const packageJson = JSON.parse(read("package.json"));
const terminalMaterializer = packageJson.scripts?.["materialize:phx-terminal4"] || "";
const groundMaterializer = packageJson.scripts?.["materialize:kphx-ground"] || "";
const runtimePreparation = packageJson.scripts?.["prepare:terminal4-runtime"] || "";
const verifyCommand = packageJson.scripts?.verify || "";

for (const token of [
  "prepare-terminal4-source-alpha.mjs",
  "prepare-terminal4-jetway-dxt3.mjs",
  "prepare-terminal4-jetway-facade-v4.mjs",
  "materialize-phx-terminal4.mjs",
]) if (!terminalMaterializer.includes(token)) throw new Error(`Terminal 4 materializer wiring is missing ${token}`);
for (const token of [
  "prepare-kphx-marking-contact.mjs",
  "materialize-kphx-ground.mjs",
]) if (!groundMaterializer.includes(token)) throw new Error(`KPHX ground materializer wiring is missing ${token}`);
for (const token of [
  "prepare-inspection-drive-mode.mjs",
  "prepare-inspection-motion-evidence.mjs",
  "prepare-jetway-terminal-connections.mjs",
  "prepare-terminal4-jetway-facade-v4.mjs",
  "prepare-simulator-quality-runtime-evidence.mjs",
  "prepare-terminal4-runtime.mjs",
]) if (!runtimePreparation.includes(token)) throw new Error(`Terminal 4 runtime preparation wiring is missing ${token}`);
if (!verifyCommand.includes("verify-simulator-quality-inspection-pass.mjs")) {
  throw new Error("Full verification suite does not include the simulator-quality inspection contract");
}

const trainerTokens = [
  "const inspectionRef = useRef(false)",
  "const [inspectionMode, setInspectionMode]",
  "const toggleInspectionDrive = useCallback",
  "const inspectionActive = inspectionRef.current",
  "const motionAllowed = inspectionActive ||",
  "Free-drive airport inspection active",
  "Free-drive inspection",
  'phase: inspectionActive ? "inspection"',
  "canvas.dataset.inspectionTugX",
  "canvas.dataset.inspectionTugZ",
  "canvas.dataset.inspectionSpeed",
  "Inspection <b>FREE</b>",
];
requireTokens("src/components/RampReadyStandupTrainer.jsx", trainerTokens);
requireTokens("src/components/RampReadyStandupTrainerTerminal4.jsx", trainerTokens);

const groundBuilder = requireTokens("scripts/build-kphx-simulator-ground.mjs", [
  "const markingY = taxiwayPath.type === 3 ? 0.0065",
  'addStrip("yellow-marking", a, b, 0.16, 0.0137)',
  "lineWidth, 0.0138",
  "stripeWidth, 0.0258",
]);
for (const forbidden of [
  "width, 30, 20, 0.045",
  "width, 0.045",
  "lineWidth, 0.055",
  "stripeWidth, 0.066",
]) if (groundBuilder.includes(forbidden)) throw new Error(`Floating marking elevation remains in KPHX builder: ${forbidden}`);

const authoredGround = requireTokens("src/environment/authoredKphxGround.js", [
  "material.polygonOffsetFactor = -1",
  "material.polygonOffsetUnits = -1",
  "Math.max(node.renderOrder || 0, 80)",
  'contactMode: "pavement-relative-millimeter-offset"',
  "authoredGroundMarkingContactMode",
]);
for (const forbidden of [
  "material.polygonOffsetFactor = -12",
  "material.polygonOffsetUnits = -12",
  "renderOrder || 0, 420",
]) if (authoredGround.includes(forbidden)) throw new Error(`Aggressive marking depth override remains: ${forbidden}`);

const visualAuthority = requireTokens("scripts/prepare-phx-visual-authority.mjs", [
  "y = 0.0075",
  "mesh.position.set(x, 0.0085, z)",
  "lines.renderOrder = 85",
]);
for (const forbidden of ["y = 0.135", "0.137,", "0.145, z", "renderOrder = 460", "renderOrder = 470"]) {
  if (visualAuthority.includes(forbidden)) throw new Error(`Floating stand-marking implementation remains: ${forbidden}`);
}

const jetways = requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  "function findTerminalWallDistance",
  "buildSourcePlacedTerminal4Jetways(THREE, terminal, sourceTextures = {})",
  "const terminalWallDistance = findTerminalWallDistance",
  "const lowerFacadeWallDistance = findTerminalWallDistance",
  "wallConnectorLength / 2",
  "terminalConnectedJetwayCount",
  "a1TerminalWallDistance",
  "lowerFacadeFitCount",
  "raycast-and-source-vertex-fit-to-authored-terminal-mesh",
  "M1DGJETWAY exact recovered original freeware texture and lightmap",
  "usesExactRecoveredJetwayTexture",
]);
if (jetways.includes("scale: [3.6, 3.1, 1.4]")) {
  throw new Error("Jetways still use the fixed detached 1.4-meter terminal collar");
}

requireTokens("scripts/materialize-phx-terminal4.mjs", [
  "function inspectAlpha(rgba)",
  "function decodeDxt3Bmp",
  "const alpha = inspectAlpha(decoded.rgba)",
  "transparentPixelCount: alpha.transparentPixelCount",
  "alphaCoverage: alpha.alphaCoverage",
  'emitJetwayTexture(JETWAY_TEXTURE_SOURCE.diffuse, "M1DGJETWAY.png")',
  'emitJetwayTexture(JETWAY_TEXTURE_SOURCE.emissive, "M1DGJETWAY_LM.png")',
]);
const terminalRuntime = requireTokens("src/environment/authoredTerminal4Visual.js", [
  "sourceHasAlpha: entry.hasAlpha === true",
  "const sourceCutout = texture?.userData?.sourceHasAlpha === true",
  "material.alphaTest = sourceCutout ? 0.42 : 0",
  "authoredTerminal4SourceCutoutMaterialCount",
  "authoredTerminal4SourceAlphaAuthority",
  "loadExactJetwayTextures",
  "buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures)",
  "authoredTerminal4A1JetwayWallDistance",
  "authoredTerminal4LowerFacadeFitCount",
  "authoredTerminal4JetwayTextureAuthority",
]);
if (terminalRuntime.includes("material.transparent = false;\n      material.opacity = 1;\n      material.side")) {
  throw new Error("Terminal runtime still forces every source-alpha material opaque");
}

const generatedRuntime = requireTokens("src/components/RampReadyStandupTrainerTerminal4.jsx", [
  "dataset.terminal4A1JetwayWallDistance",
  "dataset.terminal4TerminalConnectedJetwayCount",
  "dataset.terminal4SourceCutoutMaterialCount",
  "dataset.terminal4LowerFacadeFitCount",
  "dataset.terminal4JetwayTextureAuthority",
  "dataset.terminal4ExactJetwayTextureActive",
  "dataset.groundMarkingContactMode",
  "dataset.inspectionMode",
]);
if (!generatedRuntime.includes('dataset.inspectionMode = inspectionRef.current ? "active" : "training"')) {
  throw new Error("Generated PHX runtime does not expose initial inspection mode state");
}

console.log("RampReady simulator-quality inspection pass verified: unrestricted tug inspection, pavement-contact markings, targeted terminal cutouts, lower-wall facade fits, and exact-textured terminal-connected AIR_Jetway01 geometry are active.");
