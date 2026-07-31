import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const terminalPath = "src/environment/authoredTerminal4Visual.js";

const jetways = fs.readFileSync(jetwayPath, "utf8");
const independentRotundaBaseline = [
  "function findTerminalWallConnection",
  "const terminalConnection = findTerminalWallConnection",
  "const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ)",
  "a1TerminalConnectionAuthority",
  "independent-rotunda-collar-fit-to-authored-terminal-wall",
].every((token) => jetways.includes(token));
const independentStructuralFit = [
  "function findTerminalWallConnection",
  "const terminalConnection = findTerminalWallConnection",
  "const connectorYaw = Math.atan2(connectorTowardX, connectorTowardZ)",
  "a1TerminalConnectionAuthority",
  "const cast = (direction, far = 48)",
  "return /BGATE|DGATE|PHX_TERM400/i.test",
  "materials.some((material) => /BGATE|DGATE|PHX_TERM400/i.test",
  "independent-structural-rotunda-collar-fit-to-authored-terminal-wall-v12",
].every((token) => jetways.includes(token));
const legacyMeasuredFit = [
  "function findTerminalWallDistance",
  "const terminalWallDistance = findTerminalWallDistance",
  "wallConnectorLength / 2",
  "terminalConnectionAuthority",
].every((token) => jetways.includes(token));

if (!jetways.includes("buildSourcePlacedTerminal4Jetways(THREE, terminal")) {
  throw new Error("Terminal-aware jetway builder signature is missing");
}
if (!independentRotundaBaseline && !independentStructuralFit && !legacyMeasuredFit) {
  throw new Error("Terminal 4 jetways do not contain a measured terminal-wall connection implementation");
}

let terminal = fs.readFileSync(terminalPath, "utf8");
const terminalAwareCallPresent = terminal.includes("buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures)")
  || terminal.includes("buildSourcePlacedTerminal4Jetways(THREE, authored)");
if (!terminalAwareCallPresent) {
  const legacyCalls = [
    "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, textures, emissiveTextures);",
    "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE);",
  ];
  const legacyCall = legacyCalls.find((candidate) => terminal.includes(candidate));
  if (!legacyCall) throw new Error("Authored Terminal 4 jetway-builder call anchor is missing");
  terminal = terminal.replace(
    legacyCall,
    "  authored.updateMatrixWorld(true);\n  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored);",
  );
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

const preparedTerminal = fs.readFileSync(terminalPath, "utf8");
for (const token of [
  "buildSourcePlacedTerminal4Jetways(THREE, authored",
  "authoredTerminal4A1JetwayWallDistance",
  "authoredTerminal4TerminalConnectedJetwayCount",
]) {
  if (!preparedTerminal.includes(token)) {
    throw new Error(`${terminalPath}: terminal-connected jetway preparation is missing ${token}`);
  }
}

const connectorMode = independentStructuralFit
  ? "prepared structural v12 radial"
  : independentRotundaBaseline
    ? "committed radial"
    : "legacy measured";
console.log(`Validated ${connectorMode} rotunda-to-authored-wall jetway connectors and explicit A1 connection evidence.`);
