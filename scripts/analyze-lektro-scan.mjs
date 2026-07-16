import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_FILES = ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"];

function parseVertexIndex(token, vertexCount, rawLine) {
  const value = Number(token.split("/", 1)[0]);
  if (!Number.isInteger(value) || value === 0) throw new Error(`Invalid OBJ face index: ${rawLine}`);
  const resolved = value > 0 ? value - 1 : vertexCount + value;
  if (resolved < 0 || resolved >= vertexCount) throw new Error(`OBJ face index out of range: ${rawLine}`);
  return resolved;
}

function createUnionFind(size) {
  const parent = Array.from({ length: size }, (_, index) => index);
  const rank = new Uint8Array(size);
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (left, right) => {
    let a = find(left);
    let b = find(right);
    if (a === b) return;
    if (rank[a] < rank[b]) [a, b] = [b, a];
    parent[b] = a;
    if (rank[a] === rank[b]) rank[a] += 1;
  };
  return { find, union };
}

export async function analyzeLektroScan(inputDirectory) {
  const directory = path.resolve(inputDirectory);
  const [objPath, mtlPath, texturePath] = EXPECTED_FILES.map((name) => path.join(directory, name));

  await Promise.all(EXPECTED_FILES.map(async (name) => {
    const info = await stat(path.join(directory, name));
    if (!info.isFile()) throw new Error(`${name} is not a regular file`);
  }));

  const [obj, mtl, textureInfo] = await Promise.all([
    readFile(objPath, "utf8"),
    readFile(mtlPath, "utf8"),
    stat(texturePath),
  ]);

  const lines = obj.split(/\r?\n/u);
  const positions = [];
  let textureCoordinates = 0;
  let normals = 0;
  let triangles = 0;
  let faces = 0;
  const faceVertexSets = [];
  const groups = new Set();
  const objects = new Set();
  const materialsUsed = new Set();
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const values = line.split(/\s+/u).slice(1, 4).map(Number);
      if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
        throw new Error(`Invalid OBJ vertex: ${rawLine}`);
      }
      positions.push(values);
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], values[axis]);
        max[axis] = Math.max(max[axis], values[axis]);
      }
    } else if (line.startsWith("vt ")) {
      textureCoordinates += 1;
    } else if (line.startsWith("vn ")) {
      normals += 1;
    } else if (line.startsWith("g ")) {
      groups.add(line.slice(2).trim() || "(unnamed)");
    } else if (line.startsWith("o ")) {
      objects.add(line.slice(2).trim() || "(unnamed)");
    } else if (line.startsWith("usemtl ")) {
      materialsUsed.add(line.slice(7).trim() || "(unnamed)");
    } else if (line.startsWith("f ")) {
      const corners = line.split(/\s+/u).slice(1);
      if (corners.length < 3) throw new Error(`Invalid OBJ face: ${rawLine}`);
      faces += 1;
      triangles += corners.length - 2;
      faceVertexSets.push(corners.map((corner) => parseVertexIndex(corner, positions.length, rawLine)));
    }
  }

  const vertices = positions.length;
  if (vertices === 0 || triangles === 0) throw new Error("OBJ contains no usable geometry");

  const unionFind = createUnionFind(vertices);
  const referencedVertices = new Set();
  for (const indices of faceVertexSets) {
    const first = indices[0];
    for (const index of indices) referencedVertices.add(index);
    for (let index = 1; index < indices.length; index += 1) unionFind.union(first, indices[index]);
  }
  const componentSizes = new Map();
  for (const index of referencedVertices) {
    const root = unionFind.find(index);
    componentSizes.set(root, (componentSizes.get(root) ?? 0) + 1);
  }
  const connectedComponentVertexCounts = [...componentSizes.values()].sort((a, b) => b - a);

  const textureReferences = [...mtl.matchAll(/^\s*map_Kd\s+(.+)$/gimu)].map((match) => match[1].trim());
  const materialDefinitions = [...mtl.matchAll(/^\s*newmtl\s+(.+)$/gimu)].map((match) => match[1].trim());
  if (!textureReferences.some((value) => value.endsWith("3DModel.jpg"))) {
    throw new Error("MTL does not reference 3DModel.jpg as its diffuse texture");
  }

  const extents = max.map((value, axis) => value - min[axis]);
  const longestHorizontalExtent = Math.max(extents[0], extents[2]);

  return {
    sourceFiles: EXPECTED_FILES,
    vertices,
    textureCoordinates,
    normals,
    faces,
    triangles,
    bounds: { min, max, extents },
    topology: {
      connectedComponents: connectedComponentVertexCounts.length,
      connectedComponentVertexCounts,
      unreferencedVertices: vertices - referencedVertices.size,
      groups: [...groups],
      objects: [...objects],
    },
    material: {
      definitions: materialDefinitions,
      usedByGeometry: [...materialsUsed],
      diffuseTextureReferences: textureReferences,
    },
    textureBytes: textureInfo.size,
    provisionalNormalization: {
      groundAxis: "+Y",
      targetLongestHorizontalExtentMeters: 5.5,
      scaleFactor: 5.5 / longestHorizontalExtent,
    },
  };
}

async function main() {
  const inputDirectory = process.argv[2];
  if (!inputDirectory) {
    throw new Error("Usage: npm run analyze:lektro-scan -- <directory-containing-3DModel.obj-mtl-jpg>");
  }
  const report = await analyzeLektroScan(inputDirectory);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
