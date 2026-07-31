import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredTerminalPath, "utf8");

const polishImport = 'import { applyTerminal4JetwaySimulatorPolish } from "./terminal4JetwaySimulatorPolishV13.js";';
const a1FacadeImport = 'import { installTerminal4A1FacadeDetailV19 } from "./terminal4A1FacadeDetailV19.js";';
const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
const a1FacadeCall = "  installTerminal4A1FacadeDetailV19(sourcePlacedJetways);";

if (!source.includes(polishImport)) {
  const importAnchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(importAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway import anchor`);
  source = source.replace(importAnchor, `${importAnchor}\n${polishImport}`);
}
if (!source.includes(a1FacadeImport)) {
  if (!source.includes(polishImport)) throw new Error(`${authoredTerminalPath}: missing simulator polish import anchor`);
  source = source.replace(polishImport, `${polishImport}\n${a1FacadeImport}`);
}

if (!source.includes(polishCall)) {
  const constructionAnchor = "  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);";
  if (!source.includes(constructionAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway construction anchor`);
  source = source.replace(constructionAnchor, `${constructionAnchor}\n${polishCall}`);
}
if (!source.includes(a1FacadeCall)) {
  if (!source.includes(polishCall)) throw new Error(`${authoredTerminalPath}: missing simulator polish call anchor`);
  source = source.replace(polishCall, `${polishCall}\n${a1FacadeCall}`);
}

for (const token of [polishImport, a1FacadeImport, polishCall, a1FacadeCall]) {
  if (!source.includes(token)) throw new Error(`${authoredTerminalPath}: missing Terminal 4 simulator polish token ${token}`);
}

fs.writeFileSync(authoredTerminalPath, source, "utf8");
console.log("Prepared Terminal 4 source-placed jetways with soft galvanized materials, reduced repetitive frame shadows and an exact-wall A1 ramp facade with doors, vents, portal framing, lighting and gate identification.");
