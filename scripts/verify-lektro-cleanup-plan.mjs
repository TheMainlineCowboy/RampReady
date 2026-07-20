import assert from "node:assert/strict";
import { buildLektroCleanupPlan, buildLektroComponentId } from "./build-lektro-cleanup-plan.mjs";

const component = (triangleShare, vertices, triangles, offset = 0) => ({
  vertices,
  faces: triangles,
  triangles,
  vertexShare: triangleShare,
  triangleShare,
  bounds: {
    min: [offset, 0, 0],
    max: [offset + 1, 1, 1],
    extents: [1, 1, 1],
  },
});

const report = {
  sourceFiles: ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"],
  topology: {
    dominantComponent: { index: 0 },
    components: [
      component(0.9, 900, 9000, 0),
      component(0.06, 60, 600, 2),
      component(0.01, 10, 100, 4),
      component(0.001, 1, 10, 6),
    ],
  },
  provisionalNormalization: {
    basis: "dominant-connected-component",
  },
};

const plan = buildLektroCleanupPlan(report);
assert.equal(plan.version, 2);
assert.equal(plan.dominantComponentIndex, 0);
assert.equal(plan.dominantComponentId, plan.dispositions[0].componentId);
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
assert.equal(plan.safeguards.length, 5);
assert.deepEqual(
  plan.reviewQueue.map((entry) => entry.componentIndex),
  [1, 2],
);
assert.ok(plan.dispositions.every((entry) => /^lektro-component-[a-f0-9]{16}$/u.test(entry.componentId)));
assert.equal(new Set(plan.dispositions.map((entry) => entry.componentId)).size, plan.dispositions.length);

const repeatedPlan = buildLektroCleanupPlan(structuredClone(report));
assert.deepEqual(
  repeatedPlan.dispositions.map((entry) => entry.componentId),
  plan.dispositions.map((entry) => entry.componentId),
  "component IDs must remain stable across repeated analysis of identical evidence",
);

const reorderedReport = structuredClone(report);
reorderedReport.topology.components = [
  reorderedReport.topology.components[2],
  reorderedReport.topology.components[0],
  reorderedReport.topology.components[3],
  reorderedReport.topology.components[1],
];
reorderedReport.topology.dominantComponent.index = 1;
const reorderedPlan = buildLektroCleanupPlan(reorderedReport);
assert.deepEqual(
  new Set(reorderedPlan.dispositions.map((entry) => entry.componentId)),
  new Set(plan.dispositions.map((entry) => entry.componentId)),
  "component IDs must not depend on connected-component ordering",
);

const perturbed = structuredClone(report.topology.components[1]);
perturbed.bounds.max[0] += 0.000001;
assert.notEqual(
  buildLektroComponentId(perturbed),
  buildLektroComponentId(report.topology.components[1]),
  "material evidence changes must produce a different component ID",
);

assert.throws(
  () => buildLektroCleanupPlan(report, { removeTriangleShare: 0.1, reviewTriangleShare: 0.05 }),
  /thresholds/u,
);
assert.throws(
  () => buildLektroCleanupPlan({ topology: {} }),
  /connected-component evidence/u,
);

console.log("Verified conservative Lektro cleanup planning, stable component IDs, review queue, and safeguards.");
