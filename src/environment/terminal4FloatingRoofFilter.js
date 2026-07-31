const TARGET_MATERIAL_NAME = /^material-12-PHX_TERM400_1\.DDS$/i;
const EXPECTED_SOURCE_TRIANGLES = 268;
const EXPECTED_REMOVED_TRIANGLES = 4;
const EXPECTED_RETAINED_TRIANGLES = 264;

// Four source triangles form two horizontal 19.8 x 57.1 m rectangles at
// Y=24.036 m. Their UVs point into a fully black part of PHX_TERM400_1 and the
// surrounding support geometry is absent, so they render as unmistakable
// floating black slabs above Terminal 4. These exact local bounds remove only
// those two detached rectangles and preserve every connected terminal roof.
const TARGET_LOCAL_SLABS = Object.freeze([
  Object.freeze({
    id: "east-floating-black-roof-slab",
    minimum: Object.freeze([76.65, 23.95, -40.2]),
    maximum: Object.freeze([96.7, 24.12, 17.1]),
  }),
  Object.freeze({
    id: "west-floating-black-roof-slab",
    minimum: Object.freeze([-89.45, 23.95, -40.0]),
    maximum: Object.freeze([-69.4, 24.12, 17.35]),
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

function targetIndex(position, firstVertex) {
  return TARGET_LOCAL_SLABS.findIndex((box) =>
    pointInsideBox(position, firstVertex, box)
    && pointInsideBox(position, firstVertex + 1, box)
    && pointInsideBox(position, firstVertex + 2, box));
}

function copyAttribute(THREE, attribute, keptVertexIndices) {
  const ArrayType = attribute.array.constructor;
  const values = new ArrayType(keptVertexIndices.length * attribute.itemSize);
  for (let outputIndex = 0; outputIndex < keptVertexIndices.length; outputIndex += 1) {
    const sourceIndex = keptVertexIndices[outputIndex];
    for (let component = 0; component < attribute.itemSize; component += 1) {
      const value = attribute.getComponent
        ? attribute.getComponent(sourceIndex, component)
        : attribute.array[sourceIndex * attribute.itemSize + component];
      values[outputIndex * attribute.itemSize + component] = value;
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
    throw new Error("Terminal 4 floating-roof filter requires triangle geometry");
  }

  const keptVertexIndices = [];
  const removedByTarget = TARGET_LOCAL_SLABS.map(() => 0);
  for (let firstVertex = 0; firstVertex < position.count; firstVertex += 3) {
    const slabIndex = targetIndex(position, firstVertex);
    if (slabIndex >= 0) {
      removedByTarget[slabIndex] += 1;
      continue;
    }
    keptVertexIndices.push(firstVertex, firstVertex + 1, firstVertex + 2);
  }

  const removedTriangles = removedByTarget.reduce((sum, count) => sum + count, 0);
  if (!removedTriangles) {
    nonIndexed.dispose();
    return { geometry: null, removedTriangles: 0, removedByTarget };
  }

  const filtered = new THREE.BufferGeometry();
  filtered.name = `${geometry.name || "Terminal4Primitive"}_FloatingRoofSlabsRemoved`;
  for (const [name, attribute] of Object.entries(nonIndexed.attributes)) {
    filtered.setAttribute(name, copyAttribute(THREE, attribute, keptVertexIndices));
  }
  filtered.userData = {
    ...(geometry.userData || {}),
    floatingRoofFilter: "exact-two-rectangle-four-triangle-PHX_TERM400_1-removal-v1",
  };
  filtered.computeBoundingBox();
  filtered.computeBoundingSphere();
  nonIndexed.dispose();
  return { geometry: filtered, removedTriangles, removedByTarget };
}

export function removeTerminal4FloatingRoofSlabs(THREE, terminal) {
  if (!terminal?.traverse) throw new Error("Terminal 4 scene is required for floating-roof filtering");

  let matchingMeshCount = 0;
  let sourceTriangleCount = 0;
  let removedTriangleCount = 0;
  let retainedTriangleCount = 0;
  const removedByTarget = TARGET_LOCAL_SLABS.map(() => 0);

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
    result.removedByTarget.forEach((count, index) => { removedByTarget[index] += count; });
  });

  if (matchingMeshCount !== 1) {
    throw new Error(`Terminal 4 floating-roof filter matched ${matchingMeshCount} meshes instead of 1`);
  }
  if (sourceTriangleCount !== EXPECTED_SOURCE_TRIANGLES) {
    throw new Error(`Terminal 4 floating-roof source has ${sourceTriangleCount} triangles instead of ${EXPECTED_SOURCE_TRIANGLES}`);
  }
  if (removedTriangleCount !== EXPECTED_REMOVED_TRIANGLES) {
    throw new Error(`Terminal 4 floating-roof filter removed ${removedTriangleCount} triangles instead of ${EXPECTED_REMOVED_TRIANGLES}`);
  }
  if (retainedTriangleCount !== EXPECTED_RETAINED_TRIANGLES) {
    throw new Error(`Terminal 4 floating-roof filter retained ${retainedTriangleCount} triangles instead of ${EXPECTED_RETAINED_TRIANGLES}`);
  }
  removedByTarget.forEach((count, index) => {
    if (count !== 2) throw new Error(`Terminal 4 ${TARGET_LOCAL_SLABS[index].id} removed ${count} triangles instead of 2`);
  });

  const evidence = Object.fromEntries(TARGET_LOCAL_SLABS.map((box, index) => [box.id, removedByTarget[index]]));
  terminal.userData = {
    ...(terminal.userData || {}),
    floatingRoofRemovedTriangles: removedTriangleCount,
    floatingRoofRemovedByTarget: evidence,
    floatingRoofSourceTriangles: sourceTriangleCount,
    floatingRoofRetainedTriangles: retainedTriangleCount,
    floatingRoofAuthority: "exact-floating-black-roof-two-rectangle-four-triangle-removal-v1",
  };
  return {
    matchingMeshCount,
    sourceTriangleCount,
    removedTriangleCount,
    retainedTriangleCount,
    removedByTarget: evidence,
  };
}
