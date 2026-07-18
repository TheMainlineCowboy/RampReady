import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const intakeUrl = new URL("../docs/assets/lektro-scan-source-intake.json", import.meta.url);
const manifestUrl = new URL("../docs/assets/lektro-scan-manifest.json", import.meta.url);

const intake = JSON.parse(await readFile(intakeUrl, "utf8"));
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

assert.equal(intake.schemaVersion, 1);
assert.equal(intake.asset, manifest.asset);
assert.equal(intake.sourceArchive, manifest.sourceArchive);
assert.equal(intake.status, "awaiting-source-bytes");
assert.equal(intake.runtimeUseAllowed, false);
assert.ok(intake.preservationDirectory.startsWith("source-assets/"));
assert.ok(!intake.preservationDirectory.startsWith("public/"));
assert.equal(intake.runtimeDirectory, "public/models/lektro/");

const requiredNames = intake.requiredFiles.map((file) => file.name);
assert.deepEqual(requiredNames, manifest.sourceFiles);
assert.ok(intake.requiredFiles.every((file) => file.required === true));
assert.ok(intake.requiredFiles.every((file) => Number.isInteger(file.minimumBytes) && file.minimumBytes > 0));

assert.equal(intake.expectedInspection.vertices, manifest.source.vertices);
assert.equal(intake.expectedInspection.triangles, manifest.source.triangles);
assert.equal(intake.expectedInspection.textureWidth, manifest.source.texture.width);
assert.equal(intake.expectedInspection.textureHeight, manifest.source.texture.height);
assert.deepEqual(intake.expectedInspection.rawExtents, manifest.source.bounds.extents);
assert.ok(intake.expectedInspection.numericTolerance.meshCountsPercent <= 0.5);
assert.ok(intake.expectedInspection.numericTolerance.boundsPercent <= 1.0);

assert.ok(intake.intakeRules.some((rule) => rule.includes("cryptographic digests")));
assert.ok(intake.intakeRules.some((rule) => rule.includes("connected-component analysis")));
assert.ok(intake.intakeRules.some((rule) => rule.includes("do not copy raw OBJ")));
assert.ok(intake.intakeRules.some((rule) => rule.includes("do not mark isolate-tug unblocked")));
assert.ok(intake.requiredOutputsAfterStaging.includes("source-assets/lektro/kiri-raw/SHA256SUMS"));
assert.ok(intake.requiredOutputsAfterStaging.includes("artifacts/lektro-scan/source-intake-report.json"));
assert.ok(intake.requiredOutputsAfterStaging.includes("artifacts/lektro-scan/connected-components.json"));

console.log("Verified KIRI scan source intake gate and preservation contract.");
