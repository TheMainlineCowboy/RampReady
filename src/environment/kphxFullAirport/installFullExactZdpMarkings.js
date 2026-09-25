import { installKphxPackageOwnedSurfaceLayer } from "./installPackageOwnedSurfaceLayer.js";

export const KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY = Object.freeze({
  authority: "KPHX-1.75.1-WED-full-ZDP-markings-only-v1",
  sourceWedSha256: "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498",
  manifestUrl: "/models/kphx-full-airport/full-zdp-surfaces/manifest.json",
  networkUrl: "/models/kphx-full-airport/full-zdp-surfaces/surface-network.json",
  includeResourcePathPrefixes: Object.freeze(["ZDP_Library/markings/"]),
  expectedPolygonPlacementCount: 17,
  expectedDrapedOrthophotoPlacementCount: 955,
  expectedLinePlacementCount: 827,
  expectedPlacementCount: 1799,
  expectedUniqueResourceCount: 33,
});

export async function installKphxFullExactZdpMarkings(
  THREE,
  environment,
  {
    strict = true,
  } = {},
) {
  const result = await installKphxPackageOwnedSurfaceLayer(THREE, environment, {
    manifestUrl: KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.manifestUrl,
    networkUrl: KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.networkUrl,
    strict,
    loadPolygons: true,
    loadDrapedOrthophotos: true,
    loadLines: true,
    addOpaqueBaseUnderlay: false,
    includeResourcePathPrefixes:
      KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.includeResourcePathPrefixes,
  });

  const data = result.layer.userData;
  const polygonPlacements = data.selectedPolygonPlacementCount ?? 0;
  const orthophotoPlacements = data.selectedDrapedOrthophotoPlacementCount ?? 0;
  const linePlacements = data.selectedLinePlacementCount ?? 0;
  const totalPlacements = polygonPlacements + orthophotoPlacements + linePlacements;

  if (
    strict
    && (
      polygonPlacements !== KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedPolygonPlacementCount
      || orthophotoPlacements !== KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedDrapedOrthophotoPlacementCount
      || linePlacements !== KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedLinePlacementCount
      || totalPlacements !== KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedPlacementCount
    )
  ) {
    throw new Error(
      "Exact T4 ZDP marking coverage changed: "
      + `polygons=${polygonPlacements}/${KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedPolygonPlacementCount}, `
      + `orthos=${orthophotoPlacements}/${KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedDrapedOrthophotoPlacementCount}, `
      + `lines=${linePlacements}/${KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedLinePlacementCount}`,
    );
  }

  result.layer.name = "KPHX_T4_EXACT_ZDP_MARKINGS";
  result.layer.userData.exactZdpMarkingAuthority =
    KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.authority;
  result.layer.userData.exactZdpMarkingPlacementCount = totalPlacements;
  result.layer.userData.exactZdpMarkingExpectedUniqueResourceCount =
    KPHX_FULL_EXACT_ZDP_MARKING_AUTHORITY.expectedUniqueResourceCount;

  return result;
}
