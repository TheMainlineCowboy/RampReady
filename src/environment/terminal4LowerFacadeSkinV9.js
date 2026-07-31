const LOWER_FACADE_SOURCE_MATERIAL = /BGATE1|BGATE3|DGATE2|DGATE3|DGATE4|DGATE5|PHX_TERM400_1/i;

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
  return materials.map((material) => material?.name || "").join(" ");
}

export function buildTerminal4LowerFacadeSkin(THREE, terminal, materials) {
  terminal.updateMatrixWorld(true);
  const positions = [];
  const uvs = [];
  const vertex = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const centroid = new THREE.Vector3();
  let sourceTriangleCount = 0;

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
      centroid.copy(vertex[0]).add(vertex[1]).add(vertex[2]).multiplyScalar(1 / 3);
      const maximumY = Math.max(vertex[0].y, vertex[1].y, vertex[2].y);
      if (centroid.y < 0 || centroid.y > 4.05 || maximumY > 4.55) continue;
      edgeA.copy(vertex[1]).sub(vertex[0]);
      edgeB.copy(vertex[2]).sub(vertex[0]);
      normal.crossVectors(edgeA, edgeB);
      if (normal.lengthSq() < 1e-8) continue;
      normal.normalize();
      if (Math.abs(normal.y) > 0.34) continue;
      normal.y = 0;
      if (normal.lengthSq() < 1e-8) continue;
      normal.normalize();

      for (const side of [-1, 1]) {
        for (let corner = 0; corner < 3; corner += 1) {
          const point = vertex[corner];
          positions.push(
            point.x + normal.x * side * 0.065,
            point.y,
            point.z + normal.z * side * 0.065,
          );
          uvs.push(point.x * 0.055 + point.z * 0.027, point.y * 0.24);
        }
      }
      sourceTriangleCount += 1;
    }
  });

  if (sourceTriangleCount < 120) {
    throw new Error(`Terminal 4 lower-facade skin found only ${sourceTriangleCount} source triangles`);
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
  skin.userData.renderedTriangleCount = sourceTriangleCount * 2;
  skin.userData.maximumHeightMeters = 4.55;
  skin.userData.authority = "source-shaped-low-vertical-BGATE-DGATE-terminal-face-skin-v9";
  return skin;
}
