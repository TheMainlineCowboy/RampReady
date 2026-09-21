import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "./sourceAuthority.js";

const DEFAULT_MANIFEST_URL = "/models/kphx-full-airport/manifest.json";

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function preparePlacementRoot(root, placement) {
  const position = kphxWedToRampReadyPosition(
    placement.latitude,
    placement.longitude,
    placement.customMsl ? placement.mslMeters : 0,
  );
  const yaw = kphxXPlaneHeadingToRampReadyYawRadians(placement.headingDegrees);

  root.name = `KPHX_FULL_${placement.name || placement.resource}`;
  root.position.set(position[0], position[1], position[2]);
  root.rotation.set(0, yaw, 0);
  root.updateMatrixWorld(true);
  root.userData = {
    ...(root.userData || {}),
    kphxFullAirport: true,
    sourcePackage: KPHX_FULL_AIRPORT_SOURCE.packageName,
    sourceVersion: KPHX_FULL_AIRPORT_SOURCE.packageVersion,
    sourceResource: placement.resource,
    wedObjectId: placement.id,
    wedLatitude: placement.latitude,
    wedLongitude: placement.longitude,
    wedHeadingDegrees: placement.headingDegrees,
    runtimePosition: position,
    runtimeYawRadians: yaw,
  };

  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData = {
      ...(node.userData || {}),
      kphxFullAirport: true,
      sourceResource: placement.resource,
      wedObjectId: placement.id,
    };
  });

  return root;
}

export async function installKphxPackageOwnedObjectLayer(
  THREE,
  environment,
  {
    manifestUrl = DEFAULT_MANIFEST_URL,
    loader = new GLTFLoader(),
    strict = true,
    resourcePrefixes = null,
    assetConcurrency = 6,
  } = {},
) {
  if (!environment?.add) throw new Error("KPHX full-airport loader requires a Three.js environment group");

  const response = await fetch(manifestUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`KPHX runtime manifest returned HTTP ${response.status}: ${manifestUrl}`);
  const manifest = await response.json();

  if (manifest?.source?.version !== KPHX_FULL_AIRPORT_SOURCE.packageVersion) {
    throw new Error(`KPHX runtime/source version mismatch: expected ${KPHX_FULL_AIRPORT_SOURCE.packageVersion}, got ${manifest?.source?.version || "unknown"}`);
  }
  if (strict && manifest.failures?.length) {
    throw new Error(`KPHX runtime manifest is incomplete: ${manifest.failures.length} materialization failures`);
  }

  const allowedPrefixes = resourcePrefixes ? new Set(resourcePrefixes) : null;
  const placements = (manifest.packageOwned?.placements || []).filter((placement) => {
    if (!allowedPrefixes) return true;
    return allowedPrefixes.has(placement.resourcePrefix);
  });
  const assetUrls = [...new Set(placements.map((placement) => placement.assetUrl))];

  const templates = new Map();
  const assetFailures = [];
  await mapWithConcurrency(assetUrls, Math.max(1, assetConcurrency), async (assetUrl) => {
    try {
      const gltf = await loader.loadAsync(assetUrl);
      if (!gltf?.scene) throw new Error("glTF loaded without a scene root");
      templates.set(assetUrl, gltf.scene);
    } catch (error) {
      assetFailures.push({
        assetUrl,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  if (strict && assetFailures.length) {
    throw new Error(`KPHX object layer asset loading failed for ${assetFailures.length} unique resources`);
  }

  const layer = new THREE.Group();
  layer.name = "KPHX_FULL_AIRPORT_PACKAGE_OWNED";
  layer.userData = {
    kphxFullAirport: true,
    sourceVersion: manifest.source.version,
    manifestUrl,
    expectedPlacementCount: placements.length,
    uniqueAssetCount: assetUrls.length,
    loadedUniqueAssetCount: templates.size,
    assetFailures,
  };

  const placementFailures = [];
  let loadedPlacementCount = 0;
  for (const placement of placements) {
    const template = templates.get(placement.assetUrl);
    if (!template) {
      placementFailures.push({
        wedObjectId: placement.id,
        sourceResource: placement.resource,
        assetUrl: placement.assetUrl,
        message: "Source template was not loaded",
      });
      continue;
    }
    const instance = preparePlacementRoot(template.clone(true), placement);
    layer.add(instance);
    loadedPlacementCount += 1;
  }

  layer.userData.loadedPlacementCount = loadedPlacementCount;
  layer.userData.placementFailures = placementFailures;
  layer.userData.ready = (
    assetFailures.length === 0
    && placementFailures.length === 0
    && loadedPlacementCount === placements.length
  );

  if (strict && !layer.userData.ready) {
    throw new Error(`KPHX package-owned object layer incomplete: ${loadedPlacementCount}/${placements.length} placements loaded`);
  }

  environment.add(layer);
  environment.userData = {
    ...(environment.userData || {}),
    kphxFullAirportPackageOwned: {
      ready: layer.userData.ready,
      sourceVersion: manifest.source.version,
      expectedPlacementCount: placements.length,
      loadedPlacementCount,
      uniqueAssetCount: assetUrls.length,
      loadedUniqueAssetCount: templates.size,
      externalLibraryPlacementCount: manifest.externalLibraries?.placementCount || 0,
      externalLibraryUniqueResourceCount: manifest.externalLibraries?.uniqueResourceCount || 0,
    },
  };

  return {
    layer,
    manifest,
    ready: layer.userData.ready,
    assetFailures,
    placementFailures,
  };
}
