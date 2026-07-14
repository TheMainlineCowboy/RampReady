import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../docs/assets/lektro-scan-manifest.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

assert.equal(manifest.asset, "KIRI Engine rough Lektro pushback scan");
assert.deepEqual(manifest.sourceFiles, ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"]);
assert.equal(manifest.source.vertices, 39377);
assert.equal(manifest.source.triangles, 78790);
assert.deepEqual(manifest.source.texture, { width: 4096, height: 4096, format: "JPEG" });
assert.deepEqual(manifest.source.bounds.extents, [2.218718, 0.440406, 2.082891]);
assert.equal(manifest.notApprovedAsRuntimeAsset, true);
assert.ok(manifest.knownCleanup.includes("remove pavement and scan background geometry"));
assert.ok(manifest.knownCleanup.includes("decimate for mobile and VR performance"));
assert.ok(manifest.knownCleanup.includes("verify cradle and nose-gear alignment in the simulator"));
assert.equal(manifest.provisionalNormalization.groundAxis, "+Y");
assert.equal(manifest.provisionalNormalization.groundMinimumYAtZero, true);
assert.equal(manifest.provisionalNormalization.targetLongestHorizontalExtentMeters, 5.5);
assert.ok(Number.isFinite(manifest.provisionalNormalization.provisionalScaleFactor));
assert.match(manifest.provisionalNormalization.warning, /provisional/i);

console.log("Verified Lektro scan manifest and cleanup gate.");
