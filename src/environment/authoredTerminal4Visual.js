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

async function loadExactJetwayTextures(THREE, baseUrl) {
  const loader = new THREE.TextureLoader();
  const [diffuse, emissive] = await Promise.all([
    loader.loadAsync(`${baseUrl}textures/M1DGJETWAY.png`),
    loader.loadAsync(`${baseUrl}textures/M1DGJETWAY_LM.png`),
  ]);
  return {
    diffuse: configureRuntimeTexture(THREE, diffuse, "M1DGJETWAY exact recovered source", THREE.RepeatWrapping),
    emissive: configureRuntimeTexture(THREE, emissive, "M1DGJETWAY_LM exact recovered source", THREE.RepeatWrapping),
    authority: "exact-recovered-original-freeware-archive",
  };
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

const splitterMarker = "source-package-facade-cell-variation-v31";
const sourceFacadeSafeVariantAuthority = "source-package-facade-safe-variant-set-v34";

function interpolateFacadeVertex(a, b, t) {
  return {
    position: a.position.clone().lerp(b.position, t),
    normal: a.normal.clone().lerp(b.normal, t).normalize(),
    uv: a.uv.clone().lerp(b.uv, t),
  };
}

function clipFacadePolygonByU(polygon, boundary, keepGreater) {
  if (!polygon.length) return [];
  const clipped = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    const aInside = keepGreater ? a.uv.x >= boundary - 1e-6 : a.uv.x <= boundary + 1e-6;
    const bInside = keepGreater ? b.uv.x >= boundary - 1e-6 : b.uv.x <= boundary + 1e-6;
    if (aInside && bInside) {
      clipped.push(b);
    } else if (aInside !== bInside) {
      const denominator = b.uv.x - a.uv.x;
      const t = Math.abs(denominator) < 1e-8 ? 0 : (boundary - a.uv.x) / denominator;
      const intersection = interpolateFacadeVertex(a, b, Math.max(0, Math.min(1, t)));
      clipped.push(intersection);
      if (!aInside && bInside) clipped.push(b);
    }
  }
  return clipped;
}

function splitRepeatedBGATE1Facade(THREE, scene) {
  const sequence = [
    "BGATE3.BMP",
    "DGATE3.BMP",
    "BGATE3.BMP",
    "DGATE1.BMP",
    "BGATE3.BMP",
    "BGATE1.BMP",
    "DGATE3.BMP",
    "BGATE3.BMP",
  ];
  const uniqueReferences = [...new Set(sequence)];
  let splitMeshCount = 0;
  const sourceCells = new Set();
  const openCells = new Set();
  const closedCells = new Set();

  scene.traverse((node) => {
    if (!node.isMesh || Array.isArray(node.material)) return;
    if (textureReference(node.material)?.toUpperCase() !== "BGATE1.BMP") return;
    const sourceGeometry = node.geometry?.index ? node.geometry.toNonIndexed() : node.geometry;
    const position = sourceGeometry?.getAttribute?.("position");
    const normal = sourceGeometry?.getAttribute?.("normal");
    const uv = sourceGeometry?.getAttribute?.("uv");
    if (!position || !normal || !uv || position.count % 3 !== 0) {
      throw new Error("BGATE1 facade geometry is missing non-indexed position, normal or UV attributes");
    }

    const buffers = new Map(uniqueReferences.map((reference) => [reference, {
      position: [],
      normal: [],
      uv: [],
    }]));
    const readVertex = (vertexIndex) => ({
      position: new THREE.Vector3().fromBufferAttribute(position, vertexIndex),
      normal: new THREE.Vector3().fromBufferAttribute(normal, vertexIndex),
      uv: new THREE.Vector2().fromBufferAttribute(uv, vertexIndex),
    });

    for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 3) {
      const triangle = [readVertex(vertexIndex), readVertex(vertexIndex + 1), readVertex(vertexIndex + 2)];
      const minimumU = Math.min(...triangle.map((vertex) => vertex.uv.x));
      const maximumU = Math.max(...triangle.map((vertex) => vertex.uv.x));
      const firstCell = Math.floor(minimumU + 1e-6);
      const lastCell = Math.max(firstCell, Math.ceil(maximumU - 1e-6) - 1);
      for (let cell = firstCell; cell <= lastCell; cell += 1) {
        let polygon = clipFacadePolygonByU(triangle, cell, true);
        polygon = clipFacadePolygonByU(polygon, cell + 1, false);
        if (polygon.length < 3) continue;
        const sequenceIndex = ((cell % sequence.length) + sequence.length) % sequence.length;
        const reference = sequence[sequenceIndex];
        const buffer = buffers.get(reference);
        sourceCells.add(cell);
        if (reference === "BGATE1.BMP") openCells.add(cell);
        else closedCells.add(cell);
        for (let fan = 1; fan < polygon.length - 1; fan += 1) {
          for (const vertex of [polygon[0], polygon[fan], polygon[fan + 1]]) {
            buffer.position.push(vertex.position.x, vertex.position.y, vertex.position.z);
            buffer.normal.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
            buffer.uv.push(Math.max(0, Math.min(1, vertex.uv.x - cell)), vertex.uv.y);
          }
        }
      }
    }

    const replacement = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];
    const uvs = [];
    const materials = [];
    let groupStart = 0;
    for (const reference of uniqueReferences) {
      const buffer = buffers.get(reference);
      if (!buffer.position.length) continue;
      const material = node.material.clone();
      material.name = String(material.name || "material-0-BGATE1.BMP").replace(/BGATE1\.(BMP|DDS)/i, reference);
      material.userData = {
        ...(material.userData || {}),
        diffuseTexture: reference,
        sourceFacadeCellVariation: true,
        sourceFacadeVariationAuthority: splitterMarker,
      };
      materials.push(material);
      positions.push(...buffer.position);
      normals.push(...buffer.normal);
      uvs.push(...buffer.uv);
      replacement.addGroup(groupStart, buffer.position.length / 3, materials.length - 1);
      groupStart += buffer.position.length / 3;
    }
    if (!materials.length) throw new Error("BGATE1 facade splitter produced no source-variant geometry");
    replacement.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    replacement.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    replacement.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    replacement.computeBoundingBox();
    replacement.computeBoundingSphere();
    if (sourceGeometry !== node.geometry) sourceGeometry.dispose();
    node.geometry.dispose();
    node.geometry = replacement;
    node.material = materials;
    node.userData = {
      ...(node.userData || {}),
      sourceFacadeCellVariation: true,
      sourceFacadeVariationAuthority: splitterMarker,
      sourceFacadeVariantReferences: uniqueReferences,
    };
    splitMeshCount += 1;
  });

  return {
    authority: splitterMarker,
    splitMeshCount,
    sourceCellCount: sourceCells.size,
    openCellCount: openCells.size,
    closedCellCount: closedCells.size,
    variantMaterialCount: uniqueReferences.length,
    safeVariantAuthority: sourceFacadeSafeVariantAuthority,
  };
}

function applySourceMaterials(THREE, scene, textures, emissiveTextures) {
  let texturedMaterialCount = 0;
  let lightmappedMaterialCount = 0;
  let hiddenLegacyGroundMaterialCount = 0;
  let sourceCutoutMaterialCount = 0;
  let sourceClosedBayMaterialCount = 0;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const replacements = originals.map((source) => {
      if (!source?.clone) return source;
      const material = source.clone();
      const reference = textureReference(material);
      const key = reference?.toUpperCase();
      const sourceFacadeSelection = node.userData?.sourceFacadeVariationAuthority === "source-package-facade-cell-variation-v31";
      const sourceClosedBaySelection = sourceFacadeSelection && key !== "BGATE1.BMP";
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
        sourceDiffuseTexture: reference,
        runtimeDiffuseTexture: reference,
        sourceFacadeSelectionAuthority: sourceFacadeSelection
          ? "source-package-facade-cell-variation-v31"
          : "source-material-unmodified",
        sourceCutout,
        sourceAlphaCoverage: Number(texture?.userData?.sourceAlphaCoverage || 0),
        sourceAtlasCutoutAuthority: texture?.userData?.sourceAtlasCutoutAuthority || "none",
        visibilityAuthority: legacyGroundAtlas
          ? "suppressed-old-terminal-ground-so-authoritative-aerial-and-adex-remain-visible"
          : "source-authored-terminal-material",
      };
      if (legacyGroundAtlas) hiddenLegacyGroundMaterialCount += 1;
      if (sourceCutout && !legacyGroundAtlas) sourceCutoutMaterialCount += 1;
      if (sourceClosedBaySelection) sourceClosedBayMaterialCount += 1;
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
  return { texturedMaterialCount, lightmappedMaterialCount, hiddenLegacyGroundMaterialCount, sourceCutoutMaterialCount, sourceClosedBayMaterialCount };
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
  const [{ scene: authored }, { textures, emissiveTextures, manifest }, jetwayTextures] = await Promise.all([
    new GLTFLoader().loadAsync(`${baseUrl}terminal4.gltf`),
    loadSourceTextures(THREE, baseUrl),
    loadExactJetwayTextures(THREE, baseUrl),
  ]);

  authored.name = "PHX_Terminal4_AuthoredTexturedVisual";
  authored.position.fromArray(AUTHORED_TERMINAL4_PROFILE.position);
  authored.rotation.y = THREE.MathUtils.degToRad(AUTHORED_TERMINAL4_PROFILE.rotationYDegrees);
  authored.scale.fromArray(AUTHORED_TERMINAL4_PROFILE.scale);
  const sourceFacadeVariation = splitRepeatedBGATE1Facade(THREE, authored);
  const {
    texturedMaterialCount,
    lightmappedMaterialCount,
    hiddenLegacyGroundMaterialCount,
    sourceCutoutMaterialCount,
    sourceClosedBayMaterialCount,
  } = applySourceMaterials(THREE, authored, textures, emissiveTextures);
  authored.updateMatrixWorld(true);
  const sourcePlacedJetways = buildSourcePlacedTerminal4Jetways(THREE, authored, jetwayTextures);
  if (!sourcePlacedJetways.userData.uploadedJetwayReady) {
    throw new Error("Terminal 4 uploaded jetway fleet did not expose a readiness promise");
  }
  await sourcePlacedJetways.userData.uploadedJetwayReady;
  if (
    sourcePlacedJetways.userData.uploadedJetwayLoadState !== "ready"
    || Number(sourcePlacedJetways.userData.uploadedJetwayCount) !== 58
    || Number(sourcePlacedJetways.userData.uploadedJetwayMeasuredTerminalConnectorCount) !== 58
    || Number(sourcePlacedJetways.userData.uploadedJetwayVerifiedModelCount) !== 58
    || sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority !== "user-supplied-airport-jetway-per-gate-telescoping-v10"
    || Number(sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount) !== 57
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters) > 0.05
    || Number(sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters) > 0.05
    || sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid !== true
  ) {
    throw new Error("Terminal 4 uploaded jetway fleet did not complete all 58 source placements");
  }
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
  environment.userData.authoredTerminal4A1JetwayController = sourcePlacedJetways.userData.a1JetwayController;
  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = sourcePlacedJetways.userData.a1JetwayAnimationAuthority;
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
  environment.userData.authoredTerminal4SourceClosedBayMaterialCount = sourceClosedBayMaterialCount;
  environment.userData.authoredTerminal4SourceFacadeSelectionAuthority = sourceFacadeVariation.authority;
  environment.userData.authoredTerminal4SourceFacadeSplitMeshCount = sourceFacadeVariation.splitMeshCount;
  environment.userData.authoredTerminal4SourceFacadeCellCount = sourceFacadeVariation.sourceCellCount;
  environment.userData.authoredTerminal4SourceFacadeOpenCellCount = sourceFacadeVariation.openCellCount;
  environment.userData.authoredTerminal4SourceFacadeClosedCellCount = sourceFacadeVariation.closedCellCount;
  environment.userData.authoredTerminal4SourceFacadeVariantMaterialCount = sourceFacadeVariation.variantMaterialCount;
  environment.userData.authoredTerminal4SourceFacadeSafeVariantAuthority = sourceFacadeVariation.safeVariantAuthority;
  environment.userData.authoredTerminal4SourceAlphaAuthority = "recovered-source-atlas-unused-quadrant-cutout";
  environment.userData.authoredTerminal4JetwayVisualCount = sourcePlacedJetways.userData.jetwayCount;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = sourcePlacedJetways.userData.terminalConnectedJetwayCount;
  environment.userData.authoredTerminal4A1JetwayWallDistance = sourcePlacedJetways.userData.a1TerminalWallDistance;
  environment.userData.authoredTerminal4JetwaySourceScaleAuthority = sourcePlacedJetways.userData.sourceScaleAuthority;
  environment.userData.authoredTerminal4JetwaySourceGeometryMode = sourcePlacedJetways.userData.sourceGeometryMode;
  environment.userData.authoredTerminal4UploadedJetwayLoadState = sourcePlacedJetways.userData.uploadedJetwayLoadState;
  environment.userData.authoredTerminal4UploadedJetwayCount = sourcePlacedJetways.userData.uploadedJetwayCount;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = sourcePlacedJetways.userData.uploadedJetwayMeasuredTerminalConnectorCount;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = sourcePlacedJetways.userData.uploadedJetwayVerifiedModelCount;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = sourcePlacedJetways.userData.uploadedJetwayReadyAuthority;
  environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority = sourcePlacedJetways.userData.uploadedJetwayArticulationAuthority;
  environment.userData.authoredTerminal4UploadedJetwaySourceContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwaySourceContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount = sourcePlacedJetways.userData.uploadedJetwayStaticArticulatedGateCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters = sourcePlacedJetways.userData.uploadedJetwayStaticMaximumContactErrorMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1TargetDoorDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters = sourcePlacedJetways.userData.uploadedJetwayA1AttachedExtensionMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1PredictedDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1PredictedContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualContactDistanceMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = sourcePlacedJetways.userData.uploadedJetwayA1ActualDoorGapMeters;
  environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid = sourcePlacedJetways.userData.uploadedJetwayA1PartOrderValid;
  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = sourcePlacedJetways.userData.uploadedJetwayA1PartCentersMeters;
  environment.userData.authoredTerminal4RequiresOriginalJetwayMesh = sourcePlacedJetways.userData.requiresOriginalSourceMesh === true;
  environment.userData.authoredTerminal4JetwayInitialState = sourcePlacedJetways.userData.initialJetwayState;
  environment.userData.authoredTerminal4JetwayRequiredPrePushSequence = sourcePlacedJetways.userData.requiredPrePushSequence;
  environment.userData.authoredTerminal4JetwayMotionLimits = sourcePlacedJetways.userData.jetwayMotionLimits;
  environment.userData.authoredTerminal4FacadeInfillCount = sourcePlacedJetways.userData.facadeInfillCount;
  environment.userData.authoredTerminal4LowerFacadeFitCount = sourcePlacedJetways.userData.lowerFacadeFitCount;
  environment.userData.authoredTerminal4JetwayTextureAuthority = sourcePlacedJetways.userData.jetwayTextureAuthority;
  environment.userData.authoredTerminal4ExactJetwayTextureActive = sourcePlacedJetways.userData.usesExactRecoveredJetwayTexture;
  environment.userData.authoredTerminal4ExactJetwayLightmapActive = sourcePlacedJetways.userData.usesExactRecoveredJetwayLightmap;
  environment.userData.authoredTerminal4OpenServiceBayCount = sourcePlacedJetways.userData.openServiceBayCount;
  environment.userData.authoredTerminal4FacadeInfillAuthority = sourcePlacedJetways.userData.facadeInfillAuthority;
  environment.userData.authoredTerminal4JetwayTerminalConnectionAuthority = sourcePlacedJetways.userData.terminalConnectionAuthority;
  environment.userData.authoredTerminal4A1TerminalPortalSealAuthority = sourcePlacedJetways.userData.a1TerminalPortalSealAuthority;
  environment.userData.authoredTerminal4A1TerminalPortalSealOverlapMeters = sourcePlacedJetways.userData.a1TerminalPortalSealOverlapMeters;
  environment.userData.authoredTerminal4A1TerminalPortalSealExactTexture = sourcePlacedJetways.userData.a1TerminalPortalSealExactTexture === true;
  environment.userData.authoredTerminal4JetwayDetailLevel = sourcePlacedJetways.userData.detailLevel;
  environment.userData.authoredTerminal4Position = [...AUTHORED_TERMINAL4_PROFILE.position];
  environment.userData.authoredTerminal4A1NearestGeometryDistance = a1NearestGeometryDistance;
  environment.userData.authoredTerminal4Bounds = {
    min: terminalBounds.min.toArray(),
    max: terminalBounds.max.toArray(),
  };
  return authored;
}
