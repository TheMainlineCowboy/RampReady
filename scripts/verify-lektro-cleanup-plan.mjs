import assert from "node:assert/strict";
import { buildLektroCleanupPlan } from "./build-lektro-cleanup-plan.mjs";

const component = (triangleShare, vertices, triangles) => ({
  vertices,
  faces: triangles,
  triangles,
  vertexShare: triangleShare,
  triangleShare,
  bounds: {
    min: [0, 0, 0],
    max: [1, 1, 1],
    extents: [1, 1, 1],
  },
});

const report = {
  sourceFiles: ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"],
  topology: {
    dominantComponent: { index: 0 },
    components: [
      component(0.9, 900, 9000),
      component(0.06, 60, 600),
      component(0.01, 10, 100),
      component(0.001, 1, 10),
    ],
  },
  provisionalNormalization: {
    basis: "dominant-connected-component",
  },
};

const plan = buildLektroCleanupPlan(report);
assert.equal(plan.version, 1);
assert.equal(plan.dominantComponentIndex, 0);
assert.deepEqual(plan.summary, {
  retain: 1,
  retainCandidates: 1,
  review: 1,
  removeCandidates: 1,
});
assert.deepEqual(
  plan.dispositions.map((entry) => entry.action),
  ["retain", "retain-candidate", "review", "remove-candidate"],
);
assert.match(plan.dispositions[0].reason, /dominant connected component/u);
assert.equal(plan.safeguards.length, 4);
assert.throws(
  () => buildLektroCleanupPlan(report, { removeTriangleShare: 0.1, reviewTriangleShare: 0.05 }),
  /thresholds/u,
);
assert.throws(
  () => buildLektroCleanupPlan({ topology: {} }),
  /connected-component evidence/u,
);

console.log("Verified conservative Lektro cleanup planning and safeguards.");
