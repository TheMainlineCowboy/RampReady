import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");
const oldVariant = '    "DGATE4.BMP",';
const safeVariant = '    "DGATE1.BMP",';
const marker = "source-package-facade-safe-variant-set-v34";

if (!source.includes("function splitRepeatedBGATE1Facade")) {
  throw new Error("Terminal 4 facade cell splitter must be prepared before variant safety selection");
}
if (!source.includes(marker)) {
  if (!source.includes(oldVariant)) throw new Error("Terminal 4 facade sequence no longer contains the unsuitable DGATE4 variant anchor");
  source = source.replace(oldVariant, safeVariant);
  source = source.replace(
    'const splitterMarker = "source-package-facade-cell-variation-v31";',
    'const splitterMarker = "source-package-facade-cell-variation-v31";\nconst sourceFacadeSafeVariantAuthority = "source-package-facade-safe-variant-set-v34";',
  );
  source = source.replace(
    "    variantMaterialCount: uniqueReferences.length,",
    "    variantMaterialCount: uniqueReferences.length,\n    safeVariantAuthority: sourceFacadeSafeVariantAuthority,",
  );
  source = source.replace(
    "  environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount = sourceFacadeVariation.variantMaterialCount;",
    "  environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount = sourceFacadeVariation.variantMaterialCount;\n  environment.userData.authoredTerminal4SourceFacadeSafeVariantAuthority = sourceFacadeVariation.safeVariantAuthority;",
  );
}

for (const token of [
  safeVariant,
  marker,
  "authoredTerminal4SourceFacadeSafeVariantAuthority",
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 safe facade variant preparation missing ${token}`);
}
if (source.includes(oldVariant)) throw new Error("The unsuitable DGATE4 facade variant remains active");

fs.writeFileSync(path, source, "utf8");
console.log("Prepared Terminal 4 facade v34 with BGATE3, DGATE3, framed DGATE1 and occasional original BGATE1 service bays; the dark DGATE4 upper-block variant is excluded.");
