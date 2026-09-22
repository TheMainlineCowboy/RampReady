import assert from "node:assert/strict";
import fs from "node:fs/promises";

const RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const EXPECTED_WED_SHA256 = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";
const EXPECTED_FACADE_SHA256 = "a98a61b6de28a0db6548f748163494fc24513267dee40322502d5800eff8feb5";
const EXPECTED_COUNT = 76;
const EXPECTED_OPEN_EDGES = 261;

const [wed, map, stockManifest] = await Promise.all([
  fs.readFile("public/models/kphx/wed-jetways.exact.json", "utf8").then(JSON.parse),
  fs.readFile("public/models/kphx/terminal4-wed-jetways.exact.json", "utf8").then(JSON.parse),
  fs.readFile("public/models/xplane11-stock/jetway1/manifest.json", "utf8").then(JSON.parse),
]);
const facadeText = await fs.readFile("public/models/xplane11-stock/jetway1/jetway_1_solid.fac", "utf8");

assert.equal(wed.source?.sha256, EXPECTED_WED_SHA256, "WED jetway extraction source hash changed");
assert.equal(map.source?.sha256, EXPECTED_WED_SHA256, "T4 jetway mapping source hash changed");
assert.equal(stockManifest.files?.["jetway_1_solid.fac"]?.sha256, EXPECTED_FACADE_SHA256, "Stock FAC hash changed");
assert.match(facadeText, /^RING\s+0\s*$/m, "Stock FAC must remain RING 0");
assert.equal(map.jetwayCount, EXPECTED_COUNT);
assert.equal(map.placements.length, EXPECTED_COUNT);

const wedById = new Map(wed.placements.map((entry) => [entry.wedObjectId, entry]));
const facadeIds = new Set();
const gateCounts = {};
let openEdges = 0;

for (const mapped of map.placements) {
  const placement = wedById.get(mapped.facadeWedObjectId);
  assert.ok(placement, `Missing WED facade ${mapped.facadeWedObjectId} for ${mapped.gate}`);
  assert.equal(placement.resource, RESOURCE, `${mapped.gate} resource changed`);
  assert.equal(Number(placement.height), 3, `${mapped.gate} facade height changed`);
  assert.equal(placement.rings?.length, 1, `${mapped.gate} ring count changed`);

  const nodes = placement.rings[0].nodes || [];
  assert.equal(nodes.length, mapped.facadeNodeCount, `${mapped.gate} node count changed`);
  assert.ok(nodes.length >= 2, `${mapped.gate} has no open facade path`);

  for (const node of nodes) {
    const match = String(node.wallType || "").match(/^Wall\s+(\d+)$/);
    assert.ok(match, `${mapped.gate} node ${node.wedObjectId} lost wall choice`);
    const wall = Number(match[1]);
    assert.ok(wall >= 1 && wall <= 10, `${mapped.gate} node ${node.wedObjectId} has invalid Wall ${wall}`);
  }

  openEdges += nodes.length - 1;
  assert.ok(!facadeIds.has(mapped.facadeWedObjectId), `Duplicate mapped facade ${mapped.facadeWedObjectId}`);
  facadeIds.add(mapped.facadeWedObjectId);
  gateCounts[mapped.gate] = (gateCounts[mapped.gate] || 0) + 1;
}

assert.equal(openEdges, EXPECTED_OPEN_EDGES, "T4 authored open-edge count changed");
assert.equal(Object.keys(gateCounts).length, 75, "Expected 75 T4 gate names");
assert.equal(gateCounts.D7, 2, "D7 must retain both authored jetway facades");
for (const [gate, count] of Object.entries(gateCounts)) {
  if (gate !== "D7") assert.equal(count, 1, `${gate} unexpectedly maps to ${count} facades`);
}

console.log("KPHX T4 exact XP11 stock-jetway source contract passed.");
console.log(JSON.stringify({
  jetwayCount: map.placements.length,
  uniqueGateNames: Object.keys(gateCounts).length,
  d7JetwayCount: gateCounts.D7,
  authoredOpenEdges: openEdges,
  wedSha256: EXPECTED_WED_SHA256,
  facadeSha256: EXPECTED_FACADE_SHA256,
  resource: RESOURCE,
  substitutionPolicy: "none",
}, null, 2));
