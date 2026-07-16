import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeLektroScan } from "./analyze-lektro-scan.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "rampready-lektro-scan-"));

try {
  await writeFile(path.join(directory, "3DModel.obj"), [
    "o tug",
    "g body",
    "v -1 0 -2",
    "v 1 0 -2",
    "v 1 1 2",
    "v -1 1 2",
    "v 5 0 5",
    "v 6 0 5",
    "v 5 1 5",
    "v 99 99 99",
    "vt 0 0",
    "vt 1 0",
    "vt 1 1",
    "vt 0 1",
    "vn 0 1 0",
    "usemtl material0",
    "f 1/1/1 2/2/1 3/3/1 4/4/1",
    "g scan-noise",
    "f 5 6 7",
    "",
  ].join("\n"));
  await writeFile(path.join(directory, "3DModel.mtl"), "newmtl material0\nmap_Kd 3DModel.jpg\n");
  await writeFile(path.join(directory, "3DModel.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

  const report = await analyzeLektroScan(directory);
  assert.equal(report.vertices, 8);
  assert.equal(report.textureCoordinates, 4);
  assert.equal(report.normals, 1);
  assert.equal(report.faces, 2);
  assert.equal(report.triangles, 3);
  assert.deepEqual(report.bounds.min, [-1, 0, -2]);
  assert.deepEqual(report.bounds.max, [99, 99, 99]);
  assert.deepEqual(report.bounds.extents, [100, 99, 101]);
  assert.equal(report.provisionalNormalization.scaleFactor, 5.5 / 101);
  assert.equal(report.topology.connectedComponents, 2);
  assert.deepEqual(report.topology.connectedComponentVertexCounts, [4, 3]);
  assert.equal(report.topology.unreferencedVertices, 1);
  assert.deepEqual(report.topology.groups, ["body", "scan-noise"]);
  assert.deepEqual(report.topology.objects, ["tug"]);
  assert.equal(report.topology.components[0].vertices, 4);
  assert.equal(report.topology.components[0].faces, 1);
  assert.equal(report.topology.components[0].triangles, 2);
  assert.deepEqual(report.topology.components[0].bounds, {
    min: [-1, 0, -2],
    max: [1, 1, 2],
    extents: [2, 1, 4],
  });
  assert.equal(report.topology.components[0].triangleShare, 2 / 3);
  assert.equal(report.topology.components[1].vertices, 3);
  assert.equal(report.topology.components[1].triangles, 1);
  assert.deepEqual(report.topology.components[1].bounds, {
    min: [5, 0, 5],
    max: [6, 1, 5],
    extents: [1, 1, 0],
  });
  assert.equal(report.topology.dominantComponent.triangles, 2);
  assert.equal(report.topology.dominantComponent.vertexShare, 4 / 7);
  assert.deepEqual(report.topology.cleanupCandidates, []);
  assert.deepEqual(report.material.definitions, ["material0"]);
  assert.deepEqual(report.material.usedByGeometry, ["material0"]);
  assert.deepEqual(report.material.diffuseTextureReferences, ["3DModel.jpg"]);
  assert.equal(report.textureBytes, 4);

  console.log("Verified component-level Lektro scan cleanup reporting.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
