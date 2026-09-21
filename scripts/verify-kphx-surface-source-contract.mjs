import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.resolve(process.argv[2] || "public/models/kphx-full-airport/surfaces/manifest.json");
const networkPath = path.resolve(process.argv[3] || "public/models/kphx-full-airport/surfaces/surface-network.json");

const EXPECTED_WED_SHA256 = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";
const EXPECTED_RESOURCE_COUNT = 11;
const EXPECTED_POLYGON_PLACEMENTS = Object.freeze({
  "GroundPolys/asphalt1.pol": 1,
  "GroundPolys/invis_concrete.pol": 3,
  "Ground_Textures/Asphalt_2_Base.pol": 4,
  "Ground_Textures/Invisible_Concrete.pol": 5,
});
const EXPECTED_LINE_PLACEMENTS = Object.freeze({
  "Lines/Taxiline.lin": 23,
  "Lines/edge_gray.lin": 4,
  "Lines/RoadZipper.lin": 2,
  "Lines/RunwayLine.lin": 1,
  "Lines/Taxiline_Dash.lin": 1,
  "Lines/blueTaxiline.lin": 1,
  "Runways/Runway.lin": 3,
});

const [manifestSource, networkSource] = await Promise.all([
  fs.readFile(manifestPath, "utf8"),
  fs.readFile(networkPath, "utf8"),
]);
const manifest = JSON.parse(manifestSource);
const network = JSON.parse(networkSource);

assert.equal(manifest.source.version, "1.75.1");
assert.equal(network.source.version, "1.75.1");
assert.equal(manifest.source.wedSha256, EXPECTED_WED_SHA256, "WED source hash changed");
assert.equal(manifest.packageOwnedResourceCount, EXPECTED_RESOURCE_COUNT);
assert.equal(manifest.materializedResourceCount, EXPECTED_RESOURCE_COUNT);
assert.deepEqual(manifest.failures, []);

function placementCounts(records) {
  const counts = {};
  for (const entry of records.filter((record) => record.sourceClass === "package-owned")) {
    counts[entry.resource] = (counts[entry.resource] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

assert.deepEqual(
  placementCounts(network.polygons),
  Object.fromEntries(Object.entries(EXPECTED_POLYGON_PLACEMENTS).sort(([a], [b]) => a.localeCompare(b))),
);
assert.deepEqual(
  placementCounts(network.lines),
  Object.fromEntries(Object.entries(EXPECTED_LINE_PLACEMENTS).sort(([a], [b]) => a.localeCompare(b))),
);

assert.deepEqual(network.runways.map((runway) => runway.name), ["07L/25R", "08/26", "07R/25L"]);
for (const runway of network.runways) {
  assert.equal(runway.widthMeters, 46.02, `${runway.name} WED width changed`);
  assert.equal(runway.endpoints.length, 2, `${runway.name} endpoint count changed`);
}

function verifyImage(image, label) {
  if (!image) return;
  assert.equal(
    image.sourceDecodedRgbaSha256,
    image.outputDecodedRgbaSha256,
    `${label} decoded pixel hash changed during browser conversion`,
  );
  assert.ok(image.width > 0 && image.height > 0, `${label} image dimensions are invalid`);
}

for (const [resourceName, resource] of Object.entries(manifest.resources)) {
  verifyImage(resource.texture, `${resourceName} albedo`);
  verifyImage(resource.lit, `${resourceName} lit`);
  verifyImage(resource.normal, `${resourceName} normal`);
  verifyImage(resource.weather, `${resourceName} weather`);
  for (const [index, decal] of (resource.decal?.decals || []).entries()) {
    verifyImage(decal.image, `${resourceName} decal ${index}`);
  }
}

function lineWidth(resourceName) {
  const resource = manifest.resources[resourceName];
  assert.equal(resource.kind, "LINE_PAINT");
  assert.equal(resource.sOffsets.length, 1);
  const offset = resource.sOffsets[0];
  return (offset.right - offset.left) / resource.textureWidth * resource.scaleMeters[0];
}

assert.ok(Math.abs(lineWidth("Runways/Runway.lin") - 46) < 1e-12);
assert.ok(Math.abs(lineWidth("Lines/Taxiline.lin") - 1.025390625) < 1e-12);
assert.ok(Math.abs(lineWidth("Lines/RoadZipper.lin") - 1.0546875) < 1e-12);
assert.ok(Math.abs(lineWidth("Lines/RunwayLine.lin") - 3.28125) < 1e-12);
assert.ok(Math.abs(lineWidth("Lines/Taxiline_Dash.lin") - 0.78125) < 1e-12);
assert.ok(Math.abs(lineWidth("Lines/blueTaxiline.lin") - 0.5859375) < 1e-12);

const asphalt = manifest.resources["Ground_Textures/Asphalt_2_Base.pol"];
assert.deepEqual(asphalt.scaleMeters, [30, 30]);
assert.equal(asphalt.layerGroup.group, "taxiways");
assert.equal(asphalt.layerGroup.offset, 2);
assert.equal(asphalt.normalScale, 1);
assert.equal(asphalt.normal.outputName, "Asphalt_2_NRM.png");
assert.equal(asphalt.decal.decals.length, 1);
assert.equal(asphalt.decal.decals[0].texture, "Road_Decal.png");
assert.equal(asphalt.decal.decals[0].scaleRatio, 0.2);
assert.equal(asphalt.decal.decals[0].alphaKey[5], 0.7);

console.log("KPHX 1.75.1 package-owned surface source contract passed.");
console.log(JSON.stringify({
  wedSha256: manifest.source.wedSha256,
  resourceCount: manifest.materializedResourceCount,
  polygonPlacements: Object.values(EXPECTED_POLYGON_PLACEMENTS).reduce((a, b) => a + b, 0),
  linePlacements: Object.values(EXPECTED_LINE_PLACEMENTS).reduce((a, b) => a + b, 0),
  runways: network.runways.map((runway) => ({ name: runway.name, widthMeters: runway.widthMeters })),
  runwayLineWidthMeters: lineWidth("Runways/Runway.lin"),
  taxiLineWidthMeters: lineWidth("Lines/Taxiline.lin"),
}, null, 2));
