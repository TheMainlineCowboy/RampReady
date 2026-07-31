const LOWER_FACADE_SOURCE_MATERIAL = /BGATE1|BGATE3|DGATE2|DGATE3|DGATE4|DGATE5|PHX_TERM400_1/i;
const LOWER_FACADE_MINIMUM_Y = 0;
const LOWER_FACADE_MAXIMUM_Y = 4.55;
// V9 is a cosmetic skin over the structural V8 facade. Legacy terminal meshes
// contain broad gate-corridor and corner-spanning triangles that are valid
// source topology but become detached ramp panels when copied as a second
// opaque surface. Keep only localized, single-module facade faces.
const LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS = 10;
// These exact source blocks sit in the A1 terminal-connection footprint. When
// the bounded authored-geometry filter is active, both aligned boxes have
// already been removed before V9 runs. The exclusion remains as a safe
// fallback for any unfiltered development runtime.
const A1_COSMETIC_SKIN_EXCLUSION = Object.freeze({
  minimumX: -22.5,
  maximumX: -12.5,
  minimumZ: -52,
  maximumZ: -25,
});

function buildConcreteTexture(THREE) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 0x4b504858;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const seam = x % 16 === 0 || y % 32 === 0 ? -8 : 0;
      const mottling = Math.round((random() - 0.5) * 10);
      data[index] = Math.max(0, Math.min(255, 198 + seam + mottling));
      data[index + 1] = Math.max(0, Math.min(255, 187 + seam + mottling));
      data[index + 2] = Math.max(0, Math.min(255, 170 + seam + mottling));
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = "Terminal 4 subtle lower-facade concrete skin v9";
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function sourceMaterialName(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return materials.flatMap((material) => [
    material?.name || "",
    material?.map?.name || "",
    material?.userData?.diffuseTexture || "",
    material?.userData?.sourceLightmap || "",
  ]).join(" ");
}

function horizontalSpan(points) {
  let maximum = 0;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      maximum = Math.max(
        maximum,
        Math.hypot(points[second].x - points[first].x, points[second].z - points[first].z),
      );
    }
  }
  return maximum;
}

function intersectsA1CosmeticExclusion(points) {
  const minimumX = Math.min(...points.map((point) => point.x));
  const maximumX = Math.max(...points.map((point) => point.x));
  const minimumZ = Math.min(...points.map((point) => point.z));
  const maximumZ = Math.max(...points.map((point) => point.z));
  return maximumX >= A1_COSMETIC_SKIN_EXCLUSION.minimumX
    && minimumX <= A1_COSMETIC_SKIN_EXCLUSION.maximumX
    && maximumZ >= A1_COSMETIC_SKIN_EXCLUSION.minimumZ
    && minimumZ <= A1_COSMETIC_SKIN_EXCLUSION.maximumZ;
}

function clipAgainstYPlane(THREE, polygon, limit, keepAbove) {
  if (!polygon.length) return [];
  const clipped = [];
  const inside = (point) => keepAbove ? point.y >= limit - 1e-6 : point.y <= limit + 1e-6;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const currentInside = inside(current);
    const nextInside = inside(next);
    if (currentInside) clipped.push(current.clone());
    if (currentInside === nextInside) continue;
    const denominator = next.y - current.y;
    if (Math.abs(denominator) < 1e-8) continue;
    const interpolation = (limit - current.y) / denominator;
    clipped.push(new THREE.Vector3(
      current.x + (next.x - current.x) * interpolation,
      limit,
      current.z + (next.z - current.z) * interpolation,
    ));
  }
  return clipped;
}

function clipLowerFacadeTriangle(THREE, triangle) {
  const aboveRamp = clipAgainstYPlane(THREE, triangle, LOWER_FACADE_MINIMUM_Y, true);
  return clipAgainstYPlane(THREE, aboveRamp, LOWER_FACADE_MAXIMUM_Y, false);
}

export function buildTerminal4LowerFacadeSkin(THREE, terminal, materials) {
  terminal.updateMatrixWorld(true);
  const positions = [];
  const uvs = [];
  const vertex = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  let sourceTriangleCount = 0;
  let renderedTriangleCount = 0;
  let rejectedOversizedTriangleCount = 0;
  let rejectedA1CosmeticTriangleCount = 0;
  let maximumAcceptedHorizontalSpanMeters = 0;

  terminal.traverse((node) => {
    if (!node.isMesh || node.visible === false || !LOWER_FACADE_SOURCE_MATERIAL.test(sourceMaterialName(node))) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position) return;
    const index = node.geometry.index;
    const triangleCount = index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      for (let corner = 0; corner < 3; corner += 1) {
        const sourceIndex = index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner;
        vertex[corner].fromBufferAttribute(position, sourceIndex);
        node.localToWorld(vertex[corner]);
      }
      const minimumY = Math.min(vertex[0].y, vertex[1].y, vertex[2].y);
      const maximumY = Math.max(vertex[0].y, vertex[1].y, vertex[2].y);
      if (maximumY < LOWER_FACADE_MINIMUM_Y || minimumY > LOWER_FACADE_MAXIMUM_Y) continue;

      const sourceHorizontalSpan = horizontalSpan(vertex);
      if (sourceHorizontalSpan > LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS) {
        rejectedOversizedTriangleCount += 1;
        continue;
      }

      edgeA.copy(vertex[1]).sub(vertex[0]);
      edgeB.copy(vertex[2]).sub(vertex[0]);
      normal.crossVectors(edgeA, edgeB);
      if (normal.lengthSq() < 1e-8) continue;
      normal.normalize();
      if (Math.abs(normal.y) > 0.34) continue;
      normal.y = 0;
      if (normal.lengthSq() < 1e-8) continue;
      normal.normalize();

      const clippedPolygon = clipLowerFacadeTriangle(THREE, vertex);
      if (clippedPolygon.length < 3) continue;
      const clippedHorizontalSpan = horizontalSpan(clippedPolygon);
      if (clippedHorizontalSpan > LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS) {
        rejectedOversizedTriangleCount += 1;
        continue;
      }
      if (intersectsA1CosmeticExclusion(clippedPolygon)) {
        rejectedA1CosmeticTriangleCount += 1;
        continue;
      }
      maximumAcceptedHorizontalSpanMeters = Math.max(maximumAcceptedHorizontalSpanMeters, clippedHorizontalSpan);
      sourceTriangleCount += 1;
      for (let polygonIndex = 1; polygonIndex < clippedPolygon.length - 1; polygonIndex += 1) {
        const clippedTriangle = [clippedPolygon[0], clippedPolygon[polygonIndex], clippedPolygon[polygonIndex + 1]];
        for (const side of [-1, 1]) {
          for (const point of clippedTriangle) {
            positions.push(
              point.x + normal.x * side * 0.065,
              point.y,
              point.z + normal.z * side * 0.065,
            );
            uvs.push(point.x * 0.055 + point.z * 0.027, point.y * 0.24);
          }
          renderedTriangleCount += 1;
        }
      }
    }
  });

  const authoredA1BlocksRemoved = Number(terminal.userData?.a1LegacyBlockRemovedTriangles) === 24;
  if (sourceTriangleCount < 120) {
    throw new Error(`Terminal 4 lower-facade skin found only ${sourceTriangleCount} source triangles`);
  }
  if (rejectedOversizedTriangleCount < 1) {
    throw new Error("Terminal 4 lower-facade skin did not reject any oversized legacy triangles");
  }
  if (!authoredA1BlocksRemoved && rejectedA1CosmeticTriangleCount < 4) {
    throw new Error(`Terminal 4 lower-facade skin rejected only ${rejectedA1CosmeticTriangleCount} A1 cosmetic triangles without the authored two-box filter`);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = materials.facadeWall.clone();
  material.name = "Terminal 4 source-shaped lower-facade concrete skin v9";
  material.map = buildConcreteTexture(THREE);
  material.color?.setHex(0xffffff);
  material.emissive?.setHex(0x000000);
  material.emissiveIntensity = 0;
  material.roughness = 0.88;
  material.metalness = 0.015;
  material.side = THREE.DoubleSide;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -1;

  const skin = new THREE.Mesh(geometry, material);
  skin.name = "Terminal4_SourceShapedLowerFacadeSkin_V9";
  skin.castShadow = true;
  skin.receiveShadow = true;
  skin.frustumCulled = true;
  skin.userData.sourceTriangleCount = sourceTriangleCount;
  skin.userData.renderedTriangleCount = renderedTriangleCount;
  skin.userData.rejectedOversizedTriangleCount = rejectedOversizedTriangleCount;
  skin.userData.rejectedA1CosmeticTriangleCount = rejectedA1CosmeticTriangleCount;
  skin.userData.authoredA1BlocksRemoved = authoredA1BlocksRemoved;
  skin.userData.a1CosmeticExclusion = { ...A1_COSMETIC_SKIN_EXCLUSION };
  skin.userData.maximumAcceptedHorizontalSpanMeters = maximumAcceptedHorizontalSpanMeters;
  skin.userData.maximumHorizontalSpanLimitMeters = LOWER_FACADE_MAXIMUM_HORIZONTAL_SPAN_METERS;
  skin.userData.maximumHeightMeters = LOWER_FACADE_MAXIMUM_Y;
  skin.userData.authority = "source-shaped-low-vertical-BGATE-DGATE-terminal-face-skin-v9-clipped-to-ramp-height";
  skin.userData.qualityPass = authoredA1BlocksRemoved
    ? "authored-a1-two-boxes-removed-before-localized-facade-skin-v11"
    : "localized-a1-cosmetic-exclusion-fallback-v11";
  return skin;
}
