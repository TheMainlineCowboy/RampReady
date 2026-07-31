import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredTerminalPath, "utf8");

const polishImport = 'import { applyTerminal4JetwaySimulatorPolish } from "./terminal4JetwaySimulatorPolishV13.js";';
const fixedWalkwayImport = 'import { installTerminal4FixedWalkwayV20 } from "./terminal4FixedWalkwayV20.js";';
const a1FacadeImport = 'import { installTerminal4A1FacadeDetailV19 } from "./terminal4A1FacadeDetailV19.js";';
const a1ExtendedFacadeImport = 'import { installTerminal4A1ExtendedFacadeV22 } from "./terminal4A1ExtendedFacadeV22.js";';
const a1RampFaceCorrectionImport = 'import { installTerminal4A1RampFaceCorrectionV23 } from "./terminal4A1RampFaceCorrectionV23.js";';
const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
const fixedWalkwayCall = "  installTerminal4FixedWalkwayV20(sourcePlacedJetways);";
const a1FacadeCall = "  installTerminal4A1FacadeDetailV19(sourcePlacedJetways);";
const a1ExtendedFacadeCall = "  installTerminal4A1ExtendedFacadeV22(sourcePlacedJetways);";
const a1RampFaceCorrectionCall = "  installTerminal4A1RampFaceCorrectionV23(sourcePlacedJetways);";

if (!source.includes(polishImport)) {
  const importAnchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(importAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway import anchor`);
  source = source.replace(importAnchor, `${importAnchor}\n${polishImport}`);
}
if (!source.includes(fixedWalkwayImport)) {
  if (!source.includes(polishImport)) throw new Error(`${authoredTerminalPath}: missing simulator polish import anchor`);
  source = source.replace(polishImport, `${polishImport}\n${fixedWalkwayImport}`);
}
if (!source.includes(a1FacadeImport)) {
  const importAnchor = source.includes(fixedWalkwayImport) ? fixedWalkwayImport : polishImport;
  if (!source.includes(importAnchor)) throw new Error(`${authoredTerminalPath}: missing walkway import anchor`);
  source = source.replace(importAnchor, `${importAnchor}\n${a1FacadeImport}`);
}
if (!source.includes(a1ExtendedFacadeImport)) {
  if (!source.includes(a1FacadeImport)) throw new Error(`${authoredTerminalPath}: missing compact A1 facade import anchor`);
  source = source.replace(a1FacadeImport, `${a1FacadeImport}\n${a1ExtendedFacadeImport}`);
}
if (!source.includes(a1RampFaceCorrectionImport)) {
  if (!source.includes(a1ExtendedFacadeImport)) throw new Error(`${authoredTerminalPath}: missing extended A1 facade import anchor`);
  source = source.replace(a1ExtendedFacadeImport, `${a1ExtendedFacadeImport}\n${a1RampFaceCorrectionImport}`);
}

if (!source.includes(polishCall)) {
  const constructionAnchor = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  if (!source.includes(constructionAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway construction anchor`);
  source = source.replace(constructionAnchor, `${constructionAnchor}\n${polishCall}`);
}
if (!source.includes(fixedWalkwayCall)) {
  if (!source.includes(polishCall)) throw new Error(`${authoredTerminalPath}: missing simulator polish call anchor`);
  source = source.replace(polishCall, `${polishCall}\n${fixedWalkwayCall}`);
}
if (!source.includes(a1FacadeCall)) {
  const callAnchor = source.includes(fixedWalkwayCall) ? fixedWalkwayCall : polishCall;
  if (!source.includes(callAnchor)) throw new Error(`${authoredTerminalPath}: missing walkway call anchor`);
  source = source.replace(callAnchor, `${callAnchor}\n${a1FacadeCall}`);
}
if (!source.includes(a1ExtendedFacadeCall)) {
  if (!source.includes(a1FacadeCall)) throw new Error(`${authoredTerminalPath}: missing compact A1 facade call anchor`);
  source = source.replace(a1FacadeCall, `${a1FacadeCall}\n${a1ExtendedFacadeCall}`);
}
if (!source.includes(a1RampFaceCorrectionCall)) {
  if (!source.includes(a1ExtendedFacadeCall)) throw new Error(`${authoredTerminalPath}: missing extended A1 facade call anchor`);
  source = source.replace(a1ExtendedFacadeCall, `${a1ExtendedFacadeCall}\n${a1RampFaceCorrectionCall}`);
}

for (const token of [
  polishImport,
  fixedWalkwayImport,
  a1FacadeImport,
  a1ExtendedFacadeImport,
  a1RampFaceCorrectionImport,
  polishCall,
  fixedWalkwayCall,
  a1FacadeCall,
  a1ExtendedFacadeCall,
  a1RampFaceCorrectionCall,
]) {
  if (!source.includes(token)) throw new Error(`${authoredTerminalPath}: missing Terminal 4 simulator polish token ${token}`);
}

fs.writeFileSync(authoredTerminalPath, source, "utf8");
console.log("Prepared Terminal 4 source-placed jetways with galvanized moving bridges, source-transform glass fixed corridors, grounded supports, and compact plus extended A1 facade detail mirrored across the exact BGATE1 wall plane onto the true ramp-facing side.");
