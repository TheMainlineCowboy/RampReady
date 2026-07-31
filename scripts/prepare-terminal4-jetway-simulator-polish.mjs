import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredTerminalPath, "utf8");

const polishImport = 'import { applyTerminal4JetwaySimulatorPolish } from "./terminal4JetwaySimulatorPolishV13.js";';
const fixedWalkwayImport = 'import { installTerminal4FixedWalkwayV20 } from "./terminal4FixedWalkwayV20.js";';
const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
const fixedWalkwayCall = "  installTerminal4FixedWalkwayV20(sourcePlacedJetways);";

if (!source.includes(polishImport)) {
  const importAnchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(importAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway import anchor`);
  source = source.replace(importAnchor, `${importAnchor}\n${polishImport}`);
}
if (!source.includes(fixedWalkwayImport)) {
  if (!source.includes(polishImport)) throw new Error(`${authoredTerminalPath}: missing simulator polish import anchor`);
  source = source.replace(polishImport, `${polishImport}\n${fixedWalkwayImport}`);
}

// Earlier emergency passes added invented A1 facade panels on the wrong side of
// the supplied terminal/corridor geometry. Remove those generated imports and
// calls so the expanded lower-facade exclusion can reveal the original BGATE1
// and PHX_TERM400 source materials instead of stacking procedural architecture.
for (const importLine of [
  'import { installTerminal4A1FacadeDetailV19 } from "./terminal4A1FacadeDetailV19.js";\n',
  'import { installTerminal4A1ExtendedFacadeV22 } from "./terminal4A1ExtendedFacadeV22.js";\n',
  'import { installTerminal4A1RampFaceCorrectionV23 } from "./terminal4A1RampFaceCorrectionV23.js";\n',
]) source = source.replace(importLine, "");
for (const callLine of [
  "  installTerminal4A1FacadeDetailV19(sourcePlacedJetways);\n",
  "  installTerminal4A1ExtendedFacadeV22(sourcePlacedJetways);\n",
  "  installTerminal4A1RampFaceCorrectionV23(sourcePlacedJetways);\n",
]) source = source.replace(callLine, "");

if (!source.includes(polishCall)) {
  const constructionAnchor = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  if (!source.includes(constructionAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway construction anchor`);
  source = source.replace(constructionAnchor, `${constructionAnchor}\n${polishCall}`);
}
if (!source.includes(fixedWalkwayCall)) {
  if (!source.includes(polishCall)) throw new Error(`${authoredTerminalPath}: missing simulator polish call anchor`);
  source = source.replace(polishCall, `${polishCall}\n${fixedWalkwayCall}`);
}

for (const token of [polishImport, fixedWalkwayImport, polishCall, fixedWalkwayCall]) {
  if (!source.includes(token)) throw new Error(`${authoredTerminalPath}: missing Terminal 4 simulator polish token ${token}`);
}
for (const forbidden of [
  "installTerminal4A1FacadeDetailV19",
  "installTerminal4A1ExtendedFacadeV22",
  "installTerminal4A1RampFaceCorrectionV23",
]) {
  if (source.includes(forbidden)) throw new Error(`${authoredTerminalPath}: obsolete procedural A1 facade pass remains: ${forbidden}`);
}

fs.writeFileSync(authoredTerminalPath, source, "utf8");
console.log("Prepared Terminal 4 source-placed jetways with galvanized moving bridges, source-transform glass fixed corridors and grounded supports. A1 now relies on the supplied BGATE1/PHX_TERM400 facade revealed by the complete corridor skin exclusion rather than invented overlay walls.");
