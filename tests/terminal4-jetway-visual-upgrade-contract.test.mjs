import fs from "node:fs";

const moduleSource = fs.readFileSync("src/environment/terminal4JetwayVisualUpgradeV35.js", "utf8");
const preparation = fs.readFileSync("scripts/prepare-terminal4-jetway-visual-upgrade-v35.mjs", "utf8");
const uvPreparation = fs.readFileSync("scripts/prepare-terminal4-jetway-source-uv-v36.mjs", "utf8");
const continuity = fs.readFileSync("scripts/prepare-terminal4-facade-continuity-v8.mjs", "utf8");

for (const token of [
  "enhanceTerminal4JetwayVisuals",
  "AIR_Jetway01_OuterLowerSkirts_V35",
  "AIR_Jetway01_OuterRoofAndUnderbridgeStructure_V35",
  "AIR_Jetway01_InnerSafetyBands_V35",
  "AIR_Jetway01_CabinFramesAndSkirts_V35",
  "AIR_Jetway01_CabinThresholds_V35",
  "AIR_Jetway01_RotundaStructuralBands_V35",
  "full-terminal4-jetway-structural-detail-and-material-contrast-v35",
  "jetwayVisualUpgradeDetailInstanceCount",
  "jetwayVisualUpgradeMissingSourceMeshDisclosure",
]) {
  if (!moduleSource.includes(token)) throw new Error(`Terminal 4 jetway visual module is missing ${token}`);
}

for (const token of [
  'import { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";',
  "const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);",
  "group.userData.jetwayVisualUpgradeDetailInstanceCount = jetwayVisualUpgrade.detailInstanceCount;",
]) {
  if (!preparation.includes(token)) throw new Error(`Terminal 4 jetway preparation is missing ${token}`);
}

for (const token of [
  "source-length-height-shell-projection-v36",
  "const longitudinalShell = nz < 0.72",
  "clamp(z + 0.5, 0, 1)",
  "M1DGJETWAY's recovered shell strip",
]) {
  if (!uvPreparation.includes(token)) throw new Error(`Terminal 4 exact jetway UV preparation is missing ${token}`);
}

for (const token of [
  'await import("./prepare-terminal4-jetway-source-uv-v36.mjs")',
  'await import("./prepare-terminal4-jetway-visual-upgrade-v35.mjs")',
]) {
  if (!continuity.includes(token)) throw new Error(`Terminal 4 runtime preparation is missing ${token}`);
}

for (const forbidden of [
  "usesTerminalBuildingTextures = true",
  "requiresOriginalSourceMesh = false",
  "CanvasTexture",
]) {
  if (moduleSource.includes(forbidden) || preparation.includes(forbidden) || uvPreparation.includes(forbidden)) {
    throw new Error(`Terminal 4 jetway visual upgrade contains forbidden source claim: ${forbidden}`);
  }
}

console.log("Terminal 4 full jetway visual and exact source-atlas UV projection contracts verified.");
