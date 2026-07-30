import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildSourcePlacedTerminal4Jetways } from "./sourcePlacedTerminal4Jetways.js";

export const AUTHORED_TERMINAL4_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/term4.BGL",
  placementSource: "TheMainlineCowboy/SkyHarborPhx@2e6642778c9c88eac6a82b21063763cc78be7cfe/scenery/KPHX_ADEX.BGL",
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
  sourceA1: Object.freeze({
    parkingIndex: 32,
    latitude: 33.43653056770563,
    longitude: -111.99864059686661,
    headingDegrees: 269.975341796875,
  }),
  // Decoded from the original KPHX_ADEX placement record relative to its
  // authored Gate A1 parking position. The airport ground adds 6.2 m on Z so
  // the model receives the same offset. FSX model X=east and Z=north become
  // browser Z=east and X=north through the reflected 90-degree axis swap.
  position: Object.freeze([-101.59257372668444, 0.035, 70.90086550233441]),
  rotationYDegrees: 90,
  scale: Object.freeze([-1, 1, 1]),
  placementAuthority: "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  materialPass: "pinned-authored-source-textures-and-exact-lightmaps-v3",
  detailLevel: "terminal4-authored-textured-lightmapped-v4-source-jetways-exact-a1",
  groundCleanupPass: "legacy-terminal-ground-atlases-suppressed-v1",
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

function sourceWrapMode(THREE, reference = "") {
  const name = reference.toUpperCase();
  // The legacy Sky Harbor materials use UVs outside 0..1. Clamp-to-edge was
  // stretching a few edge texels across the entire ramp and terminal facade,
  // which produced the blurry streaks visible on mobile.
  if (
    name.includes("PARKRAMP")
    || name.includes("GATE")
    || name.includes("SUPPORT")
    || name.includes("T4_WALK")
    || name === "RW.BMP"
  ) {
    return THREE.RepeatWrapping;
  }
  return THREE.ClampToEdgeWrapping;
}

function configureRuntimeTexture(THREE, texture, name, wrapping) {
  texture.name = name;
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = wrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadTextureManifest(baseUrl) {
  const manifestUrl = new URL(`${baseUrl}texture-manifest.json`, window.location.href);
  manifestUrl.searchParams.set("materialPass", AUTHORED_TERMINAL4_PROFILE.materialPass);
  const response = await fetch(manifestUrl.href, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  if (!response.ok) throw new Error(`Terminal 4 texture manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest.schemaVersion !== 2 || !manifest.materials) throw new Error("Terminal 4 texture manifest is invalid");
  const exactLightmapCount = Number.isInteger(manifest.emissiveTextureCount)
    ? manifest.emissiveTextureCount
    : Object.values(manifest.materials).filter((entry) => entry?.emissiveUrl).length;
  if (exactLightmapCount !== 15) throw new Error(`Terminal 4 exact lightmap count is ${exactLightmapCount}`);
  manifest.emissiveTextureCount = exactLightmapCount;
  return { manifest, manifestUrl };
}

async function loadSourceTextures(THREE, baseUrl) {
  const { manifest, manifestUrl } = await loadTextureManifest(baseUrl);
  const loader = new THREE.TextureLoader();
  const textures = new Map();
  const emissiveTextures = new Map();
  await Promise.all(Object.entries(manifest.materials).map(async ([reference, entry]) => {
    const wrapping = sourceWrapMode(THREE, reference);
    const diffuseUrl = new URL(entry.url, manifestUrl).href;
    const [diffuse, emissive] = await Promise.all([
      loader.loadAsync(diffuseUrl),
      entry.emissiveUrl ? loader.loadAsync(new URL(entry.emissiveUrl, manifestUrl).href) : Promise.resolve(null),
    ]);
    const configuredDiffuse = configureRuntimeTexture(THREE, diffuse, `PHX source ${reference}`, wrapping);
    configuredDiffuse.userData = {
      ...(configuredDiffuse.userData || {}),
      sourceHasAlpha: entry.hasAlpha === true,
      sourceAlphaCoverage: Number(entry.alphaCoverage || 0),
      sourceTransparentPixelCount: Number(entry.transparentPixelCount || 0),
      sourceAtlasCutoutAuthority: entry.sourceAtlasCutoutAuthority || "none",
    };
    textures.set(reference.toUpperCase(), configuredDiffuse);
    if (emissive) {
      emissiveTextures.set(
        reference.toUpperCase(),
        configureRuntimeTexture(THREE, emissive, `PHX exact source lightmap ${reference}`, wrapping),
      );
    }
  }));
  if (emissiveTextures.size !== manifest.emissiveTextureCount) {
    throw new Error(`Terminal 4 loaded ${emissiveTextures.size} of ${manifest.emissiveTextureCount} exact lightmaps`);
  }
  return { textures, emissiveTextures, manifest };
}

function applySourceMaterials(THREE, scene, textures, emissiveTextures) {
  let texturedMaterialCount = 0;
  let lightmappedMaterialCount = 0;
  let hiddenLegacyGroundMaterialCount = 0;
  let sourceCutoutMaterialCount = 0;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = originals.map((source) => {
      if (!source?.clone) return source;
      const material = source.clone();
      const reference = textureReference(material);
      const key = reference?.toUpperCase();
      const texture = key ? textures.get(key) : null;
      const emissiveMap = key ? emissiveTextures.get(key) : null;
      if (!texture) throw new Error(`Terminal 4 material texture is missing at runtime: ${reference || material.name}`);
      const character = materialCharacter(reference);
      const legacyGroundAtlas = /PARKRAMP|RW\.BMP/i.test(reference || "");
      material.map = texture;
      material.emissiveMap = emissiveMap ?? null;
      material.emissive?.setHex(emissiveMap ? 0xffffff : 0x000000);
      material.emissiveIntensity = emissiveMap ? 0.68 : 0;
      material.color?.setHex(0xffffff);
      material.roughness = character.roughness;
      material.metalness = character.metalness;
      const sourceCutout = texture?.userData?.sourceHasAlpha === true;
      material.transparent = sourceCutout;
      material.opacity = 1;
      material.alphaTest = sourceCutout ? 0.42 : 0;
      material.side = THREE.DoubleSide;
      material.depthWrite = !legacyGroundAtlas;
      material.visible = !legacyGroundAtlas;
      material.userData = {
        ...(material.userData || {}),
        legacyGroundAtlas,
        sourceLightmap: emissiveMap ? `${reference} exact _lm source` : null,
        sourceCutout,
        sourceAlphaCoverage: Number(texture?.userData?.sourceAlphaCoverage || 0),
        sourceAtlasCutoutAuthority: texture?.userData?.sourceAtlasCutoutAuthority || "none",
        visibilityAuthority: legacyGroundAtlas
          ? "suppressed-old-terminal-ground-so-authoritative-aerial-and-adex-remain-visible"
          : "source-authored-terminal-material",
      };
      if (legacyGroundAtlas) hiddenLegacyGroundMaterialCount += 1;
      if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount += 1;
      if (emissiveMap) lightmappedMaterialCount += 1;
      material.needsUpdate = true;
      texturedMaterialCount += 1;
      return material;
    });
    node.material = Array.isArray(node.material) ? replacements : replacements[0];
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
  });
  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount };
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
  const [{ scene: authored }, { textures, emissiveTextures, manifest }] = await Promise.all([
    new GLTFLoader().loadAsync(`${baseUrl}terminal4.gltf`),
    loadSourceTextures(THREE, baseUrl),
  ]);

  authored.name = "PHX_Terminal4_AuthoredTexturedVisual";
  authored.position.fromArray(AUTHORED_TERMINAL4_PROFILE.position);
  authored.rotation.y = THREE.MathUtils.degToRad(AUTHORED_TERMINAL4_PROFILE.rotationYDegrees);
  authored.scale.fromArray(AUTHORED_TERMINAL4_PROFILE.scale);
  const {
    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
  } = applySourceMaterials(THREE, authored, textures, emissiveTextures);
  authored.updateMatrixWorld(true);
  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored);
  environment.add(authored, sourcePlacedJetways);
  authored.updateMatrixWorld(true);
  sourcePlacedJetways.updateMatrixWorld(true);

  const terminalBounds = new THREE.Box3().setFromObject(authored);
  const a1Point = new THREE.Vector3(0, 0, 6.2);
  const a1NearestGeometryDistance = nearestHorizontalVertexDistance(THREE, authored, a1Point);

  environment.userData.environmentSource = "authored-phx-terminal4-textured-source-jetways";
  environment.userData.authoredTerminal4Url = `${baseUrl}terminal4.gltf`;
  environment.userData.authoredTerminal4 = authored;
  environment.userData.authoredTerminal4Jetways = sourcePlacedJetways;
  environment.userData.authoredTerminal4Placement = AUTHORED_TERMINAL4_PROFILE.placementAuthority;
  environment.userData.authoredTerminal4MaterialPass = AUTHORED_TERMINAL4_PROFILE.materialPass;
  environment.userData.authoredTerminal4GroundCleanupPass = AUTHORED_TERMINAL4_PROFILE.groundCleanupPass;
  environment.userData.authoredTerminal4DetailLevel = AUTHORED_TERMINAL4_PROFILE.detailLevel;
  environment.userData.authoredTerminal4TriangleCount = AUTHORED_TERMINAL4_PROFILE.triangleCount;
  environment.userData.authoredTerminal4PartCount = AUTHORED_TERMINAL4_PROFILE.partCount;
  environment.userData.authoredTerminal4TextureCount = manifest.diffuseReferenceCount;
  environment.userData.authoredTerminal4ExactTextureCount = manifest.exactTextureCount;
  environment.userData.authoredTerminal4FallbackTextureCount = manifest.fallbackTextureCount;
  environment.userData.authoredTerminal4EmissiveTextureCount = manifest.emissiveTextureCount;
  environment.userData.authoredTerminal4TexturedMaterialCount = texturedMaterialCount;
  environment.userData.authoredTerminal4LightmappedMaterialCount = lightmappedMaterialCount;
  environment.userData.authoredTerminal4HiddenLegacyGroundMaterialCount = hiddenLegacyGroundMaterialCount;
  environment.userData.authoredTerminal4SourceCutoutMaterialCount = sourceCutoutMaterialCount;
  environment.userData.authoredTerminal4SourceAlphaAuthority = "recovered-source-atlas-unused-quadrant-cutout";
  environment.userData.authoredTerminal4JetwayVisualCount = sourcePlacedJetways.userData.jetwayCount;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = sourcePlacedJetways.userData.terminalConnectedJetwayCount;
  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;
  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;
  environment.userData.authoredTerminal4JetwayDetailLevel = sourcePlacedJetways.userData.detailLevel;
  environment.userData.authoredTerminal4Position = [...AUTHORED_TERMINAL4_PROFILE.position];
  environment.userData.authoredTerminal4A1NearestGeometryDistance = a1NearestGeometryDistance;
  environment.userData.authoredTerminal4Bounds = {
    min: terminalBounds.min.toArray(),
    max: terminalBounds.max.toArray(),
  };
  return authored;
}
