import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeLektroScan } from "./analyze-lektro-scan.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "rampready-lektro-scan-"));

try {
  await writeFile(path.join(directory, "3DModel.obj"), [
    "v -1 0 -2",
    "v 1 0 -2",
    "v 1 1 2",
    "v -1 1 2",
    "f 1 2 3 4",
    "",
  ].join("\n"));
  await writeFile(path.join(directory, "3DModel.mtl"), "newmtl material0\nmap_Kd 3DModel.jpg\n");
  await writeFile(path.join(directory, "3DModel.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const report = await analyzeLektroScan(directory);
  assert.equal(report.vertices, 4);
  assert.equal(report.triangles, 2);
  assert.deepEqual(report.bounds.min, [-1, 0, -2]);
  assert.deepEqual(report.bounds.max, [1, 1, 2]);
  assert.deepEqual(report.bounds.extents, [2, 1, 4]);
  assert.equal(report.provisionalNormalization.scaleFactor, 1.375);
  assert.deepEqual(report.material.diffuseTextureReferences, ["3DModel.jpg"]);
  assert.equal(report.textureBytes, 4);

  console.log("Verified repeatable Lektro scan ingestion analysis.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
