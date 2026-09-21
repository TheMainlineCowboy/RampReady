import fs from "node:fs/promises";
import path from "node:path";

const [, , inputPath, outputDirectory, ...args] = process.argv;
if (!inputPath || !outputDirectory) {
  throw new Error("Usage: node scripts/convert-kphx-obj8-to-gltf.mjs <input.obj> <output-dir> [--name=AssetName] [--diffuse=texture.png] [--lit=texture_LIT.png]");
}

const options = Object.fromEntries(args
  .filter((entry) => entry.startsWith("--") && entry.includes("="))
  .map((entry) => {
    const [key, ...value] = entry.slice(2).split("=");
    return [key, value.join("=")];
  }));

const source = await fs.readFile(inputPath, "utf8");
const vertices = [];
const indices = [];
const drawRanges = [];
const commands = new Map();
let sourceTexture = null;
let sourceLitTexture = null;
let pointCounts = null;
let alphaMode = "OPAQUE";
let doubleSided = true;

const bump = (key) => commands.set(key, (commands.get(key) || 0) + 1);

for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line) continue;
  const parts = line.split(/\s+/);
  const command = parts[0];
  bump(command);

  if (command === "TEXTURE") sourceTexture = parts.slice(1).join(" ");
  else if (command === "TEXTURE_LIT") sourceLitTexture = parts.slice(1).join(" ");
  else if (command === "POINT_COUNTS") pointCounts = parts.slice(1).map(Number);
  else if (command === "VT") {
    if (parts.length < 9) throw new Error(`Malformed VT record: ${line}`);
    vertices.push(parts.slice(1, 9).map(Number));
  } else if (command === "IDX" || command === "IDX10") {
    indices.push(...parts.slice(1).map(Number));
  } else if (command === "TRIS") {
    if (parts.length !== 3) throw new Error(`Malformed TRIS record: ${line}`);
    drawRanges.push({ start: Number(parts[1]), count: Number(parts[2]) });
  } else if (command === "ATTR_blend") alphaMode = "BLEND";
  else if (command === "ATTR_no_blend") alphaMode = "OPAQUE";
  else if (command === "ATTR_cull") doubleSided = false;
  else if (command === "ATTR_no_cull") doubleSided = true;
}

if (!pointCounts) throw new Error("OBJ8 POINT_COUNTS record is missing");
if (pointCounts[0] !== vertices.length) {
  throw new Error(`OBJ8 vertex count mismatch: header=${pointCounts[0]} parsed=${vertices.length}`);
}
if (pointCounts[3] !== indices.length) {
  throw new Error(`OBJ8 index count mismatch: header=${pointCounts[3]} parsed=${indices.length}`);
}
if (!vertices.length || !indices.length || !drawRanges.length) throw new Error("OBJ8 geometry is incomplete");
if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= vertices.length)) {
  throw new Error("OBJ8 contains an out-of-range vertex index");
}
for (const range of drawRanges) {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.count) || range.start < 0 || range.count <= 0 || range.start + range.count > indices.length) {
    throw new Error(`Invalid TRIS draw range: ${JSON.stringify(range)}`);
  }
  if (range.count % 3 !== 0) throw new Error(`TRIS range is not triangle-aligned: ${JSON.stringify(range)}`);
}

const harmless = new Set([
  "I", "800", "OBJ", "TEXTURE", "TEXTURE_LIT", "POINT_COUNTS",
  "VT", "IDX", "IDX10", "TRIS", "#",
  "ATTR_shade_smooth", "ATTR_shade_flat",
  "ATTR_no_hard", "ATTR_hard",
  "ATTR_cull", "ATTR_no_cull",
  "ATTR_depth", "ATTR_no_depth",
  "ATTR_blend", "ATTR_no_blend",
  "ATTR_draw_enable", "ATTR_draw_disable",
  "ATTR_no_solid_camera", "ATTR_solid_camera",
]);
const unsupported = [...commands.keys()].filter((command) => !harmless.has(command));
if (unsupported.length) {
  throw new Error(`Unsupported OBJ8 commands would affect source fidelity: ${unsupported.join(", ")}`);
}

const name = options.name || path.basename(inputPath).replace(/\.[^.]+$/, "");
const diffuseUri = options.diffuse || sourceTexture;
const litUri = options.lit || sourceLitTexture;
if (!diffuseUri) throw new Error("OBJ8 source has no diffuse texture reference");

const positions = vertices.map((row) => row.slice(0, 3));
const normals = vertices.map((row) => row.slice(3, 6));
const uvs = vertices.map((row) => row.slice(6, 8));
const chunks = [];
let binaryByteLength = 0;
const bufferViews = [];
const accessors = [];

function appendPadding() {
  const padding = (4 - (binaryByteLength % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    binaryByteLength += padding;
  }
}

function componentBounds(rows, componentCount) {
  const min = Array(componentCount).fill(Infinity);
  const max = Array(componentCount).fill(-Infinity);
  for (const row of rows) {
    for (let index = 0; index < componentCount; index += 1) {
      min[index] = Math.min(min[index], row[index]);
      max[index] = Math.max(max[index], row[index]);
    }
  }
  return { min, max };
}

function appendFloatAccessor(rows, componentCount, target) {
  appendPadding();
  const byteOffset = binaryByteLength;
  const chunk = Buffer.alloc(rows.length * componentCount * 4);
  let cursor = 0;
  for (const row of rows) {
    for (let index = 0; index < componentCount; index += 1) {
      chunk.writeFloatLE(row[index], cursor);
      cursor += 4;
    }
  }
  chunks.push(chunk);
  binaryByteLength += chunk.length;
  const bufferView = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset, byteLength: chunk.length, target });
  const bounds = componentBounds(rows, componentCount);
  const accessor = accessors.length;
  accessors.push({
    bufferView,
    componentType: 5126,
    count: rows.length,
    type: componentCount === 2 ? "VEC2" : "VEC3",
    min: bounds.min,
    max: bounds.max,
  });
  return accessor;
}

function indexBounds(start, count) {
  let min = Infinity;
  let max = -Infinity;
  for (let cursor = start; cursor < start + count; cursor += 1) {
    min = Math.min(min, indices[cursor]);
    max = Math.max(max, indices[cursor]);
  }
  return { min, max };
}

const positionAccessor = appendFloatAccessor(positions, 3, 34962);
const normalAccessor = appendFloatAccessor(normals, 3, 34962);
const uvAccessor = appendFloatAccessor(uvs, 2, 34962);

let maxIndex = -Infinity;
for (const index of indices) maxIndex = Math.max(maxIndex, index);
const indexComponentType = maxIndex <= 65535 ? 5123 : 5125;
const indexBytes = indexComponentType === 5123 ? 2 : 4;
appendPadding();
const indexByteOffset = binaryByteLength;
const indexChunk = Buffer.alloc(indices.length * indexBytes);
indices.forEach((value, index) => {
  if (indexComponentType === 5123) indexChunk.writeUInt16LE(value, index * indexBytes);
  else indexChunk.writeUInt32LE(value, index * indexBytes);
});
chunks.push(indexChunk);
binaryByteLength += indexChunk.length;
const indexBufferView = bufferViews.length;
bufferViews.push({ buffer: 0, byteOffset: indexByteOffset, byteLength: indexChunk.length, target: 34963 });

const primitives = drawRanges.map((range) => {
  const bounds = indexBounds(range.start, range.count);
  const accessor = accessors.length;
  accessors.push({
    bufferView: indexBufferView,
    byteOffset: range.start * indexBytes,
    componentType: indexComponentType,
    count: range.count,
    type: "SCALAR",
    min: [bounds.min],
    max: [bounds.max],
  });
  return {
    attributes: { POSITION: positionAccessor, NORMAL: normalAccessor, TEXCOORD_0: uvAccessor },
    indices: accessor,
    material: 0,
    mode: 4,
  };
});

const xPlaneTextureInfo = (index) => ({
  index,
  extensions: {
    KHR_texture_transform: {
      offset: [0, 1],
      scale: [1, -1],
    },
  },
});

const images = [{ uri: diffuseUri }];
const textures = [{ sampler: 0, source: 0 }];
const material = {
  name: `${name} source material`,
  pbrMetallicRoughness: {
    baseColorTexture: xPlaneTextureInfo(0),
    metallicFactor: 0,
    roughnessFactor: 1,
  },
  doubleSided,
  alphaMode,
};
if (litUri) {
  images.push({ uri: litUri });
  textures.push({ sampler: 0, source: 1 });
  material.emissiveTexture = xPlaneTextureInfo(1);
  material.emissiveFactor = [1, 1, 1];
}

const outputBinary = Buffer.concat(chunks, binaryByteLength);
const gltf = {
  asset: { version: "2.0", generator: "RampReady exact X-Plane OBJ8 converter v1" },
  extensionsUsed: ["KHR_texture_transform"],
  buffers: [{ uri: `${name}.bin`, byteLength: outputBinary.length }],
  bufferViews,
  accessors,
  images,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  textures,
  materials: [material],
  meshes: [{ name, primitives }],
  nodes: [{ name, mesh: 0 }],
  scenes: [{ nodes: [0] }],
  scene: 0,
  extras: {
    sourceFormat: "X-Plane OBJ8",
    sourceFile: path.basename(inputPath),
    sourceTexture,
    sourceLitTexture,
    pointCounts,
    vertexCount: vertices.length,
    indexCount: indices.length,
    triangleCount: drawRanges.reduce((sum, range) => sum + range.count, 0) / 3,
    drawRanges,
    sourceBounds: { min: accessors[positionAccessor].min, max: accessors[positionAccessor].max },
    geometryPolicy: "preserve-source-positions-normals-uvs-indices-no-remesh-no-decimation",
    textureCoordinatePolicy: "preserve-source-uv-buffer-and-flip-v-at-material-level-for-gltf-upper-left-image-origin",
  },
};

await fs.mkdir(outputDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(path.join(outputDirectory, `${name}.bin`), outputBinary),
  fs.writeFile(path.join(outputDirectory, `${name}.gltf`), `${JSON.stringify(gltf, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  name,
  source: inputPath,
  vertexCount: vertices.length,
  indexCount: indices.length,
  triangleCount: gltf.extras.triangleCount,
  drawRangeCount: drawRanges.length,
  sourceBounds: gltf.extras.sourceBounds,
  diffuseUri,
  litUri: litUri || null,
  geometryPolicy: gltf.extras.geometryPolicy,
  textureCoordinatePolicy: gltf.extras.textureCoordinatePolicy,
}, null, 2));
