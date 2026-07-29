import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("public/models/kphx-ground/runtime-manifest.json", "utf8"));
assert.equal(manifest.schemaVersion, 2, "KPHX runtime manifest schema must be 2");
assert.equal(manifest.detailLevel, "airport-wide-source-runways-taxiways-hold-shorts-v1");
assert.equal(manifest.runways?.length, 3, "KPHX must preserve all three source runways");
assert.ok(manifest.counts?.holdShortCount > 0, "KPHX source hold-short points must render");
assert.ok(manifest.counts?.taxiwayJoinCount > 100, "KPHX taxiway intersections must use joined surfaces");
assert.ok(manifest.counts?.edgeMarkingSegments > 0, "KPHX taxiway edge markings must render");
assert.ok(manifest.counts?.runwayMarkingElementCount > 20, "KPHX runway marking elements are incomplete");
for (const runway of manifest.runways) {
  assert.ok(runway.lengthMeters > 2_000, `${runway.primary}/${runway.secondary} length is invalid`);
  assert.ok(runway.widthMeters >= 30, `${runway.primary}/${runway.secondary} width is invalid`);
  assert.equal(runway.labels?.length, 2, `${runway.primary}/${runway.secondary} needs both identifiers`);
  assert.ok(runway.markingNames?.length > 0, `${runway.primary}/${runway.secondary} marking flags are missing`);
}

const visualSource = await readFile("src/environment/kphxRunwayVisuals.js", "utf8");
for (const token of [
  "KPHX_RUNWAY_VISUAL_PROFILE",
  "expectedRunwayCount: 3",
  "buildIdentifier",
  "collectRunwayLights",
  "runway-threshold-green",
  "runway-end-red",
  "installKphxRunwayVisuals",
]) assert.ok(visualSource.includes(token), `KPHX runway visual source is missing ${token}`);

const groundSource = await readFile("src/environment/authoredKphxGround.js", "utf8");
for (const token of [
  'import { installKphxRunwayVisuals } from "./kphxRunwayVisuals.js";',
  "const runwayVisuals = await installKphxRunwayVisuals(THREE, authored);",
  "environment.userData.kphxRunwayCount",
  "environment.userData.kphxRunwayIdentifierCount",
  "environment.userData.kphxRunwayLightCount",
]) assert.ok(groundSource.includes(token), `KPHX prepared runtime is missing ${token}`);

console.log(`KPHX runway runtime verified: ${manifest.runways.map((runway) => `${runway.primary}/${runway.secondary} ${Math.round(runway.lengthMeters)}x${Math.round(runway.widthMeters)}m`).join(", ")}; ${manifest.counts.holdShortCount} hold shorts; ${manifest.counts.runwayMarkingElementCount} runway marking elements.`);
