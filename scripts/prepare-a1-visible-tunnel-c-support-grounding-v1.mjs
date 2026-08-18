import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v6-transformed-gate-anchor";
const authority = "exact-supplied-tunnel-c-visible-support-components-grounded-v9-transformed-gate-anchor-plane";
const stairMarker = "a1-service-stair-live-rendered-crj-clearance-v4";
const importLine = 'import { groundA1TunnelCVisibleSupportHardwareV2 } from "../environment/a1TunnelCVisibleSupportGroundingV2.js";';
const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(stairMarker)) throw new Error(`${trainerPath}: visible Tunnel-C support grounding must run after the live exact service-stair solve`);
source = source.replace('import { groundA1TunnelCVisibleSupportHardware } from "../environment/a1TunnelCVisibleSupportGroundingV1.js";\n', "");

for (const oldMarker of [
  "a1-visible-tunnel-c-support-grounding-runtime-v2",
  "a1-visible-tunnel-c-support-grounding-runtime-v3",
  "a1-visible-tunnel-c-support-grounding-runtime-v4",
  "a1-visible-tunnel-c-support-grounding-runtime-v5-kphx-pavement",
]) {
  if (!source.includes(oldMarker) || source.includes(marker)) continue;
  const start = source.indexOf(`          // ${oldMarker}`);
  const end = source.indexOf(browserTruthAnchor, start);
  if (start < 0 || end < 0) throw new Error(`${trainerPath}: cannot replace stale visible-support ${oldMarker} block`);
  source = source.slice(0, start) + source.slice(end);
}

if (!source.includes(marker)) {
  const aircraftImport = 'import { buildCRJ700Aircraft } from "./aircraft/crj700Model.js";';
  if (!source.includes(importLine)) {
    if (!source.includes(aircraftImport)) throw new Error(`${trainerPath}: aircraft import anchor is missing`);
    source = source.replace(aircraftImport, `${aircraftImport}\n${importLine}`);
  }
  if (!source.includes(browserTruthAnchor)) throw new Error(`${trainerPath}: final browser-truth anchor is missing for visible support grounding`);

  const runtimeBlock = `          // ${marker}\n          // Seat the complete exact-source Tunnel-C support set on the transformed\n          // A1 gate-placement anchor plane. This follows every final parent/world\n          // offset while remaining independent of all Tunnel-C mesh minima.\n          const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV2(\n            THREE, finalA1Model,\n          );\n          if (\n            finalA1VisibleSupportGrounding.authority !== "${authority}"\n            || finalA1VisibleSupportGrounding.rampReferenceAuthority !== "transformed-uploaded-a1-gate-anchor-local-y0"\n            || finalA1VisibleSupportGrounding.groundedComponentCount !== 5\n            || finalA1VisibleSupportGrounding.visibleLoadLegCount !== 5\n            || finalA1VisibleSupportGrounding.groundedTriangleCount !== 1311\n            || finalA1VisibleSupportGrounding.remainingSuspendedSupportCount !== 0\n            || !Number.isFinite(finalA1VisibleSupportGrounding.rampWorldY)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumExtensionMeters)\n            || !(finalA1VisibleSupportGrounding.maximumExtensionMeters <= 4.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters)\n            || !(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015)\n          ) {\n            throw new Error(\`A1 visible Tunnel-C support grounding failed: \${JSON.stringify(finalA1VisibleSupportGrounding)}\`);\n          }\n          exactA1Fleet.updateWorldMatrix(true, true);\n          finalA1Model.updateWorldMatrix(true, true);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundingAuthority = finalA1VisibleSupportGrounding.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceAuthority = finalA1VisibleSupportGrounding.rampReferenceAuthority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedComponentCount = String(finalA1VisibleSupportGrounding.groundedComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedTriangleCount = String(finalA1VisibleSupportGrounding.groundedTriangleCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportDetailedPodCount = String(finalA1VisibleSupportGrounding.detailedPodCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportLoadLegCount = String(finalA1VisibleSupportGrounding.visibleLoadLegCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRemainingSuspendedCount = String(finalA1VisibleSupportGrounding.remainingSuspendedSupportCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportBeforeClearanceMeters = finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportExtensionMeters = finalA1VisibleSupportGrounding.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters = finalA1VisibleSupportGrounding.maximumFinalClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters = finalA1VisibleSupportGrounding.maximumTopMountDriftMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampWorldY = finalA1VisibleSupportGrounding.rampWorldY.toFixed(6);\n\n`;
  source = source.replace(browserTruthAnchor, `${runtimeBlock}${browserTruthAnchor}`);
}

for (const required of [marker, importLine, authority, "transformed-uploaded-a1-gate-anchor-local-y0", "groundedComponentCount !== 5", "groundedTriangleCount !== 1311", "maximumFinalClearanceMeters <= 0.015", "maximumTopMountDriftMeters <= 0.015"]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: visible Tunnel-C support grounding is missing ${required}`);
}
for (const forbidden of [
  'exact-supplied-tunnel-c-visible-support-components-grounded-v5-carrier-floor-reference-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v6-kphx-world-ramp-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v7-complete-set-carrier-ramp-reference',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v8-kphx-pavement-plane',
  'Math.abs(finalA1VisibleSupportGrounding.rampWorldY)',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale visible-support pavement authority survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: all five visible Tunnel-C support islands use the transformed A1 gate-placement anchor plane as pavement authority.`);
