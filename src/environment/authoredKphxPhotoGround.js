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
  detailLevel: "full-airport-source-aerial-1.2m-v1",
});

// The broad airport-base is hidden so the supplied aerial remains visible
// between authored surfaces. Concrete, asphalt and service-road materials are
// now source-textured and must stay visible above the aerial at close range.
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

async function fetchManifest(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`PHX aerial manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (
    manifest.schemaVersion !== 1 ||
    manifest.tileCount !== AUTHORED_KPHX_PHOTO_PROFILE.tileCount ||
    manifest.image?.width !== AUTHORED_KPHX_PHOTO_PROFILE.width ||
    manifest.image?.height !== AUTHORED_KPHX_PHOTO_PROFILE.height ||
    manifest.image?.bytes !== AUTHORED_KPHX_PHOTO_PROFILE.bytes
  ) {
    throw new Error("PHX aerial manifest does not match the pinned full-airport source image");
  }
  return manifest;
}

function buildPhotoGeometry(THREE) {
  const { north, south, west, east } = AUTHORED_KPHX_PHOTO_PROFILE.sceneBounds;
  const geometry = new THREE.BufferGeometry();
  // Source mosaic rows run north-to-south and columns west-to-east.
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

export async function installAuthoredKphxPhotoGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.photoGroundSource = "loading-source-authored-phx-photo";

  const baseUrl = `${import.meta.env.BASE_URL}models/kphx-photo/`;
  const manifestUrl = `${baseUrl}photo-manifest.json`;
  const imageUrl = `${baseUrl}phx-airport-photo.webp`;
  const [manifest, texture] = await Promise.all([
    fetchManifest(manifestUrl),
    new THREE.TextureLoader().loadAsync(imageUrl),
  ]);

  texture.name = "PHX full-airport source aerial";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  const material = new THREE.MeshStandardMaterial({
    name: "PHX source aerial ground",
    map: texture,
    color: 0xffffff,
    roughness: 0.97,
    metalness: 0,
    transparent: true,
    alphaTest: 0.02,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const photoGround = new THREE.Mesh(buildPhotoGeometry(THREE), material);
  photoGround.name = "PHX_KPHX_SourceAuthoredPhotoGround";
  photoGround.receiveShadow = true;
  photoGround.castShadow = false;
  photoGround.frustumCulled = true;
  photoGround.renderOrder = -20;

  const hiddenSurfaceMaterialCount = hideFlatADEXSurfaceColors(environment);
  environment.add(photoGround);

  environment.userData.photoGroundSource = "source-authored-phx-photo";
  environment.userData.authoredPhotoGround = photoGround;
  environment.userData.authoredPhotoGroundUrl = imageUrl;
  environment.userData.authoredPhotoManifestUrl = manifestUrl;
  environment.userData.authoredPhotoTileCount = manifest.tileCount;
  environment.userData.authoredPhotoQmidLevel = manifest.qmidLevel;
  environment.userData.authoredPhotoWidth = manifest.image.width;
  environment.userData.authoredPhotoHeight = manifest.image.height;
  environment.userData.authoredPhotoBytes = manifest.image.bytes;
  environment.userData.authoredPhotoSha256 = manifest.image.sha256;
  environment.userData.authoredPhotoDetailLevel = AUTHORED_KPHX_PHOTO_PROFILE.detailLevel;
  environment.userData.hiddenADEXSurfaceMaterialCount = hiddenSurfaceMaterialCount;
  return photoGround;
}
