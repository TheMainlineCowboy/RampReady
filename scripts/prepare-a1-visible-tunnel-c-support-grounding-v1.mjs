import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v9-rendered-suspended-set";
const authority = "exact-supplied-tunnel-c-visible-support-components-grounded-v12-rendered-pavement-suspended-set";
const stairMarker = "a1-service-stair-live-rendered-crj-clearance-v4";
const importLine = 'import { groundA1TunnelCVisibleSupportHardwareV2 } from "../environment/a1TunnelCVisibleSupportGroundingV2.js";';
const browserTruthAnchor = `          // Browser-time visual truth. Several older readiness layers still`;
const EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT = 5;
const EXPECTED_VISIBLE_SUPPORT_TRIANGLE_COUNT = 1311;

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(stairMarker)) throw new Error(`${trainerPath}: visible Tunnel-C support grounding must run after the live exact service-stair solve`);
source = source.replace('import { groundA1TunnelCVisibleSupportHardware } from "../environment/a1TunnelCVisibleSupportGroundingV1.js";\n', "");

for (const oldMarker of [
  "a1-visible-tunnel-c-support-grounding-runtime-v2",
  "a1-visible-tunnel-c-support-grounding-runtime-v3",
  "a1-visible-tunnel-c-support-grounding-runtime-v4",
  "a1-visible-tunnel-c-support-grounding-runtime-v5-kphx-pavement",
  "a1-visible-tunnel-c-support-grounding-runtime-v6-transformed-gate-anchor",
  "a1-visible-tunnel-c-support-grounding-runtime-v7-fleet-parent-ramp",
  "a1-visible-tunnel-c-support-grounding-runtime-v8-rendered-pavement-raycast",
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

  const runtimeBlock = `          // ${marker}\n          // Resolve all five exact visible aircraft-side Tunnel-C support islands against\n          // the actual rendered KPHX pavement. The five-island / 1,311-triangle identity\n          // is source-mesh authority, while pavement height remains a live world raycast.\n          // This prevents one grounded subset from certifying neighboring hanging rods.\n          const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV2(\n            THREE, finalA1Model,\n          );\n          if (\n            finalA1VisibleSupportGrounding.authority !== "${authority}"\n            || finalA1VisibleSupportGrounding.rampReferenceAuthority !== "rendered-kphx-source-aerial-raycast-under-suspended-compact-hardware"\n            || finalA1VisibleSupportGrounding.inspectedCandidateCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}\n            || finalA1VisibleSupportGrounding.groundedComponentCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}\n            || finalA1VisibleSupportGrounding.visibleLoadLegCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}\n            || finalA1VisibleSupportGrounding.groundedTriangleCount !== ${EXPECTED_VISIBLE_SUPPORT_TRIANGLE_COUNT}\n            || finalA1VisibleSupportGrounding.remainingSuspendedSupportCount !== 0\n            || finalA1VisibleSupportGrounding.rampReferenceComponentCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}\n            || finalA1VisibleSupportGrounding.rampReferenceComponentCount !== finalA1VisibleSupportGrounding.groundedComponentCount\n            || !Number.isFinite(finalA1VisibleSupportGrounding.rampReferenceSpreadMeters)\n            || !(finalA1VisibleSupportGrounding.rampReferenceSpreadMeters <= 0.08)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumExtensionMeters)\n            || !(finalA1VisibleSupportGrounding.maximumExtensionMeters <= 4.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters)\n            || !(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015)\n          ) {\n            throw new Error(\`A1 visible Tunnel-C support grounding failed complete-five-island proof: \${JSON.stringify(finalA1VisibleSupportGrounding)}\`);\n          }\n          exactA1Fleet.updateWorldMatrix(true, true);\n          finalA1Model.updateWorldMatrix(true, true);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundingAuthority = finalA1VisibleSupportGrounding.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceAuthority = finalA1VisibleSupportGrounding.rampReferenceAuthority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportCandidateCount = String(finalA1VisibleSupportGrounding.inspectedCandidateCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedComponentCount = String(finalA1VisibleSupportGrounding.groundedComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedTriangleCount = String(finalA1VisibleSupportGrounding.groundedTriangleCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportLoadLegCount = String(finalA1VisibleSupportGrounding.visibleLoadLegCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRemainingSuspendedCount = String(finalA1VisibleSupportGrounding.remainingSuspendedSupportCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportBeforeClearanceMeters = finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportExtensionMeters = finalA1VisibleSupportGrounding.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters = finalA1VisibleSupportGrounding.maximumFinalClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters = finalA1VisibleSupportGrounding.maximumTopMountDriftMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampWorldY = finalA1VisibleSupportGrounding.rampWorldY.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceCount = String(finalA1VisibleSupportGrounding.rampReferenceComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceSpreadMeters = finalA1VisibleSupportGrounding.rampReferenceSpreadMeters.toFixed(6);\n\n`;
  source = source.replace(browserTruthAnchor, `${runtimeBlock}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  authority,
  "rendered-kphx-source-aerial-raycast-under-suspended-compact-hardware",
  `finalA1VisibleSupportGrounding.inspectedCandidateCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}`,
  `finalA1VisibleSupportGrounding.groundedComponentCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}`,
  `finalA1VisibleSupportGrounding.visibleLoadLegCount !== ${EXPECTED_VISIBLE_SUPPORT_COMPONENT_COUNT}`,
  `finalA1VisibleSupportGrounding.groundedTriangleCount !== ${EXPECTED_VISIBLE_SUPPORT_TRIANGLE_COUNT}`,
  "finalA1VisibleSupportGrounding.remainingSuspendedSupportCount !== 0",
  "finalA1VisibleSupportGrounding.rampReferenceSpreadMeters <= 0.08",
  "finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015",
  "finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015",
]) {
  if (!source.includes(required)) throw new Error(`${trainerPath}: visible Tunnel-C support grounding is missing ${required}`);
}
for (const forbidden of [
  'exact-supplied-tunnel-c-visible-support-components-grounded-v5-carrier-floor-reference-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v6-kphx-world-ramp-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v7-complete-set-carrier-ramp-reference',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v8-kphx-pavement-plane',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v9-transformed-gate-anchor-plane',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v10-fleet-parent-ramp-plane',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v11-rendered-kphx-pavement-raycast',
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale visible-support authority survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: all five exact visible Tunnel-C support islands (1,311 triangles) must be seated on rendered KPHX pavement and rescanned fail-closed.`);
