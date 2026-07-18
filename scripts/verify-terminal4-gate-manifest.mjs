import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = JSON.parse(await readFile(new URL("../docs/environment/terminal4-gate-manifest.schema.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../docs/environment/terminal4-gate-manifest.json", import.meta.url), "utf8"));

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.equal(schema.properties?.corridor?.properties?.startGate?.const, "B15");
assert.equal(schema.properties?.corridor?.properties?.endGate?.const, "A1");
assert.equal(schema.properties?.corridor?.properties?.sourceAuthority?.const, "scenery/KPHX_ADEX.BGL");

for (const field of [
  "id",
  "terminalSector",
  "worldCoordinates",
  "aircraftParkingReference",
  "aircraftNoseHeadingDeg",
  "noseGearStart",
  "tugApproachSpawn",
  "tugCaptureSpawn",
  "initialTugHeadingDeg",
  "safePushbackStartDirectionDeg",
  "stopTurnReferences",
  "clearanceConstraints",
  "provenance",
]) {
  assert.ok(schema.$defs?.gate?.required?.includes(field), `gate schema missing required field ${field}`);
}

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.corridor?.startGate, "B15");
assert.equal(manifest.corridor?.endGate, "A1");
assert.equal(manifest.corridor?.sourceRepository, "TheMainlineCowboy/SkyHarborPhx");
assert.equal(manifest.corridor?.sourceAuthority, "scenery/KPHX_ADEX.BGL");
assert.equal(manifest.coordinateSystem?.manualCorrectionsSeparated, true);
assert.equal(manifest.extractionState?.runtimeSelectionAllowed, false);
assert.equal(manifest.extractionState?.gateIdentifiersDerived, false);
assert.ok(Array.isArray(manifest.gates));
assert.equal(manifest.gates.length, 0, "gate coordinates must remain empty until ADEX extraction is complete");
assert.match(manifest.extractionState?.blocker ?? "", /KPHX_ADEX\.BGL/);
assert.match(manifest.extractionState?.blocker ?? "", /prevent guessed coordinates/i);

console.log("Terminal 4 gate-manifest contract passed: every required simulator pose and provenance field is defined, while runtime selection remains blocked until ADEX-derived gate records exist.");
