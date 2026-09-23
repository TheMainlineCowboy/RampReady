import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { preparePlacementRoot } from "./installPackageOwnedObjectLayer.js";

const DEFAULT_MANIFEST_URL = "/models/kphx-full-airport/batches/full-misterx-fedex-truck-agp.manifest.json";

function runtimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

export async function installKphxMisterxFedexTruckAgp(
  THREE,
  environment,
  {
    manifestUrl = DEFAULT_MANIFEST_URL,
    loader = new GLTFLoader(),
    strict = true,
  } = {},
) {
  if (!environment?.add) throw new Error("KPHX FedEx AGP installer requires a Three.js environment group");

  const resolvedManifestUrl = runtimeUrl(manifestUrl);
  const response = await fetch(resolvedManifestUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`KPHX FedEx AGP manifest returned HTTP ${response.status}: ${resolvedManifestUrl}`);
  const manifest = await response.json();

  if (manifest?.source?.airportVersion !== "1.75.1") {
    throw new Error(`KPHX FedEx AGP source version mismatch: ${manifest?.source?.airportVersion || "unknown"}`);
  }
  if (manifest?.source?.dependencyVersion !== "2.0c") {
    throw new Error(`KPHX FedEx AGP MisterX version mismatch: ${manifest?.source?.dependencyVersion || "unknown"}`);
  }
  if (manifest?.placementCount !== 17 || manifest?.placements?.length !== 17) {
    throw new Error(`KPHX FedEx AGP placement contract changed: ${manifest?.placementCount}/${manifest?.placements?.length}`);
  }
  if (manifest?.children?.length !== 2) {
    throw new Error(`KPHX FedEx AGP child contract changed: ${manifest?.children?.length || 0}`);
  }
  if (manifest?.tile?.rotationQuarterTurns !== 0) {
    throw new Error(`KPHX FedEx AGP rotation contract changed: ${manifest?.tile?.rotationQuarterTurns}`);
  }

  const assetUrls = [...new Set(manifest.children.map((child) => child.assetUrl))];
  const templates = new Map();
  const assetFailures = [];

  await Promise.all(assetUrls.map(async (assetUrl) => {
    try {
      const gltf = await loader.loadAsync(runtimeUrl(assetUrl));
      if (!gltf?.scene) throw new Error("glTF loaded without a scene root");
      templates.set(assetUrl, gltf.scene);
    } catch (error) {
      assetFailures.push({
        assetUrl,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }));

  if (strict && assetFailures.length) {
    throw new Error(`KPHX FedEx AGP failed to load ${assetFailures.length} exact child assets`);
  }

  const layer = new THREE.Group();
  layer.name = "KPHX_FULL_MISTERX_FEDEX_TRUCK_AGP";
  layer.userData = {
    kphxFullAirport: true,
    sourceResource: manifest.resource,
    manifestUrl: resolvedManifestUrl,
    expectedPlacementCount: manifest.placementCount,
    childTemplateCount: manifest.children.length,
    loadedUniqueAssetCount: templates.size,
    assetFailures,
  };

  const placementFailures = [];
  let loadedPlacementCount = 0;
  let loadedChildInstanceCount = 0;

  for (const placement of manifest.placements) {
    try {
      const aggregate = new THREE.Group();
      aggregate.name = `KPHX_AGP_${placement.id}_Truck_Fedex`;
      aggregate.userData = {
        kphxAgp: true,
        sourceAgpResource: manifest.resource,
        agpMetersPerPixel: manifest.tile.metersPerPixel,
      };

      for (const child of manifest.children) {
        const template = templates.get(child.assetUrl);
        if (!template) throw new Error(`Missing AGP child template: ${child.assetUrl}`);
        if (!Array.isArray(child.xPlaneLocalOffsetMeters) || child.xPlaneLocalOffsetMeters.length !== 3) {
          throw new Error(`Invalid AGP child offset for ${child.sourceObject}`);
        }
        if (child.headingOffsetDegrees !== 0) {
          throw new Error(`Unexpected authored AGP child heading for ${child.sourceObject}: ${child.headingOffsetDegrees}`);
        }

        const instance = template.clone(true);
        instance.name = `KPHX_AGP_CHILD_${placement.id}_${child.sourceObject}`;
        instance.position.set(
          child.xPlaneLocalOffsetMeters[0],
          child.xPlaneLocalOffsetMeters[1],
          child.xPlaneLocalOffsetMeters[2],
        );
        instance.rotation.set(0, 0, 0);
        instance.userData = {
          ...(instance.userData || {}),
          kphxAgpChild: true,
          sourceObject: child.sourceObject,
          sourceResource: child.sourceResource,
          xPlaneLocalOffsetMeters: [...child.xPlaneLocalOffsetMeters],
          headingOffsetDegrees: child.headingOffsetDegrees,
          draped: child.draped === true,
        };
        aggregate.add(instance);
        loadedChildInstanceCount += 1;
      }

      const placed = preparePlacementRoot(aggregate, placement);
      layer.add(placed);
      loadedPlacementCount += 1;
    } catch (error) {
      placementFailures.push({
        wedObjectId: placement.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  layer.userData.loadedPlacementCount = loadedPlacementCount;
  layer.userData.loadedChildInstanceCount = loadedChildInstanceCount;
  layer.userData.placementFailures = placementFailures;
  layer.userData.ready = (
    assetFailures.length === 0
    && placementFailures.length === 0
    && loadedPlacementCount === 17
    && loadedChildInstanceCount === 34
  );

  if (strict && !layer.userData.ready) {
    throw new Error(
      `KPHX FedEx AGP incomplete: placements=${loadedPlacementCount}/17 childInstances=${loadedChildInstanceCount}/34`,
    );
  }

  environment.add(layer);

  return {
    layer,
    manifest,
  };
}
