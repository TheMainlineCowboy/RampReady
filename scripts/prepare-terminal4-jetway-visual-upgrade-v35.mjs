import fs from "node:fs";

function replaceRequired(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`Missing ${label} anchor`);
  return source.replace(oldText, newText);
}

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

source = replaceRequired(
  source,
  'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";',
  'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";\nimport { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";',
  'import { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";',
  "Terminal 4 jetway upgrade import",
);

source = replaceRequired(
  source,
  '  addInstances(THREE, group, cable, materials.warning, transforms.cableSegments, "AIR_Jetway01_UnderbridgeServiceCable");\n\n  group.userData.sourceArchive',
  '  addInstances(THREE, group, cable, materials.warning, transforms.cableSegments, "AIR_Jetway01_UnderbridgeServiceCable");\n\n  const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);\n\n  group.userData.sourceArchive',
  "const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);",
  "Terminal 4 jetway upgrade call",
);

source = replaceRequired(
  source,
  '  group.userData.visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered";',
  '  group.userData.visualAuthority = "source-scale articulated fallback with full-terminal structural-detail upgrade while original AIR_Jetway01 mesh is recovered";\n  group.userData.jetwayVisualUpgradeAuthority = jetwayVisualUpgrade.authority;\n  group.userData.jetwayVisualUpgradeDetailInstanceCount = jetwayVisualUpgrade.detailInstanceCount;\n  group.userData.jetwayVisualUpgradeStaticJetwayCount = jetwayVisualUpgrade.staticJetwayCount;',
  "group.userData.jetwayVisualUpgradeStaticJetwayCount = jetwayVisualUpgrade.staticJetwayCount;",
  "Terminal 4 jetway upgrade evidence",
);

for (const token of [
  'import { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";',
  "const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);",
  "group.userData.jetwayVisualUpgradeDetailInstanceCount = jetwayVisualUpgrade.detailInstanceCount;",
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 jetway upgrade preparation missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared all Terminal 4 jetways with exact-texture-preserving structural detail, cabin framing, safety bands, underbridge trusses and grounded material contrast v35.");
