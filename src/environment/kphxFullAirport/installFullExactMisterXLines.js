import { installKphxPackageOwnedSurfaceLayer } from "./installPackageOwnedSurfaceLayer.js";

export const KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY = Object.freeze({
  authority: "KPHX-1.75.1-WED-full-MisterX-taxilines-v1",
  manifestUrl: "/models/kphx-full-airport/surface-batches/misterx/manifest.json",
  networkUrl: "/models/kphx-full-airport/surface-batches/misterx/surface-network.json",
  includeResourcePathPrefixes: Object.freeze(["MisterX_Library/Airport/Taxilines/"]),
  expectedLinePlacementCount: 65,
  expectedTerminal4LinePlacementCount: 22,
  terminal4Bounds: Object.freeze({
    minLat: 33.43218632723751,
    maxLat: 33.43962467676249,
    minLon: -112.00394718543166,
    maxLon: -111.99217203156834,
  }),
});

function lineIntersectsTerminal4Bounds(line) {
  const bounds = KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.terminal4Bounds;
  return (line?.nodes || []).some((node) => {
    const lat = Number(node.latitude);
    const lon = Number(node.longitude);
    return Number.isFinite(lat)
      && Number.isFinite(lon)
      && lat >= bounds.minLat
      && lat <= bounds.maxLat
      && lon >= bounds.minLon
      && lon <= bounds.maxLon;
  });
}

export async function installKphxFullExactMisterXLines(
  THREE,
  environment,
  {
    strict = true,
  } = {},
) {
  const result = await installKphxPackageOwnedSurfaceLayer(THREE, environment, {
    manifestUrl: KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.manifestUrl,
    networkUrl: KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.networkUrl,
    strict,
    loadPolygons: false,
    loadDrapedOrthophotos: false,
    loadLines: true,
    addOpaqueBaseUnderlay: false,
    includeResourcePathPrefixes:
      KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.includeResourcePathPrefixes,
  });

  const data = result.layer.userData;
  const linePlacements = data.selectedLinePlacementCount ?? 0;
  const terminal4LinePlacements = (result.network.lines || [])
    .filter((entry) => String(entry.resource || "").startsWith("MisterX_Library/Airport/Taxilines/"))
    .filter(lineIntersectsTerminal4Bounds)
    .length;

  if (
    strict
    && (
      linePlacements !== KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.expectedLinePlacementCount
      || terminal4LinePlacements !== KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.expectedTerminal4LinePlacementCount
    )
  ) {
    throw new Error(
      "Exact MisterX line coverage changed: "
      + `lines=${linePlacements}/${KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.expectedLinePlacementCount}, `
      + `t4=${terminal4LinePlacements}/${KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.expectedTerminal4LinePlacementCount}`,
    );
  }

  result.layer.name = "KPHX_FULL_EXACT_MISTERX_LINES";
  result.layer.userData.exactMisterXLineAuthority =
    KPHX_FULL_EXACT_MISTERX_LINE_AUTHORITY.authority;
  result.layer.userData.exactMisterXLinePlacementCount = linePlacements;
  result.layer.userData.exactMisterXTerminal4LinePlacementCount = terminal4LinePlacements;
  return result;
}
