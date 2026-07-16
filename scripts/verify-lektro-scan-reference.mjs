import assert from "node:assert/strict";
import { LEKTRO_SCAN_REFERENCE, assertLektroScanRuntimeReady } from "../src/components/tug/lektroScanReference.js";

const ref = LEKTRO_SCAN_REFERENCE;

assert.deepEqual(ref.sourceFiles, ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"]);
assert.equal(ref.sourceGeometry.vertices, 39377);
assert.equal(ref.sourceGeometry.triangles, 78790);
assert.deepEqual(ref.sourceGeometry.texture, { width: 4096, height: 4096, format: "JPEG" });
assert.deepEqual(ref.sourceGeometry.bounds.extents, [2.218718, 0.440406, 2.082891]);
assert.equal(ref.provisionalNormalization.groundAxis, "+Y");
assert.equal(ref.provisionalNormalization.targetLongestHorizontalExtentMeters, 5.5);
assert.equal(ref.provisionalNormalization.normalizedExtentsMeters[0], 5.5);
assert.equal(ref.runtimeApproval.approved, false);
assert.throws(() => assertLektroScanRuntimeReady(), /reference-only/i);
assert.ok(ref.requiredCleanup.includes("remove pavement and scan background geometry"));
assert.ok(ref.requiredCleanup.includes("decimate for mobile and VR performance"));
assert.ok(ref.requiredCleanup.some((item) => item.includes("cradle")));

console.log("Verified scan-driven Lektro normalization contract and runtime safety gate.");
