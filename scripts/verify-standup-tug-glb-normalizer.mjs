import { normalizeStandupTugDocument } from "./standup-tug-glb-normalizer.mjs";

const document = {
  asset: { version: "2.0" },
  accessors: [
    { min: [-3.61415, 0.404899, 7.37464], max: [1.966003, 4.435699, 20.548677] },
    { min: [-3.61415, -0.132282, -2.37876], max: [3.466346, 8.228104, 16.617887] },
    { min: [21.23, 7.22, -6.18], max: [22.31, 7.51, -5.91] },
  ],
  meshes: [
    { name: "Tug_tow_TugTug_0_0", primitives: [{ attributes: { POSITION: 0 } }] },
    { name: "Tug_tow_TugTug_0_1", primitives: [{ attributes: { POSITION: 0 } }] },
    { name: "Tug_tug_0_0", primitives: [{ attributes: { POSITION: 1 } }] },
    { name: "Tug_tug_0_1", primitives: [{ attributes: { POSITION: 1 } }] },
    { name: "polySurface487_dash_handle", primitives: [{ attributes: { POSITION: 2 } }] },
  ],
  nodes: [
    { name: "Tug_tow_TugTug_0_0", mesh: 0, matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1] },
    { name: "Tug_tow_TugTug_0_1", mesh: 1 },
    { name: "Tug_tug_0_0", mesh: 2 },
    { name: "Tug_tug_0_1", mesh: 3 },
    { name: "polySurface487_dash_handle", mesh: 4 },
  ],
  scenes: [{ nodes: [0, 1, 2, 3, 4] }],
};

const normalized = normalizeStandupTugDocument(document);
const failures = [];
const root = normalized.nodes.find((node) => node.name === "RampReady_Standup_Tug");
if (!root) failures.push("normalized root missing");
if (normalized.scenes[0].nodes.length !== 1) failures.push("scene must contain only normalized root");
if (normalized.nodes.some((node) => /polySurface487/.test(node.name || ""))) failures.push("detached dash-handle assembly retained");
for (const name of ["RR_CAPTURE_ANCHOR", "RR_OPERATOR_EYE", "RR_OPERATOR_LOOK", "RR_CRADLE_LIFT", "RR_STEER_LEFT", "RR_STEER_RIGHT"]) {
  if (!normalized.nodes.some((node) => node.name === name)) failures.push(`${name} missing`);
}
if (!normalized.nodes.filter((node) => /^Tug_/.test(node.name || "")).every((node) => !node.matrix && !node.rotation && !node.translation && !node.scale)) {
  failures.push("source scene transforms were not cleared");
}
const meta = normalized.extras?.rampReadyStandupTug;
if (!meta || meta.schemaVersion !== 1) failures.push("normalization metadata missing");
if (Math.abs(meta.targetLengthMeters - 4.5854875) > 1e-8) failures.push("target length changed");
if (Math.abs(meta.captureZ - 3.45) > 1e-8) failures.push("capture anchor changed");
if (!Number.isFinite(meta.scale) || meta.scale <= 0) failures.push("normalization scale invalid");
if (root?.extras?.normalizedBoundsMeters?.min?.[1] !== 0) failures.push("ground plane is not normalized to y=0");
if (Math.abs(root?.extras?.normalizedBoundsMeters?.max?.[2] - 3.45) > 1e-8) failures.push("front capture plane is not normalized to z=3.45");

if (failures.length) {
  console.error("Stand-up tug GLB normalization verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Stand-up tug GLB normalization verified: ${meta.retainedMeshNodes.length} mesh primitives retained, detached dash-handle family removed, scale ${meta.scale.toFixed(6)}.`);
