import assert from "node:assert/strict";
import { selectLektroScanSource } from "./select-lektro-scan-source.mjs";

const fileEvidence = {
  "3DModel.obj": { bytes: 100, sha256: "a".repeat(64) },
  "3DModel.mtl": { bytes: 20, sha256: "b".repeat(64) },
  "3DModel.jpg": { bytes: 300, sha256: "c".repeat(64) },
};

const report = {
  schemaVersion: 2,
  hashAlgorithm: "sha256",
  searchedRoots: ["/scan-root"],
  maxDepth: 4,
  matches: [{ directory: "/scan-root/KIRI", files: fileEvidence }],
};

const selected = selectLektroScanSource(report);
assert.equal(selected.sourceDirectory, "/scan-root/KIRI");
assert.equal(selected.selectionPolicy, "exactly-one-complete-package");
assert.deepEqual(selected.files, fileEvidence);
assert.deepEqual(selectLektroScanSource(report), selected);

assert.throws(
  () => selectLektroScanSource({ ...report, matches: [] }),
  /No complete KIRI scan package/,
);
assert.throws(
  () => selectLektroScanSource({ ...report, matches: [report.matches[0], { ...report.matches[0], directory: "/other" }] }),
  /Multiple complete KIRI scan packages/,
);
assert.throws(
  () => selectLektroScanSource({ ...report, schemaVersion: 1 }),
  /schemaVersion 2/,
);
assert.throws(
  () => selectLektroScanSource({ ...report, matches: [{ directory: "/scan-root/KIRI", files: { ...fileEvidence, "3DModel.obj": { bytes: 100, sha256: "bad" } } }] }),
  /invalid SHA-256 evidence/,
);

console.log("Lektro source-selection verification passed.");
