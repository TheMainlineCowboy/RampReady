import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-visible-tunnel-c-support-grounding-runtime-v5-kphx-pavement";
const authority = "exact-supplied-tunnel-c-visible-support-components-grounded-v8-kphx-pavement-plane";
const stairMarker = "a1-service-stair-live-rendered-crj-clearance-v4";
const importLine = 'import { groundA1TunnelCVisibleSupportHardwareV2 } from "../environment/a1TunnelCVisibleSupportGroundingV2.js";';

let source = fs.readFileSync(trainerPath, "utf8");
if (!source.includes(stairMarker)) {
  throw new Error(`${trainerPath}: visible Tunnel-C support grounding must run after the live exact service-stair solve`);
}

source = source.replace(
  'import { groundA1TunnelCVisibleSupportHardware } from "../environment/a1TunnelCVisibleSupportGroundingV1.js";\n',
  "",
);

for (const oldMarker of [
  "a1-visible-tunnel-c-support-grounding-runtime-v2",
  "a1-visible-tunnel-c-support-grounding-runtime-v3",
  "a1-visible-tunnel-c-support-grounding-runtime-v4",
]) {
  if (source.includes(oldMarker) && !source.includes(marker)) {
    const start = source.indexOf(`          // ${oldMarker}`);
    const endAnchor = `          // Browser-time visual truth. Several older readiness layers still`;
    const end = source.indexOf(endAnchor, start);
    if (start < 0 || end < 0) throw new Error(`${trainerPath}: cannot replace stale visible-support ${oldMarker} block`);
    source = source.slice(0, start) + source.slice(end);
  }
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
  const runtimeBlock = `          // ${marker}\n          // Ground the exact supplied Tunnel-C visible support islands on the same\n          // world Y=0 pavement plane used by KPHX ground, aircraft tire contact and\n          // apron markings. A Tunnel-C carrier minimum is not a pavement authority.\n          const finalA1VisibleSupportGrounding = groundA1TunnelCVisibleSupportHardwareV2(\n            THREE, finalA1Model,\n          );\n          if (\n            finalA1VisibleSupportGrounding.authority !== "${authority}"\n            || finalA1VisibleSupportGrounding.groundedComponentCount !== 5\n            || finalA1VisibleSupportGrounding.visibleLoadLegCount !== 5\n            || finalA1VisibleSupportGrounding.groundedTriangleCount !== 1311\n            || finalA1VisibleSupportGrounding.remainingSuspendedSupportCount !== 0\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters <= 4.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumExtensionMeters)\n            || !(finalA1VisibleSupportGrounding.maximumExtensionMeters <= 4.0)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters)\n            || !(finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters)\n            || !(finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015)\n            || !Number.isFinite(finalA1VisibleSupportGrounding.rampWorldY)\n            || !(Math.abs(finalA1VisibleSupportGrounding.rampWorldY) <= 0.001)\n            || finalA1VisibleSupportGrounding.rampReferenceComponentCount !== 1\n            || !Number.isFinite(finalA1VisibleSupportGrounding.rampReferenceSpreadMeters)\n            || !(finalA1VisibleSupportGrounding.rampReferenceSpreadMeters <= 0.001)\n          ) {\n            throw new Error(\`A1 visible Tunnel-C support grounding failed: \${JSON.stringify(finalA1VisibleSupportGrounding)}\`);\n          }\n          exactA1Fleet.updateWorldMatrix(true, true);\n          finalA1Model.updateWorldMatrix(true, true);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundingAuthority = finalA1VisibleSupportGrounding.authority;\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedComponentCount = String(finalA1VisibleSupportGrounding.groundedComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportGroundedTriangleCount = String(finalA1VisibleSupportGrounding.groundedTriangleCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportDetailedPodCount = String(finalA1VisibleSupportGrounding.detailedPodCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportLoadLegCount = String(finalA1VisibleSupportGrounding.visibleLoadLegCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRemainingSuspendedCount = String(finalA1VisibleSupportGrounding.remainingSuspendedSupportCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportBeforeClearanceMeters = finalA1VisibleSupportGrounding.maximumBeforeClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportExtensionMeters = finalA1VisibleSupportGrounding.maximumExtensionMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters = finalA1VisibleSupportGrounding.maximumFinalClearanceMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters = finalA1VisibleSupportGrounding.maximumTopMountDriftMeters.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampWorldY = finalA1VisibleSupportGrounding.rampWorldY.toFixed(6);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceCount = String(finalA1VisibleSupportGrounding.rampReferenceComponentCount);\n          renderer.domElement.dataset.terminal4UploadedJetwayA1VisibleSupportRampReferenceSpreadMeters = finalA1VisibleSupportGrounding.rampReferenceSpreadMeters.toFixed(6);\n\n`;
  source = source.replace(browserTruthAnchor, `${runtimeBlock}${browserTruthAnchor}`);
}

for (const required of [
  marker,
  importLine,
  authority,
  "groundA1TunnelCVisibleSupportHardwareV2",
  "finalA1VisibleSupportGrounding.groundedComponentCount !== 5",
  "finalA1VisibleSupportGrounding.groundedTriangleCount !== 1311",
  "finalA1VisibleSupportGrounding.remainingSuspendedSupportCount !== 0",
  "finalA1VisibleSupportGrounding.maximumExtensionMeters <= 4.0",
  "finalA1VisibleSupportGrounding.maximumFinalClearanceMeters <= 0.015",
  "finalA1VisibleSupportGrounding.maximumTopMountDriftMeters <= 0.015",
  "Math.abs(finalA1VisibleSupportGrounding.rampWorldY) <= 0.001",
  "terminal4UploadedJetwayA1VisibleSupportGroundingAuthority",
  "terminal4UploadedJetwayA1VisibleSupportLoadLegCount",
  "terminal4UploadedJetwayA1VisibleSupportRemainingSuspendedCount",
  "terminal4UploadedJetwayA1VisibleSupportExtensionMeters",
  "terminal4UploadedJetwayA1VisibleSupportFinalClearanceMeters",
  "terminal4UploadedJetwayA1VisibleSupportTopMountDriftMeters",
  "terminal4UploadedJetwayA1VisibleSupportRampReferenceCount",
  "terminal4UploadedJetwayA1VisibleSupportRampReferenceSpreadMeters",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: visible Tunnel-C support grounding is missing ${required}`);
  }
}
for (const forbidden of [
  'exact-supplied-tunnel-c-visible-support-components-grounded-v5-carrier-floor-reference-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v6-kphx-world-ramp-visible-proof',
  'exact-supplied-tunnel-c-visible-support-components-grounded-v7-complete-set-carrier-ramp-reference',
  'finalA1VisibleSupportGrounding.rampWorldY >= -6.0',
  'finalA1VisibleSupportGrounding.rampWorldY <= -3.5',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: stale carrier-derived support acceptance survived: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: final A1 browser geometry seats all five visible exact-source Tunnel-C support islands (1,311 triangles) on the KPHX world pavement plane; no self-referential carrier minimum can satisfy acceptance.`);
