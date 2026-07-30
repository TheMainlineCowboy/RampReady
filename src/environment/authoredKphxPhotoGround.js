import { installExactKphxA1 } from "./kphxExactA1/index.js";
import { installExactKphxA1SourceLights } from "./kphxExactA1/sourceLights.js";

export const AUTHORED_KPHX_PHOTO_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/PHXPhoto.bgl",
  decoder: "seanisom/flightsimlib@fc17bec8e20770da3344eea10f25ecac281ee09f",
  image: "models/kphx-photo/phx-airport-photo.webp",
  manifest: "models/kphx-photo/photo-manifest.json",
  width: 6400,
  height: 2304,
  bytes: 2_698_886,
  tileCount: 199,
  qmidLevel: 17,
  approximateGroundSampleMeters: 1.2,
  sceneBounds: Object.freeze({
    north: 957.2170236474195,
    south: -1794.5159946189253,
    west: -3703.4637473759662,
    east: 4801.396159291422,
  }),
  detailLevel: "full-airport-source-aerial-tiled-1.2m-v2",
  fallbackDetailLevel: "full-airport-source-aerial-1.2m-v1",
  textureMode: "tiled-native-source-resolution-v2",
  maxRuntimeTextureDimension: 1024,
  underlayMode: "neutral-airport-base-below-source-aerial-alpha",
});

// The source aerial is the diffuse authority. The airport-wide ADEX surface
// shells remain available for markings and metadata but must not cover the
// photographic ramp with flat simulator classification colors.
const OPAQUE_ADEX_SURFACES = new Set(["airport-base"]);

function hideFlatADEXSurfaceColors(environment) {
  const authoredGround = environment.userData.authoredGround;
  if (!authoredGround) throw new Error("KPHX ADEX ground must load before its photo layer");
  let hiddenMaterialCount = 0;
  authoredGround.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material || !OPAQUE_ADEX_SURFACES.has(material.name)) continue;
      material.visible = false;
      material.needsUpdate = true;
      hiddenMaterialCount += 1;
    }
  });
  return hiddenMaterialCount;
}

function buildAirportBaseUnderlay(THREE, environment) {
  const authoredGround = environment.userData.authoredGround;
  if (!authoredGround) throw new Error("KPHX ADEX ground must load before its aerial underlay");
  const additions = [];
  authoredGround.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const airportBaseIndices = materials
      .map((material, index) => material?.name === "airport-base" ? index : -1)
      .filter((index) => index >= 0);
    if (!airportBaseIndices.length) return;

    const geometry = node.geometry.clone();
    if (materials.length > 1) {
      const baseGroups = node.geometry.groups.filter((group) => airportBaseIndices.includes(group.materialIndex));
      if (!baseGroups.length) return;
      geometry.clearGroups();
      for (const group of baseGroups) geometry.addGroup(group.start, group.count, 0);
    }
    const material = new THREE.MeshBasicMaterial({
      name: "PHX source-aerial transparent-cutout pavement underlay",
      color: 0x737779,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: true,
      depthTest: true,
    });
    const underlay = new THREE.Mesh(geometry, material);
    underlay.name = "PHX_KPHX_AirportBasePhotoUnderlay";
    underlay.position.copy(node.position);
    underlay.quaternion.copy(node.quaternion);
    underlay.scale.copy(node.scale);
    underlay.matrixAutoUpdate = node.matrixAutoUpdate;
    if (!node.matrixAutoUpdate) underlay.matrix.copy(node.matrix);
    underlay.castShadow = false;
    underlay.receiveShadow = false;
    underlay.renderOrder = -30;
    underlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;
    additions.push({ parent: node.parent, underlay });
  });
  for (const { parent, underlay } of additions) parent?.add(underlay);
  return additions.length;
}

function blendExactProjectedSurfacesWithAerial(exactA1) {
  let hiddenProjectedMaterialCount = 0;
  exactA1.traverse((node) => {
    if (!node.isMesh || !node.name.startsWith("KPHX_A1_ExactProjected_")) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      // The decoded projected records preserve exact boundaries and ordering,
      // but their colors are BGL classification tints, not the supplied apron
      // photography. Keep the records in the scene contract while rendering the
      // source aerial and exact painted-line records instead of gray overlays.
      material.visible = false;
      material.depthWrite = false;
      material.userData = {
        ...(material.userData || {}),
        visibilityAuthority: "hidden-nonphotographic-bgl-classification-tint",
      };
      material.needsUpdate = true;
      hiddenProjectedMaterialCount += 1;
    }
  });
  exactA1.userData.blendedProjectedMaterialCount = 0;
  exactA1.userData.hiddenProjectedMaterialCount = hiddenProjectedMaterialCount;
  return hiddenProjectedMaterialCount;
}

async function fetchManifest(url) {
  const manifestUrl = new URL(url, window.location.href);
  manifestUrl.searchParams.set("textureMode", AUTHORED_KPHX_PHOTO_PROFILE.textureMode);
  const response = await fetch(manifestUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(`PHX aerial manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (
    ![1, 2].includes(manifest.schemaVersion)
    || manifest.tileCount !== AUTHORED_KPHX_PHOTO_PROFILE.tileCount
    || manifest.image?.width !== AUTHORED_KPHX_PHOTO_PROFILE.width
    || manifest.image?.height !== AUTHORED_KPHX_PHOTO_PROFILE.height
    || manifest.image?.bytes !== AUTHORED_KPHX_PHOTO_PROFILE.bytes
  ) {
    throw new Error("PHX aerial manifest does not match the pinned full-airport source image");
  }
  if (manifest.schemaVersion === 2) {
    if (
      manifest.runtimeTiling?.mode !== AUTHORED_KPHX_PHOTO_PROFILE.textureMode
      || !Array.isArray(manifest.tiles)
      || manifest.tiles.length !== manifest.runtimeTiling.tileCount
      || manifest.runtimeTiling.maxTextureDimension > AUTHORED_KPHX_PHOTO_PROFILE.maxRuntimeTextureDimension
    ) {
      throw new Error("PHX aerial tiled runtime manifest is incomplete");
    }
  }
  return manifest;
}

function configurePhotoTexture(THREE, texture, name, useMipmaps = true) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = useMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = useMipmaps;
  texture.needsUpdate = true;
  return texture;
}

function buildPhotoGeometry(THREE, bounds) {
  const { north, south, west, east } = bounds;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    north, -0.018, west,
    south, -0.018, west,
    south, -0.018, east,
    north, -0.018, east,
  ], 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([
    0, 1,
    0, 0,
    1, 0,
    1, 1,
  ], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildPhotoMaterial(THREE, texture, name) {
  return new THREE.MeshBasicMaterial({
    name,
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

function sceneBoundsForTile(tile, manifest) {
  const full = manifest.sceneBounds;
  const image = manifest.image;
  const northSpan = full.north - full.south;
  const eastSpan = full.east - full.west;
  const north = full.north - (tile.y / image.height) * northSpan;
  const south = full.north - ((tile.y + tile.height) / image.height) * northSpan;
  const west = full.west + (tile.x / image.width) * eastSpan;
  const east = full.west + ((tile.x + tile.width) / image.width) * eastSpan;
  return { north, south, west, east };
}

async function buildTiledPhotoGround(THREE, baseUrl, manifest) {
  const group = new THREE.Group();
  group.name = "PHX_KPHX_SourceAuthoredPhotoGround_Tiled";
  const textureLoader = new THREE.TextureLoader();
  const tileVersion = encodeURIComponent(manifest.image.sha256.slice(0, 16));
  const loadedTiles = await Promise.all(manifest.tiles.map(async (tile, index) => {
    const texture = await textureLoader.loadAsync(`${baseUrl}${tile.file}?v=${tileVersion}`);
    configurePhotoTexture(THREE, texture, `PHX source aerial tile ${tile.column}:${tile.row}`);
    const material = buildPhotoMaterial(THREE, texture, `PHX source aerial tile material ${index}`);
    const mesh = new THREE.Mesh(buildPhotoGeometry(THREE, sceneBoundsForTile(tile, manifest)), material);
    mesh.name = `PHX_KPHX_SourceAerialTile_${tile.column}_${tile.row}`;
    mesh.receiveShadow = false;
    mesh.castShadow = false;
    mesh.frustumCulled = true;
    mesh.renderOrder = -20;
    mesh.userData.sourcePixelBounds = { x: tile.x, y: tile.y, width: tile.width, height: tile.height };
    return mesh;
  }));
  group.add(...loadedTiles);
  group.userData.textureMode = AUTHORED_KPHX_PHOTO_PROFILE.textureMode;
  group.userData.runtimeTileCount = loadedTiles.length;
  group.userData.maxTextureDimension = manifest.runtimeTiling.maxTextureDimension;
  group.userData.underlayMode = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;
  return group;
}

async function buildFallbackPhotoGround(THREE, imageUrl, manifest) {
  const texture = await new THREE.TextureLoader().loadAsync(imageUrl);
  configurePhotoTexture(THREE, texture, "PHX full-airport source aerial fallback");
  const photoGround = new THREE.Mesh(
    buildPhotoGeometry(THREE, manifest.sceneBounds),
    buildPhotoMaterial(THREE, texture, "PHX source aerial ground fallback"),
  );
  photoGround.name = "PHX_KPHX_SourceAuthoredPhotoGround";
  photoGround.receiveShadow = false;
  photoGround.castShadow = false;
  photoGround.frustumCulled = true;
  photoGround.renderOrder = -20;
  photoGround.userData.textureMode = "single-texture-fallback-v1";
  photoGround.userData.runtimeTileCount = 1;
  photoGround.userData.underlayMode = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;
  return photoGround;
}

async function buildBestAvailablePhotoGround(THREE, baseUrl, imageUrl, manifest) {
  if (manifest.schemaVersion === 2 && manifest.tiles?.length) {
    try {
      return await buildTiledPhotoGround(THREE, baseUrl, manifest);
    } catch (error) {
      console.warn("PHX tiled aerial failed; using the pinned full-airport fallback texture", error);
    }
  }
  return buildFallbackPhotoGround(THREE, imageUrl, manifest);
}

export async function installAuthoredKphxPhotoGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.photoGroundSource = "loading-source-authored-phx-photo";

  const baseUrl = `${import.meta.env.BASE_URL}models/kphx-photo/`;
  const manifestUrl = `${baseUrl}photo-manifest.json`;
  const imageUrl = `${baseUrl}phx-airport-photo.webp`;
  const manifest = await fetchManifest(manifestUrl);
  const photoGround = await buildBestAvailablePhotoGround(THREE, baseUrl, imageUrl, manifest);

  const underlayMaterialCount = buildAirportBaseUnderlay(THREE, environment);
  const hiddenSurfaceMaterialCount = hideFlatADEXSurfaceColors(environment);
  environment.add(photoGround);
  const exactA1 = await installExactKphxA1(THREE, environment);
  exactA1.position.set(0, 0, 6.2);
  const hiddenProjectedMaterialCount = blendExactProjectedSurfacesWithAerial(exactA1);
  const sourceLights = installExactKphxA1SourceLights(THREE, exactA1);

  const tiled = photoGround.userData.textureMode === AUTHORED_KPHX_PHOTO_PROFILE.textureMode;
  environment.userData.photoGroundSource = "source-authored-phx-photo";
  environment.userData.authoredPhotoGround = photoGround;
  environment.userData.authoredPhotoGroundUrl = imageUrl;
  environment.userData.authoredPhotoManifestUrl = manifestUrl;
  environment.userData.authoredPhotoTextureMode = photoGround.userData.textureMode;
  environment.userData.authoredPhotoRuntimeTileCount = photoGround.userData.runtimeTileCount;
  environment.userData.authoredPhotoTileCount = manifest.tileCount;
  environment.userData.authoredPhotoQmidLevel = manifest.qmidLevel;
  environment.userData.authoredPhotoWidth = manifest.image.width;
  environment.userData.authoredPhotoHeight = manifest.image.height;
  environment.userData.authoredPhotoBytes = manifest.image.bytes;
  environment.userData.authoredPhotoSha256 = manifest.image.sha256;
  environment.userData.authoredPhotoDetailLevel = tiled
    ? AUTHORED_KPHX_PHOTO_PROFILE.detailLevel
    : AUTHORED_KPHX_PHOTO_PROFILE.fallbackDetailLevel;
  environment.userData.authoredPhotoUnderlayMode = AUTHORED_KPHX_PHOTO_PROFILE.underlayMode;
  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;
  environment.userData.hiddenADEXSurfaceMaterialCount = hiddenSurfaceMaterialCount;
  environment.userData.exactA1BlendedProjectedMaterialCount = 0;
  environment.userData.exactA1HiddenProjectedMaterialCount = hiddenProjectedMaterialCount;
  environment.userData.exactA1SourceLightFixtureCount = sourceLights.userData.fixtureCount;
  environment.userData.exactA1PhysicalLightCount = sourceLights.userData.physicalLightCount;
  environment.userData.exactA1SourceLightingDetailLevel = sourceLights.userData.detailLevel;
  return photoGround;
}
