import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const contractUrl = new URL("../docs/crj900-authored-aircraft-source.json", import.meta.url);
const converterUrl = new URL("../tools/aircraft/convert-authored-crj900.mjs", import.meta.url);
const contract = JSON.parse(await readFile(contractUrl, "utf8"));
const converter = await readFile(converterUrl, "utf8");

assert.equal(contract.contractVersion, 1);
assert.equal(contract.status, "preferred-authored-aircraft-source");
assert.equal(contract.sourceArchive.fileName, "American-Eagle-CRJ-900 (1).zip");
assert.match(contract.sourceArchive.sha256, /^[a-f0-9]{64}$/);
assert.equal(contract.sourceModel.aircraftType, "CRJ900");
assert.equal(contract.sourceModel.vertexRecords, 123105);
assert.equal(contract.sourceModel.normalRecords, 123105);
assert.equal(contract.sourceModel.texcoordRecords, 32484);
assert.equal(contract.sourceModel.objectCount, 190);
assert.equal(contract.sourceModel.triangleCount, 41035);
assert.equal(contract.sourceModel.materialCount, 106);
assert.equal(contract.sourceModel.textureCount, 9);

assert.deepEqual(contract.normalizationContract.orientation, { up: "+Y", forward: "-Z" });
assert.equal(contract.normalizationContract.rotationDegreesY, 180);
assert.deepEqual(contract.normalizationContract.noseGearCaptureOrigin, [0, 0, 0]);
assert.deepEqual(contract.normalizationContract.dimensionsMeters, {
  length: 32.5,
  wingspan: 23.64,
  height: 7.5,
});
assert.equal(contract.normalizationContract.preserveAuthoredMaterials, true);
assert.equal(contract.normalizationContract.runtimePath, "public/models/crj700-user.glb");
assert.equal(contract.normalizationContract.metadataPath, "public/models/crj700-user.asset.json");

assert.equal(contract.validatedCandidate.byteLength, 1873128);
assert.equal(contract.validatedCandidate.sha256, "01383b502fa9a5e0aca3b5cc4a90b5ffe82d52160778bc309e2de73579b1056b");
assert.equal(contract.validatedCandidate.meshCount, 106);
assert.equal(contract.validatedCandidate.materialCount, 106);
assert.equal(contract.validatedCandidate.textureCount, 9);
assert.equal(contract.validatedCandidate.vertexCount, 44784);
assert.equal(contract.validatedCandidate.triangleCount, 41035);
assert.equal(contract.validatedCandidate.embeddedImages, true);
assert.equal(contract.validatedCandidate.quantized, false);
assert.equal(contract.validatedCandidate.normalsGeneratedAtRuntime, true);

for (const required of [
  "American+Eagle+CRJ+900.obj",
  "American+Eagle+CRJ+900.mtl",
  "123105",
  "32484",
  "41035",
  "44784",
  "23.64",
  "32.5",
  "7.5",
  "noseGearCaptureOrigin: [0, 0, 0]",
  "preserveMaterials: true",
  "normalsGeneratedAtRuntime: true",
  "Unexpected optimized vertex count",
]) {
  assert.ok(converter.includes(required), `authored aircraft converter missing ${required}`);
}
assert.ok(converter.includes("-(sourcePosition[0] - NOSE[0])"), "converter must rotate source 180 degrees around +Y");
assert.ok(converter.includes("-(sourcePosition[2] - NOSE[2])"), "converter must set -Z forward orientation");
assert.ok(converter.includes("(sourcePosition[1] - GROUND_Y)"), "converter must place the aircraft on the ground plane");
assert.ok(converter.includes("baseColorTexture"), "converter must preserve authored texture assignments");
assert.ok(converter.includes("image/png"), "converter must embed the nine supplied PNG textures");
assert.ok(converter.includes("value.toFixed(6)"), "converter must deduplicate equivalent position/UV vertices deterministically");
assert.ok(!converter.includes("attributes.NORMAL"), "converter must not preserve source index-fragmented normals after position/UV deduplication");

for (const requiredView of [
  "front-left",
  "front-right",
  "left-side",
  "right-side",
  "rear",
  "top",
  "nose-gear-close-up",
]) {
  assert.ok(contract.acceptance.requiredViews.includes(requiredView), `missing QA view ${requiredView}`);
}

for (const forbidden of [
  "floating livery planes",
  "floating livery boxes",
  "procedural aircraft body after successful authored-model load",
  "fallback livery shader on authored materials",
]) {
  assert.ok(contract.acceptance.forbiddenRuntimeFallbacks.includes(forbidden), `missing forbidden runtime fallback ${forbidden}`);
}

console.log("Authored CRJ900 source contract passed: exact source identity, deterministic 44,784-vertex conversion, normalized dimensions/orientation, material preservation, and required Three.js QA views are locked.");
