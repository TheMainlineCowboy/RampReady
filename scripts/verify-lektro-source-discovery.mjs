import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { locateLektroScanSources, REQUIRED_LEKTRO_SCAN_FILES } from "./locate-lektro-scan-source.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "rampready-lektro-discovery-"));
const complete = path.join(root, "uploads", "kiri-export");
const incomplete = path.join(root, "uploads", "partial");
await mkdir(complete, { recursive: true });
await mkdir(incomplete, { recursive: true });

for (const [index, name] of REQUIRED_LEKTRO_SCAN_FILES.entries()) {
  await writeFile(path.join(complete, name), Buffer.alloc(index + 11));
}
await writeFile(path.join(incomplete, "3DModel.obj"), "partial");
await mkdir(path.join(root, "node_modules", "ignored"), { recursive: true });
for (const name of REQUIRED_LEKTRO_SCAN_FILES) {
  await writeFile(path.join(root, "node_modules", "ignored", name), "ignored");
}

const matches = await locateLektroScanSources([root], { maxDepth: 4 });
assert.equal(matches.length, 1, "only the complete non-ignored package should be found");
assert.equal(matches[0].directory, complete);
assert.deepEqual(Object.keys(matches[0].files).sort(), [...REQUIRED_LEKTRO_SCAN_FILES].sort());
assert.equal(matches[0].files["3DModel.obj"].bytes, 11);
assert.equal(matches[0].files["3DModel.mtl"].bytes, 12);
assert.equal(matches[0].files["3DModel.jpg"].bytes, 13);

const shallowMatches = await locateLektroScanSources([root], { maxDepth: 1 });
assert.equal(shallowMatches.length, 0, "maxDepth must bound recursive discovery");

const missingRootMatches = await locateLektroScanSources([path.join(root, "does-not-exist")]);
assert.deepEqual(missingRootMatches, [], "missing roots should be handled deterministically");

console.log("Lektro source discovery verification passed");
