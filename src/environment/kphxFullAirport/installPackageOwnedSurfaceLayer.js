import {
  KPHX_FULL_AIRPORT_SOURCE,
} from "./sourceAuthority.js";
import {
  KPHX_WED_CURVE_POLICY,
  flattenWedChain,
} from "./wedCurves.js";

function kphxRuntimeUrl(url) {
  if (!url || !url.startsWith("/")) return url;
  const base = String(import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  if (!base || base === "/") return url;
  if (url === base || url.startsWith(`${base}/`)) return url;
  return `${base}${url}`;
}

const DEFAULT_MANIFEST_URL = "/models/kphx-full-airport/surfaces/manifest.json";
const DEFAULT_NETWORK_URL = "/models/kphx-full-airport/surfaces/surface-network.json";

const LAYER_GROUP_ORDER = Object.freeze({
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

function layerOrder(layerGroup, fallbackGroup) {
  const group = layerGroup?.group || fallbackGroup;
  const offset = Number(layerGroup?.offset || 0);
  return (LAYER_GROUP_ORDER[group] ?? LAYER_GROUP_ORDER[fallbackGroup] ?? 0) + offset;
}

function resourceAssetUrl(resource, image) {
  if (!image) return null;
  return `${resource.outputBaseUrl}/${image.outputName}`;
}

async function loadTexture(THREE, loader, url, { color = true } = {}) {
  if (!url) return null;
  const texture = await loader.loadAsync(kphxRuntimeUrl(url));
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function polygonUv(point, headingDegrees, scaleMeters) {
  const heading = Number(headingDegrees || 0) * Math.PI / 180;
  const east = point.z - KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[2];
  const north = point.x - KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[0];
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  const uMeters = east * cos + north * sin;
  const vMeters = -east * sin + north * cos;
  return [
    uMeters / scaleMeters[0],
    vMeters / scaleMeters[1],
  ];
}

function triangulateRings(THREE, rings) {
  const flatRings = rings
    .map((ring) => flattenWedChain(ring.nodes, { closed: true }))
    .filter((ring) => ring.length >= 3);
  if (!flatRings.length) return null;

  const contour = flatRings[0].map((point) => new THREE.Vector2(point.x, point.z));
  const holes = flatRings.slice(1).map((ring) => ring.map((point) => new THREE.Vector2(point.x, point.z)));
  const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  const points = [...flatRings[0], ...flatRings.slice(1).flat()];
  return { flatRings, points, faces };
}

function createPolygonGeometry(THREE, placement, art) {
  if (!Array.isArray(art.scaleMeters) || art.scaleMeters.length < 2) {
    throw new Error(`WED polygon resource requires POL SCALE but none was materialized: ${placement.resource}`);
  }
  const data = triangulateRings(THREE, placement.rings || []);
  if (!data) return null;
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const point of data.points) {
    positions.push(point.x, 0, point.z);
    normals.push(0, 1, 0);
    uvs.push(...polygonUv(point, placement.placement?.heading, art.scaleMeters));
  }
  const indices = data.faces.flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createOrthophotoGeometry(THREE, placement) {
  const data = triangulateRings(THREE, placement.rings || []);
  if (!data) return null;
  const positions = [];
  const normals = [];
  const uvs = [];
  for (const point of data.points) {
    if (!Number.isFinite(point.s) || !Number.isFinite(point.t)) {
      throw new Error(`Draped orthophoto ${placement.id} is missing an authored WED texture coordinate`);
    }
    positions.push(point.x, 0, point.z);
    normals.push(0, 1, 0);
    uvs.push(point.s, point.t);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(data.faces.flat());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    wedAuthoredTextureCoordinates: true,
    textureCoordinatePolicy: "use-WED-s-t-directly-no-generated-UVs",
  };
  return geometry;
}

function lineFrames(points, closed) {
  const frames = [];
  const count = points.length;
  for (let index = 0; index < count; index += 1) {
    const current = points[index];
    const previous = points[index > 0 ? index - 1 : (closed ? count - 1 : 0)];
    const next = points[index < count - 1 ? index + 1 : (closed ? 0 : count - 1)];
    let tx = next.x - previous.x;
    let tz = next.z - previous.z;
    let length = Math.hypot(tx, tz);
    if (length < 1e-8) {
      tx = next.x - current.x;
      tz = next.z - current.z;
      length = Math.hypot(tx, tz) || 1;
    }
    tx /= length;
    tz /= length;
    frames.push({ nx: -tz, nz: tx });
  }
  return frames;
}

function lineDistances(points, closed) {
  const distance = [0];
  for (let index = 1; index < points.length; index += 1) {
    distance[index] = distance[index - 1] + Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].z - points[index - 1].z,
    );
  }
  if (closed) {
    distance.closedLength = distance.at(-1) + Math.hypot(
      points[0].x - points.at(-1).x,
      points[0].z - points.at(-1).z,
    );
  }
  return distance;
}

function createLineGeometry(THREE, placement, art, offset) {
  const closed = placement.closed === true;
  const points = flattenWedChain(placement.nodes || [], { closed });
  if (points.length < 2) return null;

  const leftMeters = (offset.center - offset.left) / art.textureWidth * art.scaleMeters[0];
  const rightMeters = (offset.right - offset.center) / art.textureWidth * art.scaleMeters[0];
  const frames = lineFrames(points, closed);
  const distances = lineDistances(points, closed);
  const positions = [];
  const normals = [];
  const uvs = [];

  const appendCrossSection = (point, frame, v) => {
    const columns = [
      { distance: leftMeters, u: offset.left / art.textureWidth },
      { distance: 0, u: offset.center / art.textureWidth },
      { distance: -rightMeters, u: offset.right / art.textureWidth },
    ];
    for (const column of columns) {
      positions.push(
        point.x + frame.nx * column.distance,
        0,
        point.z + frame.nz * column.distance,
      );
      normals.push(0, 1, 0);
      uvs.push(column.u, v);
    }
  };

  for (let index = 0; index < points.length; index += 1) {
    appendCrossSection(points[index], frames[index], distances[index] / art.scaleMeters[1]);
  }
  if (closed) {
    appendCrossSection(points[0], frames[0], distances.closedLength / art.scaleMeters[1]);
  }

  const crossSectionCount = closed ? points.length + 1 : points.length;
  const indices = [];
  for (let index = 0; index < crossSectionCount - 1; index += 1) {
    const a = index * 3;
    const b = (index + 1) * 3;
    indices.push(
      a, b, a + 1,
      a + 1, b, b + 1,
      a + 1, b + 1, a + 2,
      a + 2, b + 1, b + 2,
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = {
    xPlaneLineLeftMeters: leftMeters,
    xPlaneLineRightMeters: rightMeters,
    xPlaneMirror: art.mirror === true,
    xPlaneSOffset: offset,
  };
  return geometry;
}

function installDecalShader(THREE, material, decalResource, decalTextures) {
  const decals = decalResource?.decals || [];
  if (!decals.length || !Array.isArray(decalTextures) || decalTextures.length !== decals.length) return;

  for (const decal of decals) {
    if (decal.type !== "DECAL_PARAMS") throw new Error(`Unsupported decal type: ${decal.type}`);
    if (Math.abs(decal.rgbKey[4]) > 1e-12 || Math.abs(decal.alphaKey[4]) > 1e-12) {
      throw new Error("KPHX runtime refuses non-zero X-Plane decal modulator terms without a documented shader input");
    }
    if (Math.abs(Number(decal.dither || 0)) > 1e-12) {
      throw new Error("KPHX runtime refuses non-zero X-Plane decal dither without a documented shader input");
    }
  }

  material.userData.xPlaneDecals = decals;
  material.onBeforeCompile = (shader) => {
    const uniformDeclarations = [];
    const applicationBlocks = [];

    decals.forEach((decal, index) => {
      const suffix = String(index);
      shader.uniforms[`kphxDecalMap${suffix}`] = { value: decalTextures[index] };
      shader.uniforms[`kphxDecalScale${suffix}`] = { value: decal.scaleRatio };
      shader.uniforms[`kphxDecalRgbKey${suffix}`] = { value: new THREE.Vector4(...decal.rgbKey.slice(0, 4)) };
      shader.uniforms[`kphxDecalRgbConstant${suffix}`] = { value: decal.rgbKey[5] };
      shader.uniforms[`kphxDecalAlphaKey${suffix}`] = { value: new THREE.Vector4(...decal.alphaKey.slice(0, 4)) };
      shader.uniforms[`kphxDecalAlphaConstant${suffix}`] = { value: decal.alphaKey[5] };

      uniformDeclarations.push(
        `uniform sampler2D kphxDecalMap${suffix};`,
        `uniform float kphxDecalScale${suffix};`,
        `uniform vec4 kphxDecalRgbKey${suffix};`,
        `uniform float kphxDecalRgbConstant${suffix};`,
        `uniform vec4 kphxDecalAlphaKey${suffix};`,
        `uniform float kphxDecalAlphaConstant${suffix};`,
      );

      applicationBlocks.push(
        `  vec4 kphxDetail${suffix} = texture2D(kphxDecalMap${suffix}, vMapUv * kphxDecalScale${suffix});`,
        `  float kphxRgbWeight${suffix} = clamp(dot(diffuseColor, kphxDecalRgbKey${suffix}) + kphxDecalRgbConstant${suffix}, 0.0, 1.0);`,
        `  float kphxAlphaWeight${suffix} = clamp(dot(diffuseColor, kphxDecalAlphaKey${suffix}) + kphxDecalAlphaConstant${suffix}, 0.0, 1.0);`,
        `  diffuseColor.rgb = mix(diffuseColor.rgb, kphxHardLight(diffuseColor.rgb, kphxDetail${suffix}.rgb), kphxRgbWeight${suffix});`,
        `  diffuseColor.rgb = mix(diffuseColor.rgb, kphxHardLight(diffuseColor.rgb, vec3(kphxDetail${suffix}.a)), kphxAlphaWeight${suffix});`,
      );
    });

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
${uniformDeclarations.join("\n")}
vec3 kphxHardLight(vec3 base, vec3 blend) {
  vec3 low = 2.0 * base * blend;
  vec3 high = 1.0 - 2.0 * (1.0 - base) * (1.0 - blend);
  return mix(low, high, step(vec3(0.5), blend));
}`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
#ifdef USE_MAP
${applicationBlocks.join("\n")}
#endif`,
      );
    material.userData.kphxShader = shader;
  };
  material.customProgramCacheKey = () => `kphx-xplane-decals-${JSON.stringify(decals)}`;
}

async function createArtMaterial(THREE, textureLoader, textureCache, art, fallbackGroup) {
  const cachedTexture = async (image, { color }) => {
    if (!image) return null;
    const url = resourceAssetUrl(art, image);
    const identity = image.outputSha256 || image.outputDecodedRgbaSha256 || url;
    const key = `${identity}|${color ? "srgb" : "linear"}`;
    if (!textureCache.has(key)) {
      textureCache.set(key, loadTexture(THREE, textureLoader, url, { color }));
    }
    return textureCache.get(key);
  };

  const map = await cachedTexture(art.texture, { color: true });
  const normalMap = await cachedTexture(art.normal, { color: false });
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    roughness: 0.9,
    metalness: 0,
    transparent: art.noAlpha !== true,
    alphaTest: art.noAlpha === true ? 0 : 0.001,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (normalMap && Number.isFinite(art.normalScale)) {
    material.normalScale.set(art.normalScale, art.normalScale);
  }
  const order = layerOrder(art.layerGroup, fallbackGroup);
  material.userData.xPlaneLayerOrder = order;
  material.userData.xPlaneArtResource = art.sourceResource;
  material.userData.xPlaneGlobalSpecular = Number.isFinite(art.globalSpecular) ? art.globalSpecular : null;
  material.userData.xPlaneWeatherTexture = art.weather?.outputName || null;
  material.userData.xPlaneTextureHeight = Number.isFinite(art.textureHeight) ? art.textureHeight : null;

  if (art.decal?.decals?.length) {
    const decalTextures = await Promise.all(
      art.decal.decals.map((decal) => cachedTexture(decal.image, { color: true })),
    );
    installDecalShader(THREE, material, art.decal, decalTextures);
    material.userData.xPlaneDecalTextures = decalTextures;
  }
  return material;
}

export async function installKphxPackageOwnedSurfaceLayer(
  THREE,
  environment,
  {
    manifestUrl = DEFAULT_MANIFEST_URL,
    networkUrl = DEFAULT_NETWORK_URL,
    textureLoader = new THREE.TextureLoader(),
    strict = true,
    loadPolygons = true,
    loadDrapedOrthophotos = true,
    loadLines = true,
  } = {},
) {
  if (!environment?.add) throw new Error("KPHX surface loader requires a Three.js environment group");

  const resolvedManifestUrl = kphxRuntimeUrl(manifestUrl);
  const resolvedNetworkUrl = kphxRuntimeUrl(networkUrl);
  const [manifestResponse, networkResponse] = await Promise.all([
    fetch(resolvedManifestUrl, { cache: "no-cache" }),
    fetch(resolvedNetworkUrl, { cache: "no-cache" }),
  ]);
  if (!manifestResponse.ok) throw new Error(`KPHX surface manifest returned HTTP ${manifestResponse.status}`);
  if (!networkResponse.ok) throw new Error(`KPHX surface network returned HTTP ${networkResponse.status}`);
  const [manifest, network] = await Promise.all([manifestResponse.json(), networkResponse.json()]);

  if (manifest?.source?.version !== KPHX_FULL_AIRPORT_SOURCE.packageVersion) {
    throw new Error(`KPHX surface/source version mismatch: ${manifest?.source?.version || "unknown"}`);
  }
  if (strict && manifest.failures?.length) {
    throw new Error(`KPHX surface manifest contains ${manifest.failures.length} materialization failures`);
  }

  const layer = new THREE.Group();
  layer.name = "KPHX_FULL_AIRPORT_PACKAGE_SURFACES";
  const materials = new Map();
  const textureCache = new Map();
  const failures = [];
  let polygonCount = 0;
  let drapedOrthophotoCount = 0;
  let lineMeshCount = 0;
  const resolvedExternalPrefixes = new Set(manifest.policy?.externalPrefixes || []);
  const isSelectedSurfacePlacement = (entry) => (
    entry.sourceClass === "package-owned"
    || resolvedExternalPrefixes.has(entry.resourcePrefix)
  );

  async function materialFor(resourceName, fallbackGroup) {
    const key = `${resourceName}|${fallbackGroup}`;
    if (materials.has(key)) return materials.get(key);
    const art = manifest.resources?.[resourceName];
    if (!art) throw new Error(`Materialized KPHX surface resource missing from manifest: ${resourceName}`);
    const material = await createArtMaterial(THREE, textureLoader, textureCache, art, fallbackGroup);
    materials.set(key, material);
    return material;
  }

  for (const placement of (loadPolygons ? network.polygons : []).filter(isSelectedSurfacePlacement)) {
    try {
      const art = manifest.resources[placement.resource];
      const geometry = createPolygonGeometry(THREE, placement, art);
      if (!geometry) continue;
      const material = await materialFor(placement.resource, "taxiways");
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `KPHX_POL_${placement.id}_${placement.name}`;
      mesh.renderOrder = material.userData.xPlaneLayerOrder;
      mesh.receiveShadow = true;
      mesh.userData = {
        kphxFullAirport: true,
        kphxSurface: true,
        wedObjectId: placement.id,
        sourceResource: placement.resource,
        physicalSurface: art.surface,
        xPlaneLayerGroup: art.layerGroup,
      };
      layer.add(mesh);
      polygonCount += 1;
    } catch (error) {
      failures.push({ type: "polygon", id: placement.id, resource: placement.resource, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const placement of (loadDrapedOrthophotos ? network.drapedOrthophotos : []).filter(isSelectedSurfacePlacement)) {
    try {
      const art = manifest.resources[placement.resource];
      if (!art) throw new Error(`Materialized KPHX draped resource missing: ${placement.resource}`);
      const geometry = createOrthophotoGeometry(THREE, placement);
      if (!geometry) continue;
      const material = await materialFor(placement.resource, "markings");
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `KPHX_ORTHO_${placement.id}_${placement.name}`;
      mesh.renderOrder = material.userData.xPlaneLayerOrder;
      mesh.receiveShadow = true;
      mesh.userData = {
        kphxFullAirport: true,
        kphxSurface: true,
        wedDrapedOrthophoto: true,
        wedObjectId: placement.id,
        sourceResource: placement.resource,
        xPlaneLayerGroup: art.layerGroup,
        textureCoordinatePolicy: "earth.wed.xml texture_node s/t",
      };
      layer.add(mesh);
      drapedOrthophotoCount += 1;
    } catch (error) {
      failures.push({ type: "drapedOrthophoto", id: placement.id, resource: placement.resource, message: error instanceof Error ? error.message : String(error) });
    }
  }

  for (const placement of (loadLines ? network.lines : []).filter(isSelectedSurfacePlacement)) {
    try {
      const art = manifest.resources[placement.resource];
      const material = await materialFor(placement.resource, "markings");
      for (const offset of art.sOffsets) {
        const geometry = createLineGeometry(THREE, placement, art, offset);
        if (!geometry) continue;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `KPHX_LIN_${placement.id}_L${offset.layer}_${placement.name}`;
        mesh.renderOrder = material.userData.xPlaneLayerOrder + offset.layer * 0.001;
        mesh.receiveShadow = true;
        mesh.userData = {
          kphxFullAirport: true,
          kphxSurface: true,
          wedObjectId: placement.id,
          sourceResource: placement.resource,
          xPlaneLayerGroup: art.layerGroup,
          xPlaneLineLayer: offset.layer,
          xPlaneMirror: art.mirror,
        };
        layer.add(mesh);
        lineMeshCount += 1;
      }
    } catch (error) {
      failures.push({ type: "line", id: placement.id, resource: placement.resource, message: error instanceof Error ? error.message : String(error) });
    }
  }

  layer.userData = {
    kphxFullAirport: true,
    sourceVersion: manifest.source.version,
    curvePolicy: KPHX_WED_CURVE_POLICY,
    polygonCount,
    drapedOrthophotoCount,
    lineMeshCount,
    materialCount: materials.size,
    uniqueTextureDecodeCount: textureCache.size,
    failures,
    ready: failures.length === 0,
    resolvedExternalPrefixes: [...resolvedExternalPrefixes],
    externalPolygonCount: network.polygons.filter((entry) => entry.sourceClass !== "package-owned").length,
    externalDrapedOrthophotoCount: network.drapedOrthophotos.filter((entry) => entry.sourceClass !== "package-owned").length,
    externalLineCount: network.lines.filter((entry) => entry.sourceClass !== "package-owned").length,
    requestedPlacementTypes: {
      polygons: loadPolygons,
      drapedOrthophotos: loadDrapedOrthophotos,
      lines: loadLines,
    },
  };

  if (strict && failures.length) {
    materials.forEach((material) => material.dispose());
    layer.traverse((child) => child.geometry?.dispose?.());
    throw new Error(`KPHX package surface layer failed for ${failures.length} WED placements`);
  }

  environment.add(layer);
  environment.userData = {
    ...(environment.userData || {}),
    kphxFullAirportSurfaces: { ...layer.userData },
  };
  return { layer, manifest, network, ready: layer.userData.ready, failures };
}
