const TARGET_MATERIAL_NAME = /^material-13-PHX_TERM400_1\.DDS$/i;
const EXPECTED_REMOVED_TRIANGLES = 12;
const TARGET_LOCAL_BOUNDS = Object.freeze({
  minimum: Object.freeze([-105.05, -0.05, 80.0]),
  maximum: Object.freeze([-96.83, 9.6, 88.22]),
});

function materialNames(material) {
  return (Array.isArray(material) ? material : [material])
    .filter(Boolean)
    .map((entry) => entry.name || "");
}

function pointInsideTarget(position, vertexIndex) {
  const x = position.getX(vertexIndex);
  const y = position.getY(vertexIndex);
  const z = position.getZ(vertexIndex);
  const [minimumX, minimumY, minimumZ] = TARGET_LOCAL_BOUNDS.minimum;
  const [maximumX, maximumY, maximumZ] = TARGET_LOCAL_BOUNDS.maximum;
  return x >= minimumX && x <= maximumX
    && y >= minimumY && y <= maximumY
    && z >= minimumZ && z <= maximumZ;
}

function copyAttribute(THREE, attribute, keptVertexIndices) {
  if (attribute.isInterleavedBufferAttribute) {
    const values = new Float32Array(keptVertexIndices.length * attribute.itemSize);
    for (let outputIndex = 0; outputIndex < keptVertexIndices.length; outputIndex += 1) {
      const sourceIndex = keptVertexIndices[outputIndex];
      for (let component = 0; component < attribute.itemSize; component += 1) {
        values[outputIndex * attribute.itemSize + component] = attribute.getComponent(sourceIndex, component);
      }
    }
    return new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized);
  }

  const ArrayType = attribute.array.constructor;
  const values = new ArrayType(keptVertexIndices.length * attribute.itemSize);
  for (let outputIndex = 0; outputIndex < keptVertexIndices.length; outputIndex += 1) {
    const sourceIndex = keptVertexIndices[outputIndex];
    const sourceOffset = sourceIndex * attribute.itemSize;
    const outputOffset = outputIndex * attribute.itemSize;
    for (let component = 0; component < attribute.itemSize; component += 1) {
      values[outputOffset + component] = attribute.array[sourceOffset + component];
    }
  }
  const copied = new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized);
  copied.setUsage(attribute.usage);
  copied.name = attribute.name;
  return copied;
}

function filterGeometry(THREE, geometry) {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = nonIndexed.getAttribute("position");
  if (!position || position.count % 3 !== 0) {
    throw new Error("Terminal 4 A1 legacy-block filter requires non-indexed triangle geometry");
  }

  const keptVertexIndices = [];
  let removedTriangles = 0;
  for (let firstVertex = 0; firstVertex < position.count; firstVertex += 3) {
    const inside = pointInsideTarget(position, firstVertex)
      && pointInsideTarget(position, firstVertex + 1)
      && pointInsideTarget(position, firstVertex + 2);
    if (inside) {
      removedTriangles += 1;
      continue;
    }
    keptVertexIndices.push(firstVertex, firstVertex + 1, firstVertex + 2);
  }

  if (removedTriangles === 0) {
    nonIndexed.dispose();
    return { geometry: null, removedTriangles: 0 };
  }

  const filtered = new THREE.BufferGeometry();
  filtered.name = `${geometry.name || "Terminal4Primitive"}_A1LegacyBlockRemoved`;
  for (const [name, attribute] of Object.entries(nonIndexed.attributes)) {
    filtered.setAttribute(name, copyAttribute(THREE, attribute, keptVertexIndices));
  }
  filtered.userData = {
    ...(geometry.userData || {}),
    a1LegacyBlockFilter: "exact-12-triangle-PHX_TERM400_1-box-removal-v1",
  };
  filtered.computeBoundingBox();
  filtered.computeBoundingSphere();
  nonIndexed.dispose();
  return { geometry: filtered, removedTriangles };
}

export function removeTerminal4A1LegacyBlock(THREE, terminal) {
  if (!terminal?.traverse) throw new Error("Terminal 4 scene is required for A1 legacy-block filtering");

  let matchingMeshCount = 0;
  let removedTriangleCount = 0;
  let sourceTriangleCount = 0;
  let retainedTriangleCount = 0;

  terminal.traverse((node) => {
    if (!node.isMesh || !materialNames(node.material).some((name) => TARGET_MATERIAL_NAME.test(name))) return;
    matchingMeshCount += 1;
    const position = node.geometry?.getAttribute?.("position");
    sourceTriangleCount += position ? Math.floor(position.count / 3) : 0;
    const result = filterGeometry(THREE, node.geometry);
    if (!result.geometry) return;
    node.geometry = result.geometry;
    removedTriangleCount += result.removedTriangles;
    retainedTriangleCount += Math.floor(result.geometry.getAttribute("position").count / 3);
    node.userData = {
      ...(node.userData || {}),
      a1LegacyBlockRemovedTriangles: result.removedTriangles,
      a1LegacyBlockAuthority: "exact-authored-PHX_TERM400_1-box-bounds-v1",
    };
  });

  if (matchingMeshCount !== 1) {
    throw new Error(`Terminal 4 A1 legacy-block filter matched ${matchingMeshCount} meshes instead of exactly 1`);
  }
  if (sourceTriangleCount !== 280) {
    throw new Error(`Terminal 4 A1 target primitive has ${sourceTriangleCount} triangles instead of 280`);
  }
  if (removedTriangleCount !== EXPECTED_REMOVED_TRIANGLES) {
    throw new Error(`Terminal 4 A1 legacy-block filter removed ${removedTriangleCount} triangles instead of ${EXPECTED_REMOVED_TRIANGLES}`);
  }
  if (retainedTriangleCount !== 268) {
    throw new Error(`Terminal 4 A1 target primitive retained ${retainedTriangleCount} triangles instead of 268`);
  }

  terminal.userData = {
    ...(terminal.userData || {}),
    a1LegacyBlockRemovedTriangles: removedTriangleCount,
    a1LegacyBlockSourceTriangles: sourceTriangleCount,
    a1LegacyBlockRetainedTriangles: retainedTriangleCount,
    a1LegacyBlockBounds: TARGET_LOCAL_BOUNDS,
    a1LegacyBlockAuthority: "surgical-exact-12-triangle-authored-box-removal-v1",
  };

  return {
    matchingMeshCount,
    removedTriangleCount,
    sourceTriangleCount,
    retainedTriangleCount,
  };
}
