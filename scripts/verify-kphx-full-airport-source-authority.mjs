import assert from "node:assert/strict";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "../src/environment/kphxFullAirport/sourceAuthority.js";
import { KPHX_TERMINAL_CHUNK } from "../src/environment/kphxFullAirport/terminalManifest.js";

function near(actual, expected, tolerance, label) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

const anchor = KPHX_FULL_AIRPORT_SOURCE.anchor;
const anchorPosition = kphxWedToRampReadyPosition(anchor.latitude, anchor.longitude, 0);
near(anchorPosition[0], 0, 1e-6, "A1 X");
near(anchorPosition[1], 0, 1e-6, "A1 Y");
near(anchorPosition[2], 6.2, 1e-6, "A1 Z");

assert.equal(KPHX_FULL_AIRPORT_SOURCE.packageVersion, "1.75.1");
assert.equal(KPHX_TERMINAL_CHUNK.placements.length, 4);
assert.deepEqual(
  KPHX_TERMINAL_CHUNK.placements.map((entry) => entry.name),
  ["Terminal3a", "Terminal3Garage", "Terminal4", "Terminal4b"],
);
assert.ok(!KPHX_TERMINAL_CHUNK.placements.some((entry) => entry.sourceResource.endsWith("/Terminal3b.obj")));

const expectedPositions = new Map([
  ["Terminal3a", [40.090951, 0, 921.399726]],
  ["Terminal3Garage", [120.118052, 0, 920.980563]],
  ["Terminal4", [196.167048, 0, -200.126228]],
  ["Terminal4b", [35.616304, 0, -203.662305]],
]);

for (const placement of KPHX_TERMINAL_CHUNK.placements) {
  const actual = kphxWedToRampReadyPosition(
    placement.latitude,
    placement.longitude,
    placement.customMsl ? placement.mslMeters : 0,
  );
  const expected = expectedPositions.get(placement.name);
  assert.ok(expected, `Missing expected position for ${placement.name}`);
  near(actual[0], expected[0], 0.002, `${placement.name} X`);
  near(actual[1], expected[1], 1e-6, `${placement.name} Y`);
  near(actual[2], expected[2], 0.002, `${placement.name} Z`);
  near(kphxXPlaneHeadingToRampReadyYawRadians(placement.headingDegrees), Math.PI / 2, 1e-12, `${placement.name} yaw`);
}

console.log("KPHX full-airport source-authority verification passed.");
console.log(JSON.stringify({
  sourceVersion: KPHX_FULL_AIRPORT_SOURCE.packageVersion,
  anchor: KPHX_FULL_AIRPORT_SOURCE.anchor,
  terminalPlacements: KPHX_TERMINAL_CHUNK.placements.map((placement) => ({
    name: placement.name,
    wedObjectId: placement.wedObjectId,
    sourceResource: placement.sourceResource,
    runtimePosition: kphxWedToRampReadyPosition(placement.latitude, placement.longitude, 0),
    runtimeYawRadians: kphxXPlaneHeadingToRampReadyYawRadians(placement.headingDegrees),
  })),
}, null, 2));
