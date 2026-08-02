import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(authoredTerminalPath, "utf8");

const polishImport = 'import { applyTerminal4JetwaySimulatorPolish } from "./terminal4JetwaySimulatorPolishV13.js";';
const fixedWalkwayImport = 'import { installTerminal4FixedWalkwayV20 } from "./terminal4FixedWalkwayV20.js";';
const sourceSkinImport = 'import { installTerminal4FixedWalkwaySourceSkinV38 } from "./terminal4FixedWalkwaySourceSkinV38.js";';
const supportImport = 'import { installTerminal4FixedWalkwaySupportV44 } from "./terminal4FixedWalkwaySupportV44.js";';
const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";
const fixedWalkwayCall = "  installTerminal4FixedWalkwayV20(sourcePlacedJetways);";
const sourceSkinCall = "  installTerminal4FixedWalkwaySourceSkinV38(sourcePlacedJetways, authored);";
const supportCall = "  installTerminal4FixedWalkwaySupportV44(sourcePlacedJetways);";
const daylightAuthority = "exact-source-lightmaps-balanced-for-daylight-v39";

if (!source.includes(polishImport)) {
  const importAnchor = 'import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";';
  if (!source.includes(importAnchor)) throw new Error(`${authoredTerminalPath}: missing source-placed jetway import anchor`);
  source = source.replace(importAnchor, `${importAnchor}\n${polishImport}`);
}
if (!source.includes(fixedWalkwayImport)) {
  if (!source.includes(polishImport)) throw new Error(`${authoredTerminalPath}: missing simulator polish import anchor`);
  source = source.replace(polishImport, `${polishImport}\n${fixedWalkwayImport}`);
}
if (!source.includes(sourceSkinImport)) {
  if (!source.includes(fixedWalkwayImport)) throw new Error(`${authoredTerminalPath}: missing fixed-walkway import anchor`);
  source = source.replace(fixedWalkwayImport, `${fixedWalkwayImport}\n${sourceSkinImport}`);
}
if (!source.includes(supportImport)) {
  if (!source.includes(sourceSkinImport)) throw new Error(`${authoredTerminalPath}: missing fixed-walkway source-skin import anchor`);
  source = source.replace(sourceSkinImport, `${sourceSkinImport}\n${supportImport}`);
}

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

if (!source.includes(daylightAuthority)) {
  const lightmapAnchor = "      material.emissiveIntensity = emissiveMap ? 0.68 : 0;";
  const lightmapReplacement = `      // ${daylightAuthority}: retain the exact package lightmap while preventing
      // nighttime illumination from bleaching the photographed daytime facade.
      material.emissiveIntensity = emissiveMap ? 0.07 : 0;
      material.dithering = true;`;
  if (!source.includes(lightmapAnchor)) throw new Error(`${authoredTerminalPath}: missing source lightmap intensity anchor`);
  source = source.replace(lightmapAnchor, lightmapReplacement);
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
if (!source.includes(sourceSkinCall)) {
  if (!source.includes(fixedWalkwayCall)) throw new Error(`${authoredTerminalPath}: missing fixed-walkway call anchor`);
  source = source.replace(fixedWalkwayCall, `${fixedWalkwayCall}\n${sourceSkinCall}`);
}
if (!source.includes(supportCall)) {
  if (!source.includes(sourceSkinCall)) throw new Error(`${authoredTerminalPath}: missing fixed-walkway source-skin call anchor`);
  source = source.replace(sourceSkinCall, `${sourceSkinCall}\n${supportCall}`);
}

for (const token of [
  polishImport,
  fixedWalkwayImport,
  sourceSkinImport,
  supportImport,
  polishCall,
  fixedWalkwayCall,
  sourceSkinCall,
  supportCall,
  daylightAuthority,
  "material.emissiveIntensity = emissiveMap ? 0.07 : 0",
  "material.dithering = true",
]) {
  if (!source.includes(token)) throw new Error(`${authoredTerminalPath}: missing Terminal 4 simulator polish token ${token}`);
}
for (const forbidden of [
  "installTerminal4A1FacadeDetailV19",
  "installTerminal4A1ExtendedFacadeV22",
  "installTerminal4A1RampFaceCorrectionV23",
  "material.emissiveIntensity = emissiveMap ? 0.68 : 0",
]) {
  if (source.includes(forbidden)) throw new Error(`${authoredTerminalPath}: obsolete Terminal 4 visual treatment remains: ${forbidden}`);
}

fs.writeFileSync(authoredTerminalPath, source, "utf8");
console.log("Prepared Terminal 4 with exact T4_WALK/T4_WALK2 fixed-corridor skins, source-transform structural supports, grounded jetway structure and daylight-balanced exact source lightmaps. No terminal or gate geometry was moved.");
