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
  fullCoverageUnderlayMode: "full-airport-neutral-underlay-below-all-source-tiles-v2",
  colorRepairMode: "source-aerial-dark-neutral-artifact-lift-v1",
  hiddenClassificationMode: "hide-airport-base-and-asphalt-over-source-aerial-v1",
});

const OPAQUE_ADEX_SURFACES = new Set(["airport-base"]);
const NONPHOTOGRAPHIC_ADEX_OVERLAYS = new Set(["asphalt"]);

function hideFlatADEXSurfaceColors(environment) {
  const authoredGround = environment.userData.authoredGround;
  if (!authoredGround) throw new Error("KPHX ADEX ground must load before its photo layer");
  let hiddenMaterialCount = 0;
  let hiddenAsphaltMaterialCount = 0;
  authoredGround.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      const hideBase = OPAQUE_ADEX_SURFACES.has(material.name);
      const hideAsphalt = NONPHOTOGRAPHIC_ADEX_OVERLAYS.has(material.name);
      if (!hideBase && !hideAsphalt) continue;
      material.visible = false;
      material.depthWrite = false;
      material.userData = {
        ...(material.userData || {}),
        visibilityAuthority: hideAsphalt
          ? "hidden-nonphotographic-adex-asphalt-over-source-aerial"
          : "hidden-flat-adex-airport-base-under-source-aerial",
      };
      material.needsUpdate = true;
      hiddenMaterialCount += 1;
      if (hideAsphalt) hiddenAsphaltMaterialCount += 1;
    }
  });
  return { hiddenMaterialCount, hiddenAsphaltMaterialCount };
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

  const fullGeometry = buildPhotoGeometry(THREE, AUTHORED_KPHX_PHOTO_PROFILE.sceneBounds);
  fullGeometry.translate(0, -0.052, 0);
  const fullMaterial = new THREE.MeshBasicMaterial({
    name: "PHX full-airport source-aerial safety underlay",
    color: 0x737779,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: true,
    depthTest: true,
  });
  const fullUnderlay = new THREE.Mesh(fullGeometry, fullMaterial);
  fullUnderlay.name = "PHX_KPHX_FullAirportPhotoUnderlay";
  fullUnderlay.castShadow = false;
  fullUnderlay.receiveShadow = false;
  fullUnderlay.frustumCulled = true;
  fullUnderlay.renderOrder = -40;
  fullUnderlay.userData.underlayAuthority = AUTHORED_KPHX_PHOTO_PROFILE.fullCoverageUnderlayMode;
  environment.add(fullUnderlay);
  environment.userData.authoredPhotoFullCoverageUnderlay = fullUnderlay;
  return additions.length + 1;
}

function blendExactProjectedSurfacesWithAerial(exactA1) {
  let hiddenProjectedMaterialCount = 0;
  exactA1.traverse((node) => {
    if (!node.isMesh || !node.name.startsWith("KPHX_A1_ExactProjected_")) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
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
  ) throw new Error("PHX aerial manifest does not match the pinned full-airport source image");
  if (manifest.schemaVersion === 2 && (
    manifest.runtimeTiling?.mode !== AUTHORED_KPHX_PHOTO_PROFILE.textureMode
    || !Array.isArray(manifest.tiles)
    || manifest.tiles.length !== manifest.runtimeTiling.tileCount
    || manifest.runtimeTiling.maxTextureDimension > AUTHORED_KPHX_PHOTO_PROFILE.maxRuntimeTextureDimension
  )) throw new Error("PHX aerial tiled runtime manifest is incomplete");
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
    north, -0.018, west, south, -0.018, west, south, -0.018, east, north, -0.018, east,
  ], 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
  ], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingSphere();
  return geometry;
}

function buildPhotoMaterial(THREE, texture, name) {
  const material = new THREE.MeshBasicMaterial({
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
  material.userData.colorRepairMode = AUTHORED_KPHX_PHOTO_PROFILE.colorRepairMode;
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
      float rrPhotoLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float rrPhotoChroma = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b)
        - min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);
      float rrPhotoNeutral = 1.0 - smoothstep(0.045, 0.14, rrPhotoChroma);
      float rrPhotoDark = 1.0 - smoothstep(0.012, 0.085, rrPhotoLuma);
      float rrPhotoRepair = rrPhotoNeutral * rrPhotoDark * step(0.02, diffuseColor.a);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.075, 0.079, 0.081), rrPhotoRepair * 0.82);`,
    );
  };
  material.customProgramCacheKey = () => AUTHORED_KPHX_PHOTO_PROFILE.colorRepairMode;
  return material;
}

function sceneBoundsForTile(tile, manifest) {
  const full = manifest.sceneBounds;
  const image = manifest.image;
  const northSpan = full.north - full.south;
  const eastSpan = full.east - full.west;
  return {
    north: full.north - (tile.y / image.height) * northSpan,
    south: full.north - ((tile.y + tile.height) / image.height) * northSpan,
    west: full.west + (tile.x / image.width) * eastSpan,
    east: full.west + ((tile.x + tile.width) / image.width) * eastSpan,
  };
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
  group.userData.fullCoverageUnderlayMode = AUTHORED_KPHX_PHOTO_PROFILE.fullCoverageUnderlayMode;
  group.userData.colorRepairMode = AUTHORED_KPHX_PHOTO_PROFILE.colorRepairMode;
  group.userData.hiddenClassificationMode = AUTHORED_KPHX_PHOTO_PROFILE.hiddenClassificationMode;
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
  photoGround.userData.fullCoverageUnderlayMode = AUTHORED_KPHX_PHOTO_PROFILE.fullCoverageUnderlayMode;
  photoGround.userData.colorRepairMode = AUTHORED_KPHX_PHOTO_PROFILE.colorRepairMode;
  photoGround.userData.hiddenClassificationMode = AUTHORED_KPHX_PHOTO_PROFILE.hiddenClassificationMode;
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
  const hiddenSurfaceState = hideFlatADEXSurfaceColors(environment);
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
  environment.userData.authoredPhotoFullCoverageUnderlayMode = AUTHORED_KPHX_PHOTO_PROFILE.fullCoverageUnderlayMode;
  environment.userData.authoredPhotoUnderlayMaterialCount = underlayMaterialCount;
  environment.userData.authoredPhotoColorRepairMode = AUTHORED_KPHX_PHOTO_PROFILE.colorRepairMode;
  environment.userData.authoredPhotoHiddenClassificationMode = AUTHORED_KPHX_PHOTO_PROFILE.hiddenClassificationMode;
  environment.userData.hiddenADEXSurfaceMaterialCount = hiddenSurfaceState.hiddenMaterialCount;
  environment.userData.hiddenADEXAsphaltMaterialCount = hiddenSurfaceState.hiddenAsphaltMaterialCount;
  environment.userData.exactA1BlendedProjectedMaterialCount = 0;
  environment.userData.exactA1HiddenProjectedMaterialCount = hiddenProjectedMaterialCount;
  environment.userData.exactA1SourceLightFixtureCount = sourceLights.userData.fixtureCount;
  environment.userData.exactA1PhysicalLightCount = sourceLights.userData.physicalLightCount;
  environment.userData.exactA1SourceLightingDetailLevel = sourceLights.userData.detailLevel;
  return photoGround;
}
