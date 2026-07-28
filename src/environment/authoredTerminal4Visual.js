import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const AUTHORED_TERMINAL4_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/term4.BGL",
  placementSource: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/KPHX_ADEX.BGL",
  modernAnchorSource: "unmlobo-kphx1-8-1_Mu9aq.zip/scenery/world/scenery/kphx-airport.bgl",
  modelName: "phx_term400",
  modelGuid: "{7f197eb0-33ea-419f-9658-a29c9046d87f}",
  triangleCount: 11138,
  partCount: 19,
  sourceBounds: Object.freeze({
    min: Object.freeze([-361.947998046875, 0, -213.22799682617188]),
    max: Object.freeze([488.2799987792969, 30.215999603271484, 266.8240051269531]),
  }),
  sourcePlacement: Object.freeze({
    recordOffset: 146014,
    latitude: 33.435617946088314,
    longitude: -111.99794411659241,
    headingDegrees: 0,
    scale: 1,
  }),
  legacySourceA1: Object.freeze({
    parkingIndex: 32,
    latitude: 33.43653056770563,
    longitude: -111.99864059686661,
    headingDegrees: 269.975341796875,
  }),
  modernSourceA1: Object.freeze({
    parkingIndex: 43,
    latitude: 33.436546325683594,
    longitude: -111.99876129627228,
    headingDegrees: 270.4908752441406,
  }),
  sourceAnchorDeltaMeters: Object.freeze({
    north: -1.7541700827164473,
    east: 11.212459754837063,
  }),
  // The terminal mesh and its original library-object placement are retained
  // byte-for-byte. Only the coordinate origin changes: the legacy A1-relative
  // placement is translated by the measured legacy-A1 to modern-A1 delta. The
  // 6.2 m scene Z offset remains identical to the aircraft/ground registration.
  position: Object.freeze([-103.34674380940088, 0.035, 82.11332525717148]),
  rotationYDegrees: 90,
  scale: Object.freeze([-1, 1, 1]),
  placementAuthority: "decoded legacy Terminal 4 library-object placement translated to the exact unmlobo v1.8.1 Gate A1 coordinate",
  materialPass: "pinned-authored-source-textures-v1",
  detailLevel: "terminal4-authored-textured-v3-modern-a1",
});

function textureReference(material) {
  if (material?.userData?.diffuseTexture) return material.userData.diffuseTexture;
  const match = material?.name?.match(/material-\d+-(.+)$/i);
  return match?.[1] ?? null;
}

function materialCharacter(reference = "") {
  const name = reference.toUpperCase();
  if (name.includes("SUPPORT") || name.includes("RAMPLIGHT")) {
    return { roughness: 0.55, metalness: 0.34 };
  }
  if (name.includes("PARKRAMP") || name === "RW.BMP") {
    return { roughness: 0.94, metalness: 0.01 };
  }
  if (name.includes("GATE") || name.includes("TERM400") || name.includes("T4_WALK")) {
    return { roughness: 0.76, metalness: 0.03 };
  }
  return { roughness: 0.82, metalness: 0.02 };
}

async function loadTextureManifest(baseUrl) {
  const manifestUrl = `${baseUrl}texture-manifest.json`;
  const response = await fetch(manifestUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Terminal 4 texture manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 2 || !manifest.materials) throw new Error("Terminal 4 texture manifest is invalid");
  return { manifest, manifestUrl: new URL(manifestUrl, window.location.href) };
}

async function loadSourceTextures(THREE, baseUrl) {
  const { manifest, manifestUrl } = await loadTextureManifest(baseUrl);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  await Promise.all(Object.entries(manifest.materials).map(async ([reference, entry]) => {
    const url = new URL(entry.url, manifestUrl).href;
    const texture = await loader.loadAsync(url);
    texture.name = `PHX source ${reference}`;
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    textures.set(reference.toUpperCase(), texture);
  }));
  return { textures, manifest };
}

function applySourceMaterials(THREE, scene, textures) {
  let texturedMaterialCount = 0;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = originals.map((source) => {
      if (!source?.clone) return source;
      const material = source.clone();
      const reference = textureReference(material);
      const texture = reference ? textures.get(reference.toUpperCase()) : null;
      if (!texture) throw new Error(`Terminal 4 material texture is missing at runtime: ${reference || material.name}`);
      const character = materialCharacter(reference);
      material.map = texture;
      material.color?.setHex(0xffffff);
      material.roughness = character.roughness;
      material.metalness = character.metalness;
      material.transparent = false;
      material.opacity = 1;
      material.side = THREE.DoubleSide;
      material.depthWrite = true;
      material.needsUpdate = true;
      texturedMaterialCount += 1;
      return material;
    });
    node.material = Array.isArray(node.material) ? replacements : replacements[0];
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
  });
  return texturedMaterialCount;
}

function nearestHorizontalVertexDistance(THREE, scene, point) {
  let nearest = Number.POSITIVE_INFINITY;
  const vertex = new THREE.Vector3();
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      node.localToWorld(vertex);
      nearest = Math.min(nearest, Math.hypot(vertex.x - point.x, vertex.z - point.z));
    }
  });
  return nearest;
}

function hideCalibrationTerminal(environment) {
  environment.traverse((node) => {
    if (node.name === "TerminalFacadeModule" || node.name === "TerminalFacadeGlass") node.visible = false;
  });
}

export async function installAuthoredTerminal4Visual(THREE, environment) {
  if (!environment?.isGroup) throw new Error("Terminal 4 environment group is required");
  hideCalibrationTerminal(environment);
  environment.userData.environmentSource = "loading-authored-phx-terminal4-textured";
  environment.userData.authoredTerminal4Placement = AUTHORED_TERMINAL4_PROFILE.placementAuthority;

  const baseUrl = `${import.meta.env.BASE_URL}models/phx-terminal4/`;
  const [{ scene: authored }, { textures, manifest }] = await Promise.all([
    new GLTFLoader().loadAsync(`${baseUrl}terminal4.gltf`),
    loadSourceTextures(THREE, baseUrl),
  ]);

  authored.name = "PHX_Terminal4_AuthoredTexturedVisual";
  authored.position.fromArray(AUTHORED_TERMINAL4_PROFILE.position);
  authored.rotation.y = THREE.MathUtils.degToRad(AUTHORED_TERMINAL4_PROFILE.rotationYDegrees);
  authored.scale.fromArray(AUTHORED_TERMINAL4_PROFILE.scale);
  const texturedMaterialCount = applySourceMaterials(THREE, authored, textures);
  environment.add(authored);
  authored.updateMatrixWorld(true);

  const terminalBounds = new THREE.Box3().setFromObject(authored);
  const a1Point = new THREE.Vector3(0, 0, 6.2);
  const a1NearestGeometryDistance = nearestHorizontalVertexDistance(THREE, authored, a1Point);

  environment.userData.environmentSource = "authored-phx-terminal4-textured";
  environment.userData.authoredTerminal4Url = `${baseUrl}terminal4.gltf`;
  environment.userData.authoredTerminal4 = authored;
  environment.userData.authoredTerminal4Placement = AUTHORED_TERMINAL4_PROFILE.placementAuthority;
  environment.userData.authoredTerminal4MaterialPass = AUTHORED_TERMINAL4_PROFILE.materialPass;
  environment.userData.authoredTerminal4DetailLevel = AUTHORED_TERMINAL4_PROFILE.detailLevel;
  environment.userData.authoredTerminal4TriangleCount = AUTHORED_TERMINAL4_PROFILE.triangleCount;
  environment.userData.authoredTerminal4PartCount = AUTHORED_TERMINAL4_PROFILE.partCount;
  environment.userData.authoredTerminal4TextureCount = manifest.diffuseReferenceCount;
  environment.userData.authoredTerminal4ExactTextureCount = manifest.exactTextureCount;
  environment.userData.authoredTerminal4FallbackTextureCount = manifest.fallbackTextureCount;
  environment.userData.authoredTerminal4TexturedMaterialCount = texturedMaterialCount;
  environment.userData.authoredTerminal4Position = [...AUTHORED_TERMINAL4_PROFILE.position];
  environment.userData.authoredTerminal4A1NearestGeometryDistance = a1NearestGeometryDistance;
  environment.userData.authoredTerminal4Bounds = {
    min: terminalBounds.min.toArray(),
    max: terminalBounds.max.toArray(),
  };
  return authored;
}
