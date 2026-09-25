import fs from "node:fs";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));

const FULL_REPORT = "reports/kphx-full-airport-wed-placements-exact.json";
const T4_REPORT = "reports/kphx-t4-wed-object-authority.json";
const MX_RESOURCES = "reports/kphx-full-misterx-object-resources.json";
const CDB_RESOURCES = "reports/kphx-full-cdb-object-resources.json";
const ZDP_RESOURCES = "reports/kphx-full-zdp-object-resources.json";
const FEDEX_AGP_MANIFEST = "public/models/kphx-full-airport/batches/full-misterx-fedex-truck-agp.manifest.json";
const LIVE_T4_INSTALLER = "src/environment/kphxFullAirport/installLiveTerminal4Exact.js";
const OUTPUT = "reports/kphx-static-placement-runtime-inventory.json";

const EXPECTED_WED_SHA = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";
const LIVE_T4_RESOURCES = new Set([
  "Terminals/Terminal4.obj",
  "Terminals/Terminal4b.obj",
]);

const full = readJson(FULL_REPORT);
const t4 = readJson(T4_REPORT);
const mxResources = readJson(MX_RESOURCES);
const cdbResources = readJson(CDB_RESOURCES);
const zdpResources = readJson(ZDP_RESOURCES);
const fedexAgp = readJson(FEDEX_AGP_MANIFEST);
const liveInstaller = fs.readFileSync(LIVE_T4_INSTALLER, "utf8");

if (full?.source?.wedSha256 !== EXPECTED_WED_SHA) {
  throw new Error("Full KPHX placement report WED hash changed");
}
if (t4?.source?.wedSha256 !== EXPECTED_WED_SHA) {
  throw new Error("T4 placement report WED hash changed");
}
for (const resource of LIVE_T4_RESOURCES) {
  if (!liveInstaller.includes(`"${resource}"`)) {
    throw new Error(`Live T4 loader no longer explicitly includes ${resource}`);
  }
}

const fullPlacements = [
  ...(full.placements?.packageOwned || []),
  ...(full.placements?.externalLibraries || []),
];
const t4Placements = [
  ...(t4.placements?.packageOwned || []),
  ...(t4.placements?.externalLibraries || []),
];

const objectResourceSet = (report) => new Set(
  (report.resources || [])
    .map((entry) => typeof entry === "string"
      ? entry
      : entry.resource || entry.sourceResource || entry.path)
    .filter(Boolean),
);

const mxMaterializedResources = objectResourceSet(mxResources);
const cdbMaterializedResources = objectResourceSet(cdbResources);
const zdpMaterializedResources = objectResourceSet(zdpResources);
const fedexAgpResource = fedexAgp.resource;
const fedexAgpPlacementIds = new Set((fedexAgp.placements || []).map((entry) => String(entry.id)));

const packageOwnedMaterializedPrefixes = new Set([
  "GateNumbers",
  "Lights",
  "GroundMarkings",
  "CargoBuildings",
  "Runways",
  "Downtown",
  "StaticAircraft",
  "Vehicles",
  "ParkingGarages",
  "Misc",
  "Terminals",
  "Construction",
  "SkyTrain",
]);

function fullMaterialization(placement) {
  if (packageOwnedMaterializedPrefixes.has(placement.resourcePrefix)) {
    return { status: "materialized", authority: "package-owned exact batch manifests" };
  }
  if (placement.resourcePrefix === "MisterX_Library") {
    if (mxMaterializedResources.has(placement.resource)) {
      return { status: "materialized", authority: MX_RESOURCES };
    }
    if (
      placement.resource === fedexAgpResource
      && fedexAgpPlacementIds.has(String(placement.id))
    ) {
      return { status: "materialized", authority: FEDEX_AGP_MANIFEST };
    }
    return { status: "unresolved-dependency", authority: MX_RESOURCES };
  }
  if (placement.resourcePrefix === "CDB-Library") {
    return cdbMaterializedResources.has(placement.resource)
      ? { status: "materialized", authority: CDB_RESOURCES }
      : { status: "unresolved-dependency", authority: CDB_RESOURCES };
  }
  if (placement.resourcePrefix === "ZDP_Library") {
    return zdpMaterializedResources.has(placement.resource)
      ? { status: "materialized", authority: ZDP_RESOURCES }
      : { status: "unresolved-dependency", authority: ZDP_RESOURCES };
  }
  return { status: "unresolved-dependency", authority: "dependency not materialized in exact runtime" };
}

function t4Category(placement) {
  const resource = placement.resource;
  if (resource.startsWith("MisterX_Library/Airport/Vehicles/")) return "MisterX Airport/Vehicles";
  if (resource.startsWith("MisterX_Library/Airport/Ramps/")) return "MisterX Airport/Ramps";
  if (resource.startsWith("MisterX_Library/Airport/Aircraft/")) return "MisterX Airport/Aircraft";
  if (resource.startsWith("MisterX_Library/People/")) return "MisterX People";
  if (resource.startsWith("MisterX_Library/Vehicles/")) return "MisterX Vehicles";
  if (resource.startsWith("MisterX_Library/Objects/Construction/")) return "MisterX Construction";
  if (resource.startsWith("CDB-Library/")) return "CDB";
  if (resource.startsWith("ZDP_Library/")) return "ZDP";
  if (resource.startsWith("lib/")) return "Laminar lib";
  if (resource.startsWith("opensceneryx/")) return "OpenSceneryX";
  if (resource.startsWith("Lights/")) return "Package Lights";
  if (resource.startsWith("Terminals/")) return "Package Terminals";
  return "Other";
}

const summarize = (placements, keyFn) => {
  const map = new Map();
  for (const placement of placements) {
    const key = keyFn(placement);
    const row = map.get(key) || { placements: 0, resources: new Set() };
    row.placements += 1;
    row.resources.add(placement.resource);
    map.set(key, row);
  }
  return [...map.entries()]
    .map(([key, row]) => ({
      key,
      placements: row.placements,
      uniqueResources: row.resources.size,
    }))
    .sort((a, b) => b.placements - a.placements || a.key.localeCompare(b.key));
};

const fullStatusRows = fullPlacements.map((placement) => ({
  ...placement,
  ...fullMaterialization(placement),
}));
const fullMaterialized = fullStatusRows.filter((entry) => entry.status === "materialized");
const fullUnresolved = fullStatusRows.filter((entry) => entry.status === "unresolved-dependency");

const t4Rows = t4Placements.map((placement) => {
  const materialization = fullMaterialization(placement);
  const loadedLive = LIVE_T4_RESOURCES.has(placement.resource);
  return {
    ...placement,
    category: t4Category(placement),
    materializationStatus: materialization.status,
    materializationAuthority: materialization.authority,
    runtimeStatus: loadedLive
      ? "loaded-live"
      : materialization.status === "materialized"
        ? "materialized-not-loaded-live"
        : "unresolved-dependency",
  };
});

const t4Loaded = t4Rows.filter((entry) => entry.runtimeStatus === "loaded-live");
const t4Omitted = t4Rows.filter((entry) => entry.runtimeStatus === "materialized-not-loaded-live");
const t4Unresolved = t4Rows.filter((entry) => entry.runtimeStatus === "unresolved-dependency");

const t4Gse = t4Rows.filter((entry) =>
  entry.category === "MisterX Airport/Vehicles"
  || entry.category === "MisterX Vehicles"
  || entry.category === "CDB"
);

const unresolvedResourceSummary = summarize(fullUnresolved, (entry) => entry.resource)
  .map((row) => ({
    resource: row.key,
    placements: row.placements,
    dependencyPrefix: row.key.split("/")[0],
  }));

const t4UnresolvedResourceSummary = summarize(t4Unresolved, (entry) => entry.resource)
  .map((row) => ({
    resource: row.key,
    placements: row.placements,
    dependencyPrefix: row.key.split("/")[0],
  }));

const report = {
  schemaVersion: 1,
  status: "PASS",
  authority: {
    kphxVersion: "1.75.1",
    wedSha256: EXPECTED_WED_SHA,
    fullPlacementReport: FULL_REPORT,
    terminal4PlacementReport: T4_REPORT,
    liveTerminal4Installer: LIVE_T4_INSTALLER,
  },
  fullAirport: {
    authoredObjectPlacements: fullPlacements.length,
    authoredUniqueResources:
      full.packageOwned.uniqueResourceCount + full.externalLibraries.uniqueResourceCount,
    materializedPlacements: fullMaterialized.length,
    unresolvedDependencyPlacements: fullUnresolved.length,
    authoredByPrefix: summarize(fullPlacements, (entry) => entry.resourcePrefix)
      .map((row) => ({
        prefix: row.key,
        authoredPlacements: row.placements,
        uniqueResources: row.uniqueResources,
      })),
    statusByPrefix: summarize(fullStatusRows, (entry) =>
      `${entry.resourcePrefix}|${entry.status}`)
      .map((row) => {
        const [prefix, status] = row.key.split("|");
        return {
          prefix,
          status,
          placements: row.placements,
          uniqueResources: row.uniqueResources,
        };
      }),
    unresolvedResources: unresolvedResourceSummary,
  },
  terminal4: {
    authoredObjectPlacements: t4Rows.length,
    authoredUniqueResources: t4.totals.uniqueResourceCount,
    exactMaterializedPlacements:
      t4Rows.filter((entry) => entry.materializationStatus === "materialized").length,
    liveLoadedObjectPlacements: t4Loaded.length,
    materializedButNotLoadedObjectPlacements: t4Omitted.length,
    unresolvedDependencyPlacements: t4Unresolved.length,
    liveLoadedResources: [...LIVE_T4_RESOURCES],
    liveLoadedJetwayFacades: 76,
    categoryInventory: summarize(t4Rows, (entry) =>
      `${entry.category}|${entry.runtimeStatus}`)
      .map((row) => {
        const [category, runtimeStatus] = row.key.split("|");
        return {
          category,
          runtimeStatus,
          placements: row.placements,
          uniqueResources: row.uniqueResources,
        };
      }),
    exactGseReadyForImport: {
      placementCount: t4Gse.filter((entry) => entry.materializationStatus === "materialized").length,
      uniqueResourceCount: new Set(
        t4Gse
          .filter((entry) => entry.materializationStatus === "materialized")
          .map((entry) => entry.resource),
      ).size,
      categories: summarize(
        t4Gse.filter((entry) => entry.materializationStatus === "materialized"),
        (entry) => entry.category,
      ).map((row) => ({
        category: row.key,
        placements: row.placements,
        uniqueResources: row.uniqueResources,
      })),
    },
    unresolvedResources: t4UnresolvedResourceSummary,
    intentionallyOmittedFromCurrentLiveLoader: t4Omitted.map((entry) => ({
      id: entry.id,
      resource: entry.resource,
      category: entry.category,
      latitude: entry.latitude,
      longitude: entry.longitude,
      headingDegrees: entry.headingDegrees,
    })),
    unresolvedPlacements: t4Unresolved.map((entry) => ({
      id: entry.id,
      resource: entry.resource,
      category: entry.category,
      latitude: entry.latitude,
      longitude: entry.longitude,
      headingDegrees: entry.headingDegrees,
    })),
    note:
      "The live T4 object loader explicitly includes only Terminal4.obj and Terminal4b.obj. Jetways are exact WED facades loaded by the separate stock-jetway path and are not counted as WED object placements here.",
  },
  nextStep:
    "Import the already-materialized authored T4 GSE placements first; do not create or substitute generic GSE.",
};

if (report.fullAirport.authoredObjectPlacements !== 4691) {
  throw new Error("Full KPHX authored object placement count changed");
}
if (report.terminal4.authoredObjectPlacements !== 1086) {
  throw new Error("T4 authored object placement count changed");
}
if (report.terminal4.liveLoadedObjectPlacements !== 2) {
  throw new Error("Live T4 object loader scope changed");
}
if (report.terminal4.liveLoadedJetwayFacades !== 76) {
  throw new Error("T4 jetway count changed");
}

fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  status: report.status,
  fullAirport: {
    authored: report.fullAirport.authoredObjectPlacements,
    materialized: report.fullAirport.materializedPlacements,
    unresolved: report.fullAirport.unresolvedDependencyPlacements,
  },
  terminal4: {
    authored: report.terminal4.authoredObjectPlacements,
    loadedLive: report.terminal4.liveLoadedObjectPlacements,
    materializedNotLoaded: report.terminal4.materializedButNotLoadedObjectPlacements,
    unresolved: report.terminal4.unresolvedDependencyPlacements,
    gseReady: report.terminal4.exactGseReadyForImport,
  },
}, null, 2));
