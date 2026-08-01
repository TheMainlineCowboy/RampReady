import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");
let normalized = false;

const extendedReturn = "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount, sourceClosedBayMaterialCount };";
const alphaReturn = "  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount };";
if (source.includes(extendedReturn)) {
  source = source.replace(extendedReturn, alphaReturn);
  normalized = true;
}

const extendedDestructuring = `    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
    sourceClosedBayMaterialCount,
  } = applySourceMaterials`;
const alphaDestructuring = `    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
  } = applySourceMaterials`;
if (source.includes(extendedDestructuring)) {
  source = source.replace(extendedDestructuring, alphaDestructuring);
  normalized = true;
}

if (normalized) fs.writeFileSync(path, source, "utf8");

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let jetways = fs.readFileSync(jetwayPath, "utf8");
let jetwayNormalized = false;
const upgradeImport = 'import { enhanceTerminal4JetwayVisuals } from "./terminal4JetwayVisualUpgradeV35.js";\n';
const upgradeCall = "  const jetwayVisualUpgrade = enhanceTerminal4JetwayVisuals(THREE, group);\n\n";
const upgradedAuthorityBlock = `  group.userData.visualAuthority = "source-scale articulated fallback with full-terminal structural-detail upgrade while original AIR_Jetway01 mesh is recovered";
  group.userData.jetwayVisualUpgradeAuthority = jetwayVisualUpgrade.authority;
  group.userData.jetwayVisualUpgradeDetailInstanceCount = jetwayVisualUpgrade.detailInstanceCount;
  group.userData.jetwayVisualUpgradeStaticJetwayCount = jetwayVisualUpgrade.staticJetwayCount;`;
const legacyAuthority = '  group.userData.visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered";';

for (const preparedToken of [upgradeImport, upgradeCall]) {
  if (jetways.includes(preparedToken)) {
    jetways = jetways.replace(preparedToken, "");
    jetwayNormalized = true;
  }
}
if (jetways.includes(upgradedAuthorityBlock)) {
  jetways = jetways.replace(upgradedAuthorityBlock, legacyAuthority);
  jetwayNormalized = true;
}
if (jetwayNormalized) fs.writeFileSync(jetwayPath, jetways, "utf8");

for (const forbidden of [
  "enhanceTerminal4JetwayVisuals",
  "jetwayVisualUpgradeDetailInstanceCount",
  "full-terminal structural-detail upgrade",
]) {
  if (jetwayNormalized && jetways.includes(forbidden)) {
    throw new Error(`Terminal 4 jetway normalization left prepared token ${forbidden}`);
  }
}

console.log(normalized || jetwayNormalized
  ? "Normalized prepared Terminal 4 facade accounting and full jetway V35 wiring before legacy idempotence passes; v27-v35 restore the final runtime state."
  : "Terminal 4 source-alpha and jetway inputs already have compatible idempotence shapes.");
