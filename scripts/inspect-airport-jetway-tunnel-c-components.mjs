import fs from "node:fs";
import * as THREE from "three";

const GLB_PATH = "public/models/airport-jetway/Airport_Jetway.glb";
const WELD_EPSILON = 1e-5;

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF" || bytes.readUInt32LE(4) !== 2) {
    throw new Error("Airport_Jetway.glb is not GLB 2.0");
  }
  let cursor = 12;
  let json;
  let binary;
  while (cursor + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const payload = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(payload.toString("utf8").replace(/\u0000+$/g, "").trimEnd());
    if (type === 0x004e4942) binary = payload;
    cursor += 8 + length;
  }
  if (!json || !binary) throw new Error("Airport_Jetway.glb is missing JSON/BIN chunks");
  return { json, binary };
}

const COMPONENT_TYPES = Object.freeze({
  5120: { bytes: 1, read: "readInt8" },
  5121: { bytes: 1, read: "readUInt8" },
  5122: { bytes: 2, read: "readInt16LE" },
  5123: { bytes: 2, read: "readUInt16LE" },
  5125: { bytes: 4, read: "readUInt32LE" },
  5126: { bytes: 4, read: "readFloatLE" },
});
const TYPE_COMPONENTS = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 });

function readAccessor(json, binary, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  if (accessor.sparse) throw new Error(`Sparse accessor ${accessorIndex} is not supported by the topology inspector`);
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) throw new Error(`Accessor ${accessorIndex} has no bufferView`);
  const component = COMPONENT_TYPES[accessor.componentType];
  const componentCount = TYPE_COMPONENTS[accessor.type];
  if (!component || !componentCount) throw new Error(`Accessor ${accessorIndex} has unsupported type ${accessor.componentType}/${accessor.type}`);
  const packedStride = component.bytes * componentCount;
  const stride = view.byteStride || packedStride;
  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const values = new Array(accessor.count);
  for (let i = 0; i < accessor.count; i += 1) {
    const row = new Array(componentCount);
    const rowBase = base + i * stride;
    for (let c = 0; c < componentCount; c += 1) row[c] = binary[component.read](rowBase + c * component.bytes);
    values[i] = componentCount === 1 ? row[0] : row;
  }
  return values;
}

function localMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return new THREE.Matrix4().fromArray(node.matrix);
  const position = new THREE.Vector3(...(node.translation || [0, 0, 0]));
  const quaternion = new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1]));
  const scale = new THREE.Vector3(...(node.scale || [1, 1, 1]));
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

function worldMatrixForNode(json, nodeIndex) {
  const parents = new Map();
  json.nodes?.forEach((node, parentIndex) => {
    for (const child of node.children || []) parents.set(child, parentIndex);
  });
  const chain = [];
  let current = nodeIndex;
  while (current !== undefined) {
    chain.push(current);
    current = parents.get(current);
  }
  const matrix = new THREE.Matrix4().identity();
  for (const index of chain.reverse()) matrix.multiply(localMatrix(json.nodes[index]));
  return matrix;
}

function meshNodeIndex(json, meshIndex) {
  const index = json.nodes?.findIndex((node) => node.mesh === meshIndex) ?? -1;
  if (index < 0) throw new Error(`Mesh ${meshIndex} has no node`);
  return index;
}

function meshBounds(json, binary, meshName) {
  const meshIndex = json.meshes?.findIndex((mesh) => mesh.name === meshName) ?? -1;
  if (meshIndex < 0) throw new Error(`Missing mesh ${meshName}`);
  const mesh = json.meshes[meshIndex];
  const nodeIndex = meshNodeIndex(json, meshIndex);
  const matrix = worldMatrixForNode(json, nodeIndex);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const primitive of mesh.primitives || []) {
    const positions = readAccessor(json, binary, primitive.attributes.POSITION);
    for (const p of positions) box.expandByPoint(point.fromArray(p).applyMatrix4(matrix));
  }
  return { box, center: box.getCenter(new THREE.Vector3()), matrix, meshIndex, nodeIndex };
}

function unionFind(size) {
  const parent = Array.from({ length: size }, (_, i) => i);
  const rank = new Uint8Array(size);
  const find = (x) => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    while (parent[x] !== x) {
      const next = parent[x];
      parent[x] = root;
      x = next;
    }
    return root;
  };
  const union = (a, b) => {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra] += 1;
  };
  return { find, union };
}

function weldKey(position) {
  return position.map((value) => Math.round(value / WELD_EPSILON)).join(":");
}

const bytes = fs.readFileSync(GLB_PATH);
const { json, binary } = parseGlb(bytes);
const tunnelMeshIndex = json.meshes?.findIndex((mesh) => mesh.name === "Tunnel_C_Jetway_0") ?? -1;
if (tunnelMeshIndex < 0) throw new Error("Exact GLB is missing Tunnel_C_Jetway_0");
const tunnelMesh = json.meshes[tunnelMeshIndex];
if ((tunnelMesh.primitives || []).length !== 1) throw new Error(`Tunnel_C_Jetway_0 expected one primitive, received ${tunnelMesh.primitives?.length ?? 0}`);
const primitive = tunnelMesh.primitives[0];
const positions = readAccessor(json, binary, primitive.attributes.POSITION);
const indices = primitive.indices === undefined
  ? Array.from({ length: positions.length }, (_, i) => i)
  : readAccessor(json, binary, primitive.indices);
if (indices.length % 3 !== 0) throw new Error(`Tunnel_C index count is not triangular: ${indices.length}`);

const uf = unionFind(positions.length);
const firstVertexForPosition = new Map();
let weldedDuplicateCount = 0;
for (let i = 0; i < positions.length; i += 1) {
  const key = weldKey(positions[i]);
  const existing = firstVertexForPosition.get(key);
  if (existing === undefined) firstVertexForPosition.set(key, i);
  else {
    uf.union(i, existing);
    weldedDuplicateCount += 1;
  }
}
for (let i = 0; i < indices.length; i += 3) {
  uf.union(indices[i], indices[i + 1]);
  uf.union(indices[i + 1], indices[i + 2]);
  uf.union(indices[i + 2], indices[i]);
}

const componentVertices = new Map();
const componentTriangles = new Map();
for (let i = 0; i < positions.length; i += 1) {
  const root = uf.find(i);
  if (!componentVertices.has(root)) componentVertices.set(root, []);
  componentVertices.get(root).push(i);
}
for (let i = 0; i < indices.length; i += 3) {
  const root = uf.find(indices[i]);
  componentTriangles.set(root, (componentTriangles.get(root) || 0) + 1);
}

const tunnelNodeIndex = meshNodeIndex(json, tunnelMeshIndex);
const tunnelWorld = worldMatrixForNode(json, tunnelNodeIndex);
const rotunda = meshBounds(json, binary, "Rotunda_Jetway_0");
const cab = meshBounds(json, binary, "Cab_Jetway_0");
const axis = cab.center.clone().sub(rotunda.center);
axis.y = 0;
const axisLengthSq = axis.lengthSq();
if (axisLengthSq < 1) throw new Error("Rotunda-to-Cab source axis is invalid");
const point = new THREE.Vector3();
const components = [...componentVertices.entries()].map(([root, vertices]) => {
  const box = new THREE.Box3();
  const uniquePositions = new Set();
  for (const vertexIndex of vertices) {
    uniquePositions.add(weldKey(positions[vertexIndex]));
    box.expandByPoint(point.fromArray(positions[vertexIndex]).applyMatrix4(tunnelWorld));
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const offset = center.clone().sub(rotunda.center);
  offset.y = 0;
  const axisT = offset.dot(axis) / axisLengthSq;
  const horizontalDistanceToRotunda = Math.hypot(center.x - rotunda.center.x, center.z - rotunda.center.z);
  const horizontalDistanceToCab = Math.hypot(center.x - cab.center.x, center.z - cab.center.z);
  return {
    root,
    vertexCount: vertices.length,
    uniqueVertexCount: uniquePositions.size,
    triangleCount: componentTriangles.get(root) || 0,
    axisT: Number(axisT.toFixed(5)),
    horizontalDistanceToRotunda: Number(horizontalDistanceToRotunda.toFixed(5)),
    horizontalDistanceToCab: Number(horizontalDistanceToCab.toFixed(5)),
    center: center.toArray().map((v) => Number(v.toFixed(5))),
    min: box.min.toArray().map((v) => Number(v.toFixed(5))),
    max: box.max.toArray().map((v) => Number(v.toFixed(5))),
    size: size.toArray().map((v) => Number(v.toFixed(5))),
  };
}).sort((a, b) => a.axisT - b.axisT || b.triangleCount - a.triangleCount);

const report = {
  mesh: "Tunnel_C_Jetway_0",
  weldEpsilon: WELD_EPSILON,
  vertexCount: positions.length,
  weldedUniquePositionCount: firstVertexForPosition.size,
  weldedDuplicateCount,
  triangleCount: indices.length / 3,
  componentCount: components.length,
  rotundaCenter: rotunda.center.toArray(),
  cabCenter: cab.center.toArray(),
  components,
};
fs.writeFileSync("/tmp/airport-jetway-tunnel-c-components.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(`AIRPORT_JETWAY_TUNNEL_C_COMPONENTS=${JSON.stringify(report)}`);
