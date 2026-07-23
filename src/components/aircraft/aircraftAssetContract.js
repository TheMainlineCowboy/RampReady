export const CRJ700_ASSET_CONTRACT_VERSION = 1;

export const CRJ700_EXPECTED_DIMENSIONS = Object.freeze({
  lengthMeters: 32.5,
  wingspanMeters: 23.64,
  toleranceMeters: 1.25,
});

export const CRJ700_ASSET_CANDIDATES = Object.freeze([
  Object.freeze({
    id: "user-painted-crj700",
    url: "models/crj700-user.glb",
    metadataUrl: "models/crj700-user.asset.json",
    preserveMaterials: true,
    priority: 100,
  }),
  Object.freeze({
    id: "prepared-crj700-fallback",
    url: "models/crj700-mobile.glb",
    metadataUrl: null,
    preserveMaterials: false,
    priority: 10,
  }),
]);

function finitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

export function dimensionWithinTolerance(actual, expected, tolerance = CRJ700_EXPECTED_DIMENSIONS.toleranceMeters) {
  return finitePositive(actual) && finitePositive(expected) && Number.isFinite(tolerance)
    && tolerance >= 0 && Math.abs(actual - expected) <= tolerance;
}

export function validateAircraftAssetMetadata(metadata) {
  const failures = [];
  if (!metadata || typeof metadata !== "object") return { valid: false, failures: ["metadata must be an object"] };
  if (metadata.contractVersion !== CRJ700_ASSET_CONTRACT_VERSION) failures.push("unsupported contractVersion");
  if (metadata.aircraftType !== "CRJ700") failures.push("aircraftType must be CRJ700");
  if (typeof metadata.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(metadata.sha256)) failures.push("sha256 must be a 64-character hexadecimal digest");
  if (metadata.orientation?.up !== "+Y" || metadata.orientation?.forward !== "-Z") failures.push("orientation must be +Y up and -Z forward");
  if (!dimensionWithinTolerance(metadata.dimensionsMeters?.length, CRJ700_EXPECTED_DIMENSIONS.lengthMeters)) failures.push("length is outside CRJ700 tolerance");
  if (!dimensionWithinTolerance(metadata.dimensionsMeters?.wingspan, CRJ700_EXPECTED_DIMENSIONS.wingspanMeters)) failures.push("wingspan is outside CRJ700 tolerance");
  if (!Array.isArray(metadata.noseGearCaptureOrigin) || metadata.noseGearCaptureOrigin.length !== 3 || !metadata.noseGearCaptureOrigin.every(Number.isFinite)) failures.push("noseGearCaptureOrigin must contain three finite coordinates");
  if (metadata.preserveMaterials !== true) failures.push("user-painted asset must preserve authored materials");
  return { valid: failures.length === 0, failures };
}

export function resolveAircraftAssetCandidates(baseUri = document.baseURI) {
  return [...CRJ700_ASSET_CANDIDATES]
    .sort((a, b) => b.priority - a.priority)
    .map((candidate) => ({
      ...candidate,
      resolvedUrl: new URL(candidate.url, baseUri).href,
      resolvedMetadataUrl: candidate.metadataUrl ? new URL(candidate.metadataUrl, baseUri).href : null,
    }));
}

export async function probeAircraftAssetCandidate(candidate, fetchImpl = fetch) {
  if (!candidate?.resolvedUrl) return { available: false, reason: "missing resolvedUrl" };
  if (!candidate.resolvedMetadataUrl) return { available: true, metadata: null, candidate };
  try {
    const response = await fetchImpl(candidate.resolvedMetadataUrl, { cache: "no-store" });
    if (!response.ok) return { available: false, reason: `metadata HTTP ${response.status}`, candidate };
    const metadata = await response.json();
    const validation = validateAircraftAssetMetadata(metadata);
    if (!validation.valid) return { available: false, reason: validation.failures.join("; "), metadata, candidate };
    return { available: true, metadata, candidate };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error), candidate };
  }
}

export async function selectAircraftAssetCandidate({ baseUri = document.baseURI, fetchImpl = fetch } = {}) {
  const attempts = [];
  for (const candidate of resolveAircraftAssetCandidates(baseUri)) {
    const result = await probeAircraftAssetCandidate(candidate, fetchImpl);
    attempts.push(result);
    if (result.available) return { ...result, attempts };
  }
  return { available: false, reason: "no aircraft asset candidate available", attempts };
}
