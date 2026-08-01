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
console.log(normalized
  ? "Normalized the prepared Terminal 4 facade accounting before the legacy source-alpha idempotence pass; v27 will restore closed-bay accounting during runtime preparation."
  : "Terminal 4 source-alpha input already has a compatible accounting shape.");
