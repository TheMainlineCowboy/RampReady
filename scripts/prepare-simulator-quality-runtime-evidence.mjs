import fs from "node:fs";

const groundPath = "src/environment/authoredKphxGround.js";
let ground = fs.readFileSync(groundPath, "utf8");
if (!ground.includes('contactMode: "pavement-relative-millimeter-offset"')) {
  const oldText = `    markingAuthority: "source-authored-kphx-adex",
    visibilityMode: "high-contrast-nearfield",`;
  const newText = `    markingAuthority: "source-authored-kphx-adex",
    visibilityMode: "high-contrast-nearfield",
    contactMode: "pavement-relative-millimeter-offset",`;
  if (!ground.includes(oldText)) throw new Error("KPHX marking contact evidence anchor is missing");
  ground = ground.replace(oldText, newText);
}
if (!ground.includes("authoredGroundMarkingContactMode")) {
  const oldText = `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundSurfaceMaterialMode`;
  const newText = `  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundMarkingContactMode = "pavement-relative-millimeter-offset";
  environment.userData.authoredGroundSurfaceMaterialMode`;
  if (!ground.includes(oldText)) throw new Error("KPHX environment marking evidence anchor is missing");
  ground = ground.replace(oldText, newText);
}
fs.writeFileSync(groundPath, ground, "utf8");

const generatorPath = "scripts/prepare-terminal4-runtime.mjs";
let generator = fs.readFileSync(generatorPath, "utf8");
if (!generator.includes('dataset.terminal4A1JetwayWallDistance = "loading"')) {
  const oldText = `    renderer.domElement.dataset.terminal4Placement = "loading";
    const terminalLoad`;
  const newText = `    renderer.domElement.dataset.terminal4Placement = "loading";
    renderer.domElement.dataset.terminal4A1JetwayWallDistance = "loading";
    renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = "loading";
    renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "loading";
    renderer.domElement.dataset.groundMarkingContactMode = "loading";
    const terminalLoad`;
  if (!generator.includes(oldText)) throw new Error("Terminal runtime evidence initialization anchor is missing");
  generator = generator.replace(oldText, newText);
}
if (!generator.includes("environment.userData.authoredTerminal4A1JetwayWallDistance")) {
  const oldText = `        renderer.domElement.dataset.terminal4Placement = environment.userData.authoredTerminal4Placement;
        return terminal;`;
  const newText = `        renderer.domElement.dataset.terminal4Placement = environment.userData.authoredTerminal4Placement;
        renderer.domElement.dataset.terminal4A1JetwayWallDistance = Number.isFinite(environment.userData.authoredTerminal4A1JetwayWallDistance)
          ? environment.userData.authoredTerminal4A1JetwayWallDistance.toFixed(3)
          : "missing";
        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = String(environment.userData.authoredTerminal4TerminalConnectedJetwayCount ?? 0);
        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = String(environment.userData.authoredTerminal4SourceCutoutMaterialCount ?? 0);
        return terminal;`;
  if (!generator.includes(oldText)) throw new Error("Terminal runtime success evidence anchor is missing");
  generator = generator.replace(oldText, newText);
}
if (!generator.includes('dataset.terminal4A1JetwayWallDistance = "load-error"')) {
  const oldText = `        renderer.domElement.dataset.terminal4Placement = "load-error";
        console.error("RampReady PHX Terminal 4 visual load failed", error);`;
  const newText = `        renderer.domElement.dataset.terminal4Placement = "load-error";
        renderer.domElement.dataset.terminal4A1JetwayWallDistance = "load-error";
        renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount = "load-error";
        renderer.domElement.dataset.terminal4SourceCutoutMaterialCount = "load-error";
        console.error("RampReady PHX Terminal 4 visual load failed", error);`;
  if (!generator.includes(oldText)) throw new Error("Terminal runtime failure evidence anchor is missing");
  generator = generator.replace(oldText, newText);
}
if (!generator.includes("environment.userData.authoredGroundMarkingContactMode")) {
  const oldText = `        renderer.domElement.dataset.b15CorridorMeters = environment.userData.trainingCorridor?.distanceMeters?.map((value) => Math.round(value)).join(",") || "missing";
        return ground;`;
  const newText = `        renderer.domElement.dataset.b15CorridorMeters = environment.userData.trainingCorridor?.distanceMeters?.map((value) => Math.round(value)).join(",") || "missing";
        renderer.domElement.dataset.groundMarkingContactMode = environment.userData.authoredGroundMarkingContactMode || "missing";
        return ground;`;
  if (!generator.includes(oldText)) throw new Error("Ground marking runtime evidence anchor is missing");
  generator = generator.replace(oldText, newText);
}
if (!generator.includes('dataset.groundMarkingContactMode = "load-error"')) {
  const oldText = `        renderer.domElement.dataset.b15CorridorMeters = "load-error";
        console.error("RampReady KPHX ground load failed", error);`;
  const newText = `        renderer.domElement.dataset.b15CorridorMeters = "load-error";
        renderer.domElement.dataset.groundMarkingContactMode = "load-error";
        console.error("RampReady KPHX ground load failed", error);`;
  if (!generator.includes(oldText)) throw new Error("Ground marking failure evidence anchor is missing");
  generator = generator.replace(oldText, newText);
}
fs.writeFileSync(generatorPath, generator, "utf8");

for (const [path, tokens] of Object.entries({
  [groundPath]: [
    'contactMode: "pavement-relative-millimeter-offset"',
    "authoredGroundMarkingContactMode",
  ],
  [generatorPath]: [
    'dataset.terminal4A1JetwayWallDistance = "loading"',
    "authoredTerminal4A1JetwayWallDistance",
    "authoredTerminal4TerminalConnectedJetwayCount",
    "authoredTerminal4SourceCutoutMaterialCount",
    "authoredGroundMarkingContactMode",
  ],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: simulator-quality runtime evidence is missing ${token}`);
}

console.log("Prepared live simulator-quality evidence for inspection mode, marking contact, source alpha and terminal-connected jetways.");
