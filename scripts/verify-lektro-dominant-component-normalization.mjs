import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeLektroScanForCleanup } from "./analyze-lektro-scan-clean.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "rampready-lektro-scale-"));

try {
  await writeFile(path.join(directory, "3DModel.obj"), [
    "o tug",
    "v -1 0 -2",
    "v 1 0 -2",
    "v 1 1 2",
    "v -1 1 2",
    "v 100 0 100",
    "v 200 0 100",
    "v 100 0 200",
    "v 999 999 999",
    "usemtl material0",
    "f 1 2 3 4",
    "f 5 6 7",
    "",
  ].join("\n"));
  await writeFile(path.join(directory, "3DModel.mtl"), "newmtl material0\nmap_Kd 3DModel.jpg\n");
  await writeFile(path.join(directory, "3DModel.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const report = await analyzeLektroScanForCleanup(directory);
  assert.equal(report.provisionalNormalization.basis, "dominant-connected-component");
  assert.equal(report.provisionalNormalization.sourceComponentIndex, 0);
  assert.deepEqual(report.provisionalNormalization.sourceBounds.extents, [2, 1, 4]);
  assert.deepEqual(report.provisionalNormalization.ignoredGlobalBounds.extents, [1000, 999, 1001]);
  assert.equal(report.provisionalNormalization.scaleFactor, 5.5 / 4);
  assert.notEqual(report.provisionalNormalization.scaleFactor, 5.5 / 1001);
  assert.match(report.provisionalNormalization.warning, /inspection-only/i);

  console.log("Verified Lektro normalization ignores unreferenced and non-dominant scan outliers.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
