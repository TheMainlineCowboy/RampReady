import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-support-lower-sleeves-runtime-v1";
const importLine = 'import { addA1VisibleSupportSleevesToPavement } from "../environment/a1VisibleSupportSleevesV1.js";';
const aircraftImport = 'import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";';
const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(importLine)) {
  if (!source.includes(aircraftImport)) throw new Error(`${trainerPath}: aircraft import anchor is missing for support sleeves`);
  source = source.replace(aircraftImport, `${aircraftImport}\n${importLine}`);
}

if (!source.includes(marker)) {
  if (!source.includes(browserTruthAnchor)) throw new Error(`${trainerPath}: browser-truth anchor is missing for support sleeves`);
  const block = `          // ${marker}\n          // Preserve every supplied Airport_Jetway.glb vertex. The four narrow\n          // visible lower support members receive separate telescoping lower sleeves\n          // from their exact rendered lower ends to the actual KPHX pavement.\n          const finalA1SupportSleeves = addA1VisibleSupportSleevesToPavement(THREE, finalA1Model);\n          if (\n            finalA1SupportSleeves.authority !== "a1-exact-visible-support-lower-sleeves-to-rendered-pavement-v1"\n            || finalA1SupportSleeves.sleeveCount !== 4\n            || finalA1SupportSleeves.sourceGeometryMutated !== false\n            || !Number.isFinite(finalA1SupportSleeves.maximumExtensionMeters)\n            || !(finalA1SupportSleeves.maximumExtensionMeters <= 4.0)\n            || !Number.isFinite(finalA1SupportSleeves.maximumFinalClearanceMeters)\n            || !(finalA1SupportSleeves.maximumFinalClearanceMeters <= 0.015)\n          ) throw new Error(\`A1 non-destructive visible support sleeve acceptance failed: \${JSON.stringify(finalA1SupportSleeves)}\`);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveAuthority = finalA1SupportSleeves.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveCount = String(finalA1SupportSleeves.sleeveCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveMaximumExtensionMeters = finalA1SupportSleeves.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveMaximumFinalClearanceMeters = finalA1SupportSleeves.maximumFinalClearanceMeters.toFixed(6);\n\n`;
  source = source.replace(browserTruthAnchor, `${block}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  "addA1VisibleSupportSleevesToPavement(THREE, finalA1Model)",
  "terminal4UploadedJetwayA1SupportSleeveCount",
  "a1-exact-visible-support-lower-sleeves-to-rendered-pavement-v1",
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: support sleeve runtime is missing ${required}`);
}
fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: four exact visible A1 support lower ends receive separate pavement-reaching sleeves; supplied GLB geometry remains byte-for-byte untouched.`);
