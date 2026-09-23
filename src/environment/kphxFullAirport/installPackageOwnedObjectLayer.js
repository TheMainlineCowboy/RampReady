import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { applyExactXp11Obj8MaskCompatibility } from "./obj8RenderCompatibility.js";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
  kphxXPlaneHeadingToRampReadyYawRadians,
} from "./sourceAuthority.js";

function kphxRuntimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

const DEFAULT_MANIFEST_URL = "/models/kphx-full-airport/manifest.json";
const EXACT_LEGACY_OBJ8_MASK_RESOURCES = new Set([
  "Terminals/Terminal4.obj",
  "Terminals/Terminal4b.obj",
]);

const XPLANE_LAYER_ORDER = Object.freeze({
  terrain: 0,
  beaches: 100,
  shoulders: 200,
  taxiways: 300,
  runways: 400,
  markings: 500,
  airports: 600,
  roads: 700,
  objects: 800,
  light_objects: 900,
  cars: 1000,
});

function xPlaneLayerOrder(layer) {
  if (!layer?.group) return null;
  return (XPLANE_LAYER_ORDER[layer.group] ?? 0) + Number(layer.offset || 0);
}

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

export function preparePlacementRoot(root, placement) {
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

  let xPlaneGlobalNoShadow = false;
  let xPlaneGlobalSpecular = null;
  root.traverse((node) => {
    if (node?.userData?.xPlaneGlobalNoShadow === true) xPlaneGlobalNoShadow = true;
    if (node?.userData?.xPlaneGlobalSpecular !== undefined && node?.userData?.xPlaneGlobalSpecular !== null) {
      xPlaneGlobalSpecular = node.userData.xPlaneGlobalSpecular;
    }
  });

  root.traverse((node) => {
    if (!node?.isMesh) return;
    node.castShadow = !xPlaneGlobalNoShadow;
    node.receiveShadow = true;
    node.frustumCulled = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    let authoredLayer = placement.layerGroupDraped || null;
    for (const material of materials) {
      const materialLayer = material?.userData?.xPlaneLayerGroupDraped
        || material?.userData?.xPlaneLayerGroup
        || null;
      if (materialLayer) authoredLayer = materialLayer;
      if (authoredLayer && material) {
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
        material.needsUpdate = true;
      }
    }
    const renderOrder = xPlaneLayerOrder(authoredLayer);
    if (renderOrder !== null) node.renderOrder = renderOrder;
    node.userData = {
      ...(node.userData || {}),
      kphxFullAirport: true,
      sourceResource: placement.resource,
      wedObjectId: placement.id,
      xPlaneLayerGroup: authoredLayer,
      xPlaneGlobalNoShadow,
      xPlaneGlobalSpecular,
      xPlaneShinyRatio: materials
        .map((material) => material?.userData?.xPlaneShinyRatio)
        .find((value) => value !== undefined && value !== null) ?? null,
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
    excludeResources = [],
    assetConcurrency = 6,
  } = {},
) {
  if (!environment?.add) throw new Error("KPHX full-airport loader requires a Three.js environment group");

  const resolvedManifestUrl = kphxRuntimeUrl(manifestUrl);
  const response = await fetch(resolvedManifestUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`KPHX runtime manifest returned HTTP ${response.status}: ${resolvedManifestUrl}`);
  const manifest = await response.json();

  if (manifest?.source?.version !== KPHX_FULL_AIRPORT_SOURCE.packageVersion) {
    throw new Error(`KPHX runtime/source version mismatch: expected ${KPHX_FULL_AIRPORT_SOURCE.packageVersion}, got ${manifest?.source?.version || "unknown"}`);
  }
  if (strict && manifest.failures?.length) {
    throw new Error(`KPHX runtime manifest is incomplete: ${manifest.failures.length} materialization failures`);
  }

  const allowedPrefixes = resourcePrefixes ? new Set(resourcePrefixes) : null;
  const excluded = new Set(excludeResources || []);
  const allPlacements = [
    ...(manifest.packageOwned?.placements || []),
    ...(manifest.resolvedExternal?.placements || []),
  ];
  const placements = allPlacements.filter((placement) => {
    if (excluded.has(placement.resource)) return false;
    if (!allowedPrefixes) return true;
    return allowedPrefixes.has(placement.resourcePrefix);
  });
  const assetUrls = [...new Set(placements.map((placement) => placement.assetUrl))];

  const templates = new Map();
  const assetFailures = [];
  await mapWithConcurrency(assetUrls, Math.max(1, assetConcurrency), async (assetUrl) => {
    try {
      const gltf = await loader.loadAsync(kphxRuntimeUrl(assetUrl));
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
    manifestUrl: resolvedManifestUrl,
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
    let sourceRoot = template;
    if (placement.packedMeshName) {
      sourceRoot = template.getObjectByName(placement.packedMeshName);
      if (!sourceRoot) {
        placementFailures.push({
          wedObjectId: placement.id,
          sourceResource: placement.resource,
          assetUrl: placement.assetUrl,
          packedMeshName: placement.packedMeshName,
          message: "Packed exact source mesh was not found in recovered GLB",
        });
        continue;
      }
    }
    const clonedRoot = sourceRoot.clone(true);
    if (EXACT_LEGACY_OBJ8_MASK_RESOURCES.has(placement.resource)) {
      applyExactXp11Obj8MaskCompatibility(THREE, clonedRoot, {
        label: placement.resource,
        alphaCutoff: 0.5,
        windingAlreadyConverted: false,
        correctLegacyTextureV: true,
      });
    }
    const instance = preparePlacementRoot(clonedRoot, placement);
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
      resolvedExternalPlacementCount: manifest.resolvedExternal?.materializedPlacementCount || 0,
      resolvedExternalUniqueResourceCount: manifest.resolvedExternal?.materializedUniqueResourceCount || 0,
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
