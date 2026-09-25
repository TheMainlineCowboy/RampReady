import { installKphxPackageOwnedObjectLayer } from "./installPackageOwnedObjectLayer.js";
import { KPHX_T4_EXACT_STATIC_PROP_AUTHORITY } from "./terminal4StaticPropAuthority.js";

export async function installKphxTerminal4ExactStaticProps(
  THREE,
  environment,
  {
    strict = true,
    assetConcurrency = 4,
    includeZdpStopMarkers = false,
  } = {},
) {
  if (!environment?.add) {
    throw new Error("KPHX T4 exact static-prop installer requires a Three.js environment group");
  }

  const misterXResources = [
    ...KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXRamps.resources,
    ...KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXConstruction.resources,
  ];

  const zdpPromise = includeZdpStopMarkers
    ? installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.manifestUrl,
      includeResources: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.resources,
      strict,
      assetConcurrency: Math.min(2, assetConcurrency),
    })
    : Promise.resolve(null);

  const [lights, misterX, zdp] = await Promise.all([
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.manifestUrl,
      includeResources: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.resources,
      includePlacementIds: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.placementIds,
      strict,
      assetConcurrency: Math.min(2, assetConcurrency),
    }),
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXRamps.manifestUrl,
      includeResources: misterXResources,
      strict,
      assetConcurrency,
    }),
    zdpPromise,
  ]);

  const lightCount = lights.layer.userData.loadedPlacementCount;
  const misterXCount = misterX.layer.userData.loadedPlacementCount;
  const zdpCount = zdp?.layer?.userData?.loadedPlacementCount ?? 0;
  const expectedZdpCount = includeZdpStopMarkers
    ? KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.expectedPlacementCount
    : 0;
  const expectedTotal =
    KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.expectedPlacementCount
    + KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXRamps.expectedPlacementCount
    + KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXConstruction.expectedPlacementCount
    + expectedZdpCount;
  const total = lightCount + misterXCount + zdpCount;

  if (strict && lightCount !== KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.expectedPlacementCount) {
    throw new Error(
      `Exact T4 light props incomplete: ${lightCount}/${KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.packageLights.expectedPlacementCount}`,
    );
  }
  const expectedMisterX =
    KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXRamps.expectedPlacementCount
    + KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXConstruction.expectedPlacementCount;
  if (strict && misterXCount !== expectedMisterX) {
    throw new Error(`Exact T4 MisterX static props incomplete: ${misterXCount}/${expectedMisterX}`);
  }
  if (strict && zdpCount !== expectedZdpCount) {
    throw new Error(
      `Exact T4 ZDP stop markers incomplete: ${zdpCount}/${expectedZdpCount}`,
    );
  }
  if (strict && total !== expectedTotal) {
    throw new Error(
      `Exact T4 authored static props incomplete: ${total}/${expectedTotal}`,
    );
  }

  lights.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_LIGHTS";
  misterX.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_MISTERX";
  if (zdp?.layer) zdp.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_ZDP";

  const summary = Object.freeze({
    authority: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.authority,
    fullSourcePlacementCount: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedPlacementCount,
    expectedPlacementCount: expectedTotal,
    loadedPlacementCount: total,
    expectedUniqueResourceCount: includeZdpStopMarkers
      ? KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedUniqueResourceCount
      : KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedUniqueResourceCount
        - KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.expectedUniqueResourceCount,
    lightPlacementCount: lightCount,
    misterXPlacementCount: misterXCount,
    zdpPlacementCount: zdpCount,
    deferredZdpStopMarkerPlacementCount: includeZdpStopMarkers
      ? 0
      : KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.expectedPlacementCount,
    ready:
      lights.ready
      && misterX.ready
      && (!includeZdpStopMarkers || zdp?.ready === true)
      && total === expectedTotal,
  });

  environment.userData = {
    ...(environment.userData || {}),
    kphxTerminal4ExactStaticProps: summary,
  };

  return {
    lights,
    misterX,
    zdp,
    summary,
  };
}
