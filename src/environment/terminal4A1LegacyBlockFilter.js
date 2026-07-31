const TARGET_MATERIAL_NAME = /^material-13-PHX_TERM400_1\.DDS$/i;
const EXPECTED_SOURCE_TRIANGLES = 280;
const EXPECTED_TRIANGLES_PER_BOX = 12;
const EXPECTED_REMOVED_TRIANGLES = 24;
const EXPECTED_RETAINED_TRIANGLES = 256;

// Two isolated authored boxes share the same A1-side footprint and sit one
// behind the other. Removing only the nearer 12-triangle box exposed the
// identical rear box in the same camera line. These exact local-space bounds
// target both standalone boxes without touching the surrounding terminal.
const TARGET_LOCAL_BOXES = Object.freeze([
  Object.freeze({
    id: "A1-near-legacy-box",
    minimum: Object.freeze([-105.05, -0.05, 80.0]),
    maximum: Object.freeze([-96.83, 9.6, 88.22]),
  }),
  Object.freeze({
    id: "A1-rear-legacy-box",
    minimum: Object.freeze([-122.27, -0.05, 80.0]),
    maximum: Object.freeze([-117.05, 9.6, 88.22]),
  }),
]);

function materialNames(material) {
  return (Array.isArray(material) ? material : [material])
    .filter(Boolean)
    .map((entry) => entry.name || "");
}

function pointInsideBox(position, vertexIndex, box) {
  const x = position.getX(vertexIndex);
  const y = position.getY(vertexIndex);
  const z = position.getZ(vertexIndex);
  const [minimumX, minimumY, minimumZ] = box.minimum;
  const [maximumX, maximumY, maximumZ] = box.maximum;
  return x >= minimumX && x <= maximumX
    && y >= minimumY && y <= maximumY
    && z >= minimumZ && z <= maximumZ;
}

function triangleTargetIndex(position, firstVertex) {
  return TARGET_LOCAL_BOXES.findIndex((box) =>
    pointInsideBox(position, firstVertex, box)
    && pointInsideBox(position, firstVertex + 1, box)
    && pointInsideBox(position, firstVertex + 2, box));
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
  const removedByTarget = TARGET_LOCAL_BOXES.map(() => 0);
  for (let firstVertex = 0; firstVertex < position.count; firstVertex += 3) {
    const targetIndex = triangleTargetIndex(position, firstVertex);
    if (targetIndex >= 0) {
      removedByTarget[targetIndex] += 1;
      continue;
    }
    keptVertexIndices.push(firstVertex, firstVertex + 1, firstVertex + 2);
  }

  const removedTriangles = removedByTarget.reduce((sum, count) => sum + count, 0);
  if (removedTriangles === 0) {
    nonIndexed.dispose();
    return { geometry: null, removedTriangles: 0, removedByTarget };
  }

  const filtered = new THREE.BufferGeometry();
  filtered.name = `${geometry.name || "Terminal4Primitive"}_A1LegacyBlocksRemoved`;
  for (const [name, attribute] of Object.entries(nonIndexed.attributes)) {
    filtered.setAttribute(name, copyAttribute(THREE, attribute, keptVertexIndices));
  }
  filtered.userData = {
    ...(geometry.userData || {}),
    a1LegacyBlockFilter: "exact-two-box-24-triangle-PHX_TERM400_1-removal-v2",
    a1LegacyBlockRemovedByTarget: Object.fromEntries(
      TARGET_LOCAL_BOXES.map((box, index) => [box.id, removedByTarget[index]]),
    ),
  };
  filtered.computeBoundingBox();
  filtered.computeBoundingSphere();
  nonIndexed.dispose();
  return { geometry: filtered, removedTriangles, removedByTarget };
}

export function removeTerminal4A1LegacyBlock(THREE, terminal) {
  if (!terminal?.traverse) throw new Error("Terminal 4 scene is required for A1 legacy-block filtering");

  let matchingMeshCount = 0;
  let removedTriangleCount = 0;
  let sourceTriangleCount = 0;
  let retainedTriangleCount = 0;
  const removedByTarget = TARGET_LOCAL_BOXES.map(() => 0);

  terminal.traverse((node) => {
    if (!node.isMesh || !materialNames(node.material).some((name) => TARGET_MATERIAL_NAME.test(name))) return;
    matchingMeshCount += 1;
    const position = node.geometry?.getAttribute?.("position");
    sourceTriangleCount += position ? Math.floor(position.count / 3) : 0;
    const result = filterGeometry(THREE, node.geometry);
    if (!result.geometry) return;
    node.geometry = result.geometry;
    removedTriangleCount += result.removedTriangles;
    result.removedByTarget.forEach((count, index) => { removedByTarget[index] += count; });
    retainedTriangleCount += Math.floor(result.geometry.getAttribute("position").count / 3);
    node.userData = {
      ...(node.userData || {}),
      a1LegacyBlockRemovedTriangles: result.removedTriangles,
      a1LegacyBlockRemovedByTarget: Object.fromEntries(
        TARGET_LOCAL_BOXES.map((box, index) => [box.id, result.removedByTarget[index]]),
      ),
      a1LegacyBlockAuthority: "exact-authored-PHX_TERM400_1-two-box-bounds-v2",
    };
  });

  if (matchingMeshCount !== 1) {
    throw new Error(`Terminal 4 A1 legacy-block filter matched ${matchingMeshCount} meshes instead of exactly 1`);
  }
  if (sourceTriangleCount !== EXPECTED_SOURCE_TRIANGLES) {
    throw new Error(`Terminal 4 A1 target primitive has ${sourceTriangleCount} triangles instead of ${EXPECTED_SOURCE_TRIANGLES}`);
  }
  removedByTarget.forEach((count, index) => {
    if (count !== EXPECTED_TRIANGLES_PER_BOX) {
      throw new Error(`Terminal 4 A1 legacy-block target ${TARGET_LOCAL_BOXES[index].id} removed ${count} triangles instead of ${EXPECTED_TRIANGLES_PER_BOX}`);
    }
  });
  if (removedTriangleCount !== EXPECTED_REMOVED_TRIANGLES) {
    throw new Error(`Terminal 4 A1 legacy-block filter removed ${removedTriangleCount} triangles instead of ${EXPECTED_REMOVED_TRIANGLES}`);
  }
  if (retainedTriangleCount !== EXPECTED_RETAINED_TRIANGLES) {
    throw new Error(`Terminal 4 A1 target primitive retained ${retainedTriangleCount} triangles instead of ${EXPECTED_RETAINED_TRIANGLES}`);
  }

  const removedByTargetEvidence = Object.fromEntries(
    TARGET_LOCAL_BOXES.map((box, index) => [box.id, removedByTarget[index]]),
  );
  terminal.userData = {
    ...(terminal.userData || {}),
    a1LegacyBlockRemovedTriangles: removedTriangleCount,
    a1LegacyBlockRemovedByTarget: removedByTargetEvidence,
    a1LegacyBlockSourceTriangles: sourceTriangleCount,
    a1LegacyBlockRetainedTriangles: retainedTriangleCount,
    a1LegacyBlockBounds: TARGET_LOCAL_BOXES,
    a1LegacyBlockAuthority: "surgical-exact-two-box-24-triangle-authored-removal-v2",
  };

  return {
    matchingMeshCount,
    removedTriangleCount,
    removedByTarget: removedByTargetEvidence,
    sourceTriangleCount,
    retainedTriangleCount,
  };
}
