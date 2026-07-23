import assert from "node:assert/strict";
import {
  CRJ700_ASSET_CANDIDATES,
  CRJ700_ASSET_CONTRACT_VERSION,
  resolveAircraftAssetCandidates,
  selectAircraftAssetCandidate,
  validateAircraftAssetMetadata,
} from "../src/components/aircraft/aircraftAssetContract.js";

const validMetadata = {
  contractVersion: CRJ700_ASSET_CONTRACT_VERSION,
  aircraftType: "CRJ700",
  sha256: "a".repeat(64),
  dimensionsMeters: { length: 32.5, wingspan: 23.64 },
  orientation: { up: "+Y", forward: "-Z" },
  noseGearCaptureOrigin: [0, 0, 0],
  preserveMaterials: true,
};

assert.equal(validateAircraftAssetMetadata(validMetadata).valid, true);
assert.equal(validateAircraftAssetMetadata({ ...validMetadata, preserveMaterials: false }).valid, false);
assert.equal(validateAircraftAssetMetadata({ ...validMetadata, dimensionsMeters: { length: 40, wingspan: 23.64 } }).valid, false);
assert.equal(validateAircraftAssetMetadata({ ...validMetadata, orientation: { up: "+Z", forward: "+Y" } }).valid, false);

const resolved = resolveAircraftAssetCandidates("https://example.test/RampReady/");
assert.equal(resolved.length, CRJ700_ASSET_CANDIDATES.length);
assert.equal(resolved[0].id, "user-painted-crj700");
assert.equal(resolved[0].resolvedUrl, "https://example.test/RampReady/models/crj700-user.glb");
assert.equal(resolved[0].resolvedMetadataUrl, "https://example.test/RampReady/models/crj700-user.asset.json");
assert.equal(resolved.at(-1).id, "prepared-crj700-fallback");

const requests = [];
const preferred = await selectAircraftAssetCandidate({
  baseUri: "https://example.test/RampReady/",
  fetchImpl: async (url) => {
    requests.push(url);
    return { ok: true, status: 200, json: async () => validMetadata };
  },
});
assert.equal(preferred.available, true);
assert.equal(preferred.candidate.id, "user-painted-crj700");
assert.equal(preferred.metadata.preserveMaterials, true);
assert.equal(requests.length, 1);

const fallback = await selectAircraftAssetCandidate({
  baseUri: "https://example.test/RampReady/",
  fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }),
});
assert.equal(fallback.available, true);
assert.equal(fallback.candidate.id, "prepared-crj700-fallback");
assert.equal(fallback.attempts[0].available, false);
assert.equal(fallback.attempts[1].available, true);

console.log("Aircraft hot-swap contract verification passed: authored user GLB is preferred, validated, material-preserving, and safely falls back to the prepared CRJ700 asset.");
