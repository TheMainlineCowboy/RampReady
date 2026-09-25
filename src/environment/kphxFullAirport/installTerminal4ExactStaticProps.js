import { installKphxPackageOwnedObjectLayer } from "./installPackageOwnedObjectLayer.js";
import { KPHX_T4_EXACT_STATIC_PROP_AUTHORITY } from "./terminal4StaticPropAuthority.js";

export async function installKphxTerminal4ExactStaticProps(
  THREE,
  environment,
  {
    strict = true,
    assetConcurrency = 4,
  } = {},
) {
  if (!environment?.add) {
    throw new Error("KPHX T4 exact static-prop installer requires a Three.js environment group");
  }

  const misterXResources = [
    ...KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXRamps.resources,
    ...KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.misterXConstruction.resources,
  ];

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
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.manifestUrl,
      includeResources: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.resources,
      strict,
      assetConcurrency: Math.min(2, assetConcurrency),
    }),
  ]);

  const lightCount = lights.layer.userData.loadedPlacementCount;
  const misterXCount = misterX.layer.userData.loadedPlacementCount;
  const zdpCount = zdp.layer.userData.loadedPlacementCount;
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
  if (strict && zdpCount !== KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.expectedPlacementCount) {
    throw new Error(
      `Exact T4 ZDP stop markers incomplete: ${zdpCount}/${KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.zdpStopMarkers.expectedPlacementCount}`,
    );
  }
  if (strict && total !== KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedPlacementCount) {
    throw new Error(
      `Exact T4 authored static props incomplete: ${total}/${KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedPlacementCount}`,
    );
  }

  lights.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_LIGHTS";
  misterX.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_MISTERX";
  zdp.layer.name = "KPHX_T4_EXACT_STATIC_PROPS_ZDP";

  const summary = Object.freeze({
    authority: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.authority,
    expectedPlacementCount: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedPlacementCount,
    loadedPlacementCount: total,
    expectedUniqueResourceCount: KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedUniqueResourceCount,
    lightPlacementCount: lightCount,
    misterXPlacementCount: misterXCount,
    zdpPlacementCount: zdpCount,
    ready:
      lights.ready
      && misterX.ready
      && zdp.ready
      && total === KPHX_T4_EXACT_STATIC_PROP_AUTHORITY.expectedPlacementCount,
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
