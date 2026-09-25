import { installKphxPackageOwnedObjectLayer } from "./installPackageOwnedObjectLayer.js";

// T4 live runtime contract: 307 GateNumbers + 10 GroundMarkings = 317 exact WED placements.
export const KPHX_T4_EXACT_GATE_MARKING_AUTHORITY = Object.freeze({
  authority: "KPHX-1.75.1-WED-T4-gate-number-ground-markings-v1",
  gateNumberManifestUrl: "/models/kphx-full-airport/batches/gate-numbers.manifest.json",
  groundMarkingManifestUrl: "/models/kphx-full-airport/batches/airfield-details.manifest.json",
  bounds: Object.freeze({
    minLat: 33.43218632723751,
    maxLat: 33.43962467676249,
    minLon: -112.00394718543166,
    maxLon: -111.99217203156834,
  }),
  expectedGateNumberPlacementCount: 307,
  expectedGroundMarkingPlacementCount: 10,
  expectedPlacementCount: 317,
});

function runtimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

function insideT4(placement) {
  const b = KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.bounds;
  const lat = Number(placement.latitude);
  const lon = Number(placement.longitude);
  return Number.isFinite(lat)
    && Number.isFinite(lon)
    && lat >= b.minLat
    && lat <= b.maxLat
    && lon >= b.minLon
    && lon <= b.maxLon;
}

async function exactPlacementIds(manifestUrl, resourcePrefix) {
  const response = await fetch(runtimeUrl(manifestUrl), { cache: "no-cache" });
  if (!response.ok) throw new Error(`T4 gate-marking manifest returned HTTP ${response.status}: ${manifestUrl}`);
  const manifest = await response.json();
  if (manifest?.source?.version !== "1.75.1") {
    throw new Error(`T4 gate-marking source version changed: ${manifest?.source?.version || "missing"}`);
  }
  if ((manifest.failures || []).length) {
    throw new Error(`T4 gate-marking manifest contains ${manifest.failures.length} failures`);
  }
  return (manifest.packageOwned?.placements || [])
    .filter((placement) => placement.resourcePrefix === resourcePrefix && insideT4(placement))
    .map((placement) => String(placement.id));
}

export async function installKphxTerminal4ExactGateMarkings(
  THREE,
  environment,
  { strict = true } = {},
) {
  if (!environment?.add) throw new Error("KPHX T4 gate-marking installer requires an environment group");

  const [gateNumberIds, groundMarkingIds] = await Promise.all([
    exactPlacementIds(KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.gateNumberManifestUrl, "GateNumbers"),
    exactPlacementIds(KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.groundMarkingManifestUrl, "GroundMarkings"),
  ]);

  if (strict && gateNumberIds.length !== KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedGateNumberPlacementCount) {
    throw new Error(`Exact T4 gate-number placement count changed: ${gateNumberIds.length}/${KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedGateNumberPlacementCount}`);
  }
  if (strict && groundMarkingIds.length !== KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedGroundMarkingPlacementCount) {
    throw new Error(`Exact T4 ground-marking placement count changed: ${groundMarkingIds.length}/${KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedGroundMarkingPlacementCount}`);
  }

  const [gateNumbers, groundMarkings] = await Promise.all([
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.gateNumberManifestUrl,
      includePlacementIds: gateNumberIds,
      strict,
      assetConcurrency: 1,
    }),
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.groundMarkingManifestUrl,
      includePlacementIds: groundMarkingIds,
      strict,
      assetConcurrency: 4,
    }),
  ]);

  gateNumbers.layer.name = "KPHX_T4_EXACT_GATE_NUMBERS";
  groundMarkings.layer.name = "KPHX_T4_EXACT_GROUND_MARKINGS";

  const gateNumberPlacementCount = gateNumbers.layer.userData.loadedPlacementCount;
  const groundMarkingPlacementCount = groundMarkings.layer.userData.loadedPlacementCount;
  const loadedPlacementCount = gateNumberPlacementCount + groundMarkingPlacementCount;
  const ready = gateNumbers.ready
    && groundMarkings.ready
    && loadedPlacementCount === KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedPlacementCount;

  if (strict && !ready) {
    throw new Error(`Exact T4 gate markings incomplete: ${loadedPlacementCount}/${KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.expectedPlacementCount}`);
  }

  const summary = Object.freeze({
    authority: KPHX_T4_EXACT_GATE_MARKING_AUTHORITY.authority,
    gateNumberPlacementCount,
    groundMarkingPlacementCount,
    loadedPlacementCount,
    ready,
  });

  environment.userData = {
    ...(environment.userData || {}),
    kphxTerminal4ExactGateMarkings: summary,
  };

  return { gateNumbers, groundMarkings, summary };
}
