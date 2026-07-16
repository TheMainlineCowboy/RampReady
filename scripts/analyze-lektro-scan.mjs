import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_FILES = ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"];

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

  let vertices = 0;
  let triangles = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const rawLine of obj.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.startsWith("v ")) {
      const values = line.split(/\s+/u).slice(1, 4).map(Number);
      if (values.length !== 3 || values.some((value) => !Number.isFinite(value))) {
        throw new Error(`Invalid OBJ vertex: ${rawLine}`);
      }
      vertices += 1;
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], values[axis]);
        max[axis] = Math.max(max[axis], values[axis]);
      }
    } else if (line.startsWith("f ")) {
      const corners = line.split(/\s+/u).slice(1);
      if (corners.length < 3) throw new Error(`Invalid OBJ face: ${rawLine}`);
      triangles += corners.length - 2;
    }
  }

  if (vertices === 0 || triangles === 0) throw new Error("OBJ contains no usable geometry");

  const textureReferences = [...mtl.matchAll(/^\s*map_Kd\s+(.+)$/gimu)].map((match) => match[1].trim());
  if (!textureReferences.some((value) => value.endsWith("3DModel.jpg"))) {
    throw new Error("MTL does not reference 3DModel.jpg as its diffuse texture");
  }

  const extents = max.map((value, axis) => value - min[axis]);
  const longestHorizontalExtent = Math.max(extents[0], extents[2]);

  return {
    sourceFiles: EXPECTED_FILES,
    vertices,
    triangles,
    bounds: { min, max, extents },
    material: { diffuseTextureReferences: textureReferences },
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
