import { installKphxPackageOwnedObjectLayer } from "./installPackageOwnedObjectLayer.js";
import { KPHX_T4_EXACT_GSE_AUTHORITY } from "./terminal4GseAuthority.js";

export async function installKphxTerminal4ExactGse(
  THREE,
  environment,
  {
    strict = true,
    assetConcurrency = 6,
  } = {},
) {
  if (!environment?.add) {
    throw new Error("KPHX T4 exact GSE installer requires a Three.js environment group");
  }

  const [misterX, cdb] = await Promise.all([
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_GSE_AUTHORITY.misterX.manifestUrl,
      includeResources: KPHX_T4_EXACT_GSE_AUTHORITY.misterX.resources,
      strict,
      assetConcurrency,
    }),
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: KPHX_T4_EXACT_GSE_AUTHORITY.cdb.manifestUrl,
      includeResources: KPHX_T4_EXACT_GSE_AUTHORITY.cdb.resources,
      strict,
      assetConcurrency: Math.min(2, assetConcurrency),
    }),
  ]);

  const misterXCount = misterX.layer.userData.loadedPlacementCount;
  const cdbCount = cdb.layer.userData.loadedPlacementCount;
  const total = misterXCount + cdbCount;

  if (strict && misterXCount !== KPHX_T4_EXACT_GSE_AUTHORITY.misterX.expectedPlacementCount) {
    throw new Error(
      `Exact T4 MisterX GSE incomplete: ${misterXCount}/${KPHX_T4_EXACT_GSE_AUTHORITY.misterX.expectedPlacementCount}`,
    );
  }
  if (strict && cdbCount !== KPHX_T4_EXACT_GSE_AUTHORITY.cdb.expectedPlacementCount) {
    throw new Error(
      `Exact T4 CDB GSE incomplete: ${cdbCount}/${KPHX_T4_EXACT_GSE_AUTHORITY.cdb.expectedPlacementCount}`,
    );
  }
  if (strict && total !== KPHX_T4_EXACT_GSE_AUTHORITY.expectedPlacementCount) {
    throw new Error(
      `Exact T4 authored GSE incomplete: ${total}/${KPHX_T4_EXACT_GSE_AUTHORITY.expectedPlacementCount}`,
    );
  }

  misterX.layer.name = "KPHX_T4_EXACT_GSE_MISTERX";
  cdb.layer.name = "KPHX_T4_EXACT_GSE_CDB";

  const summary = Object.freeze({
    authority: KPHX_T4_EXACT_GSE_AUTHORITY.authority,
    expectedPlacementCount: KPHX_T4_EXACT_GSE_AUTHORITY.expectedPlacementCount,
    loadedPlacementCount: total,
    expectedUniqueResourceCount: KPHX_T4_EXACT_GSE_AUTHORITY.expectedUniqueResourceCount,
    misterXPlacementCount: misterXCount,
    cdbPlacementCount: cdbCount,
    ready: misterX.ready && cdb.ready && total === KPHX_T4_EXACT_GSE_AUTHORITY.expectedPlacementCount,
  });

  environment.userData = {
    ...(environment.userData || {}),
    kphxTerminal4ExactGse: summary,
  };

  return {
    misterX,
    cdb,
    summary,
  };
}
