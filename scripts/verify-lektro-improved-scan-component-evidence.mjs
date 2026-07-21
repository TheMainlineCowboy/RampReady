import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const report = JSON.parse(
  await readFile(new URL("../docs/lektro-improved-scan-component-evidence.json", import.meta.url), "utf8"),
);

assert.equal(report.schemaVersion, 1);
assert.equal(report.source.archiveSha256, "5956a8d5257d19ce876e9223f085270cd2e37bbfb5e5b6fe033eda094e9ae233");
assert.equal(report.source.objSha256, "5fdb31888f697d7ef1dfacd9f02a9c5d14fe4659bebb89720560242b297beddb");
assert.equal(report.mesh.vertices, 63007);
assert.equal(report.mesh.triangles, 126113);
assert.equal(report.mesh.connectedComponents, 10);
assert.equal(report.mesh.watertight, false);
assert.deepEqual(report.mesh.rawBounds.extents, [1.815002, 0.341382, 1.301475]);

assert.equal(report.components.length, report.mesh.connectedComponents);
assert.equal(
  report.components.reduce((sum, component) => sum + component.triangles, 0),
  report.mesh.triangles,
  "component triangle totals must reproduce the source mesh",
);
assert.ok(
  report.components.reduce((sum, component) => sum + component.vertices, 0) >= report.mesh.vertices,
  "split components may duplicate seam vertices but must not lose source vertices",
);
assert.ok(report.components.every((component, index) => component.rank === index));
assert.ok(report.components.every((component) => /^lektro-component-[a-f0-9]{16}$/u.test(component.componentId)));
assert.equal(new Set(report.components.map((component) => component.componentId)).size, report.components.length);

const dominant = report.components[0];
assert.equal(dominant.disposition, "retain");
assert.equal(dominant.triangles, 125848);
assert.ok(dominant.triangleShare > 0.997 && dominant.triangleShare < 0.999);
assert.equal(
  report.components.slice(1).reduce((sum, component) => sum + component.triangles, 0),
  265,
  "disconnected fragment triangle total changed",
);
assert.ok(report.components.slice(1).every((component) => component.disposition !== "retain"));
assert.ok(report.findings.some((finding) => finding.includes("localized hard-surface reconstruction")));
assert.ok(report.nextRepairTargets.includes("mark rear-wall hole boundary loops"));
assert.ok(report.nextRepairTargets.includes("mark clipped lifting-plate boundary and reference-photo dimensions"));

console.log("Verified real improved Lektro scan component evidence and repair targeting.");
