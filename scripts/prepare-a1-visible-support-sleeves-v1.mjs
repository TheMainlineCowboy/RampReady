import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-support-lower-sleeves-runtime-v2";
const staleImport = 'import { addA1VisibleSupportSleevesToPavement } from "../environment/a1VisibleSupportSleevesV1.js";';
const importLine = 'import { addA1VisibleSupportSleevesToPavementV2 } from "../environment/a1VisibleSupportSleevesV2.js";';
const aircraftImport = 'import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";';
const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;

let source = fs.readFileSync(trainerPath, "utf8");
source = source.replace(`${staleImport}\n`, "").replace(`\n${staleImport}`, "");
if (!source.includes(importLine)) {
  if (!source.includes(aircraftImport)) throw new Error(`${trainerPath}: aircraft import anchor is missing for support sleeves V2`);
  source = source.replace(aircraftImport, `${aircraftImport}\n${importLine}`);
}

const oldMarker = "a1-visible-support-lower-sleeves-runtime-v1";
if (source.includes(oldMarker) && !source.includes(marker)) {
  const start = source.indexOf(`          // ${oldMarker}`);
  const end = source.indexOf(browserTruthAnchor, start);
  if (start < 0 || end < 0) throw new Error(`${trainerPath}: cannot remove stale support sleeve V1 runtime block`);
  source = source.slice(0, start) + source.slice(end);
}

if (!source.includes(marker)) {
  if (!source.includes(browserTruthAnchor)) throw new Error(`${trainerPath}: browser-truth anchor is missing for support sleeves V2`);
  const block = `          // ${marker}\n          // Preserve every supplied Airport_Jetway.glb vertex. Resolve every\n          // actually-visible suspended narrow Tunnel-B/C member from the final\n          // attached pose, then extend separate sleeves slightly through the\n          // rendered pavement so perspective/depth cannot leave a visible air gap.\n          const finalA1SupportSleeves = addA1VisibleSupportSleevesToPavementV2(THREE, finalA1Model);\n          if (\n            finalA1SupportSleeves.authority !== "a1-live-visible-support-lower-sleeves-to-rendered-pavement-v2"\n            || !Number.isInteger(finalA1SupportSleeves.sleeveCount)\n            || finalA1SupportSleeves.sleeveCount < 4\n            || finalA1SupportSleeves.sleeveCount !== finalA1SupportSleeves.evidence?.length\n            || finalA1SupportSleeves.sourceGeometryMutated !== false\n            || !Number.isFinite(finalA1SupportSleeves.maximumExtensionMeters)\n            || !(finalA1SupportSleeves.maximumExtensionMeters <= 4.0)\n            || !Number.isFinite(finalA1SupportSleeves.maximumFinalClearanceMeters)\n            || !(finalA1SupportSleeves.maximumFinalClearanceMeters <= 0.015)\n          ) throw new Error(\`A1 V2 visible support sleeve acceptance failed: \${JSON.stringify(finalA1SupportSleeves)}\`);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveAuthority = finalA1SupportSleeves.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveCount = String(finalA1SupportSleeves.sleeveCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveMaximumExtensionMeters = finalA1SupportSleeves.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveMaximumFinalClearanceMeters = finalA1SupportSleeves.maximumFinalClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1SupportSleeveEvidence = JSON.stringify(finalA1SupportSleeves.evidence);\n\n`;
  source = source.replace(browserTruthAnchor, `${block}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  "addA1VisibleSupportSleevesToPavementV2(THREE, finalA1Model)",
  "terminal4UploadedJetwayA1SupportSleeveEvidence",
  "a1-live-visible-support-lower-sleeves-to-rendered-pavement-v2",
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: support sleeve V2 runtime is missing ${required}`);
}
if (source.includes(staleImport) || source.includes("addA1VisibleSupportSleevesToPavement(THREE, finalA1Model)")) {
  throw new Error(`${trainerPath}: stale support sleeve V1 runtime survived V2 installation`);
}
fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: all distinct live suspended A1 support lower ends receive separate pavement-buried sleeves; supplied GLB geometry remains byte-for-byte untouched.`);
