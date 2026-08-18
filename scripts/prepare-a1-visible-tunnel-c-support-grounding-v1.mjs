import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v1";
const authority = "exact-supplied-tunnel-c-visible-support-components-grounded-v2";
const stairMarker = "a1-service-stair-live-rendered-crj-clearance-v4";
const importLine = 'import { groundA1TunnelCVisibleSupportHardware } from "../environment/a1TunnelCVisibleSupportGroundingV1.js";';

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(stairMarker)) {
  throw new Error(`${trainerPath}: visible Tunnel-C support grounding must run after the live exact service-stair solve`);
}

if (!source.includes(marker)) {
  const aircraftImport = 'import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";';
  if (!source.includes(importLine)) {
    if (!source.includes(aircraftImport)) throw new Error(`${trainerPath}: aircraft import anchor is missing`);
    source = source.replace(aircraftImport, `${aircraftImport}\n${importLine}`);
  }

  const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;
  if (!source.includes(browserTruthAnchor)) {
    throw new Error(`${trainerPath}: final browser-truth anchor is missing for visible support grounding`);
  }
  const runtimeBlock = `          // ${marker}\n          // The prior carrier-only bogie metric could report zero while visible\n          // mechanical support legs remained suspended. Ground the actual final\n          // source components that are load-bearing in the aircraft-side Tunnel-C\n          // silhouette while preserving every upper mount and the passenger shell.\n          const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardware(\n            THREE, finalA1Model,\n          );\n          if (\n            finalA1VisibleSupportGrounding.authority !== "${authority}"\n            || !(finalA1VisibleSupportGrounding.groundedComponentCount >= 2)\n            || !(finalA1VisibleSupportGrounding.groundedComponentCount <= 10)\n            || !(finalA1VisibleSupportGrounding.groundedTriangleCount >= 100)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters <= 3.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumExtensionMeters)\n            || !(finalA1VisibleSupportGrounding.maximumExtensionMeters <= 3.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters)\n            || !(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015)\n          ) {\n            throw new Error(\`A1 visible Tunnel-C support grounding failed: \${JSON.stringify(finalA1VisibleSupportGrounding)}\`);\n          }\n          exactA1Fleet.updateWorldMatrix(true, true);\n          finalA1Model.updateWorldMatrix(true, true);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundingAuthority = finalA1VisibleSupportGrounding.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedComponentCount = String(finalA1VisibleSupportGrounding.groundedComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedTriangleCount = String(finalA1VisibleSupportGrounding.groundedTriangleCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportDetailedPodCount = String(finalA1VisibleSupportGrounding.detailedPodCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportLoadLegCount = String(finalA1VisibleSupportGrounding.visibleLoadLegCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportBeforeClearanceMeters = finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportExtensionMeters = finalA1VisibleSupportGrounding.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters = finalA1VisibleSupportGrounding.maximumFinalClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters = finalA1VisibleSupportGrounding.maximumTopMountDriftMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampWorldY = finalA1VisibleSupportGrounding.rampWorldY.toFixed(6);\n\n`;
  source = source.replace(browserTruthAnchor, `${runtimeBlock}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  authority,
  "groundA1TunnelCVisibleSupportHardware",
  "finalA1VisibleSupportGrounding.groundedComponentCount >= 2",
  "finalA1VisibleSupportGrounding.groundedComponentCount <= 10",
  "finalA1VisibleSupportGrounding.maximumExtensionMeters <= 3.0",
  "finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015",
  "finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015",
  "terminal4UploadedJetwayA1VisibleSupportGroundingAuthority",
  "terminal4UploadedJetwayA1VisibleSupportLoadLegCount",
  "terminal4UploadedJetwayA1VisibleSupportExtensionMeters",
  "terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters",
  "terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: visible Tunnel-C support grounding is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: final A1 browser geometry now grounds the full visible exact-source Tunnel-C load-bearing support set after live service-stair clearance, preserving upper mounts and the passenger shell.`);
