import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = process.argv[2];
const outputPath = process.argv[3] || "public/models/crj700-user.glb";
if (!sourceDir) throw new Error("Usage: node tools/aircraft/convert-authored-crj900.mjs <extracted-source-dir> [output.glb]");

const objPath = path.join(sourceDir, "American+Eagle+CRJ+900.obj");
const mtlPath = path.join(sourceDir, "American+Eagle+CRJ+900.mtl");
const NOSE = [13.234288454055786, 0.27719337795861065, -2.3652495741844177];
const GROUND_Y = -0.0013887891545891762;
const SOURCE_EXTENT = [25.2865948677063, 7.750905753113329, 37.050313860177994];
const TARGET_EXTENT = [23.64, 7.5, 32.5];
const SCALE = TARGET_EXTENT.map((value, index) => value / SOURCE_EXTENT[index]);
const align4 = (buffer) => buffer.length % 4 ? Buffer.concat([buffer, Buffer.alloc(4 - (buffer.length % 4))]) : buffer;

function parseMtl(source) {
  const materials = new Map();
  let active;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(/\s+/);
    const value = rest.join(" ");
    if (key === "newmtl") {
      active = { name: value, kd: [1, 1, 1], alpha: 1 };
      materials.set(value, active);
    } else if (active && key === "Kd") active.kd = rest.slice(0, 3).map(Number);
    else if (active && key === "d") active.alpha = Number(rest[0]);
    else if (active && key === "Tr") active.alpha = 1 - Number(rest[0]);
    else if (active && key === "map_Kd") active.texture = rest.at(-1);
  }
  return materials;
}

const obj = await readFile(objPath, "utf8");
const materialsByName = parseMtl(await readFile(mtlPath, "utf8"));
const positions = [];
const texcoords = [];
const normals = [];
const facesByMaterial = new Map();
let activeMaterial = "default";
const parseIndex = (value, length) => {
  const parsed = Number(value);
  return parsed > 0 ? parsed - 1 : length + parsed;
};

for (const raw of obj.split(/\r?\n/)) {
  if (raw.startsWith("v ")) positions.push(raw.trim().split(/\s+/).slice(1, 4).map(Number));
  else if (raw.startsWith("vt ")) texcoords.push(raw.trim().split(/\s+/).slice(1, 3).map(Number));
  else if (raw.startsWith("vn ")) normals.push(raw.trim().split(/\s+/).slice(1, 4).map(Number));
  else if (raw.startsWith("usemtl ")) activeMaterial = raw.trim().slice(7);
  else if (raw.startsWith("f ")) {
    const refs = raw.trim().split(/\s+/).slice(1).map((token) => {
      const [v, vt, vn] = token.split("/");
      return [
        parseIndex(v, positions.length),
        vt ? parseIndex(vt, texcoords.length) : -1,
        vn ? parseIndex(vn, normals.length) : -1,
      ];
    });
    const triangles = facesByMaterial.get(activeMaterial) || [];
    for (let index = 1; index < refs.length - 1; index += 1) triangles.push([refs[0], refs[index], refs[index + 1]]);
    facesByMaterial.set(activeMaterial, triangles);
  }
}

if (positions.length !== 123105 || normals.length !== 123105 || texcoords.length !== 32484) throw new Error("Unexpected authored aircraft topology");
if ([...facesByMaterial.values()].reduce((sum, entries) => sum + entries.length, 0) !== 41035) throw new Error("Unexpected authored aircraft triangle count");

let binary = Buffer.alloc(0);
const bufferViews = [];
const accessors = [];
function append(data, target) {
  binary = align4(binary);
  const byteOffset = binary.length;
  binary = Buffer.concat([binary, data]);
  const view = { buffer: 0, byteOffset, byteLength: data.length };
  if (target) view.target = target;
  bufferViews.push(view);
  return bufferViews.length - 1;
}
function accessor(data, componentType, type, count, target, min, max) {
  const entry = { bufferView: append(data, target), componentType, count, type };
  if (min) entry.min = min;
  if (max) entry.max = max;
  accessors.push(entry);
  return accessors.length - 1;
}

const textureFiles = [...new Set([...materialsByName.values()].map((entry) => entry.texture).filter(Boolean))].sort();
const images = [];
const textures = [];
const textureIndex = new Map();
for (const fileName of textureFiles) {
  const payload = await readFile(path.join(sourceDir, fileName));
  images.push({ bufferView: append(payload), mimeType: "image/png", name: fileName });
  textures.push({ source: images.length - 1, sampler: 0 });
  textureIndex.set(fileName, textures.length - 1);
}

const materialNames = [...facesByMaterial.keys()].sort();
const materials = materialNames.map((name) => {
  const source = materialsByName.get(name) || { kd: [1, 1, 1], alpha: 1 };
  const pbrMetallicRoughness = {
    baseColorFactor: [...source.kd, source.alpha],
    metallicFactor: 0,
    roughnessFactor: 0.72,
  };
  if (textureIndex.has(source.texture)) pbrMetallicRoughness.baseColorTexture = { index: textureIndex.get(source.texture) };
  const entry = { name, pbrMetallicRoughness, doubleSided: true };
  if (source.alpha < 0.999) entry.alphaMode = "BLEND";
  return entry;
});
const materialIndex = new Map(materialNames.map((name, index) => [name, index]));
const primitives = [];
let optimizedVertexCount = 0;

for (const name of materialNames) {
  const triangles = facesByMaterial.get(name);
  const map = new Map();
  const outPositions = [];
  const outTexcoords = [];
  const indices = [];
  let hasUv = true;

  for (const triangle of triangles) for (const ref of triangle) {
    const sourcePosition = positions[ref[0]];
    const sourceUv = ref[1] >= 0 ? texcoords[ref[1]] : [0, 0];
    const key = [...sourcePosition, ...sourceUv].map((value) => value.toFixed(6)).join("/");
    if (!map.has(key)) {
      map.set(key, outPositions.length / 3);
      outPositions.push(
        -(sourcePosition[0] - NOSE[0]) * SCALE[0],
        (sourcePosition[1] - GROUND_Y) * SCALE[1],
        -(sourcePosition[2] - NOSE[2]) * SCALE[2],
      );
      if (ref[1] >= 0) outTexcoords.push(...sourceUv);
      else {
        hasUv = false;
        outTexcoords.push(0, 0);
      }
    }
    indices.push(map.get(key));
  }

  optimizedVertexCount += outPositions.length / 3;
  const positionArray = Float32Array.from(outPositions);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < positionArray.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], positionArray[index + axis]);
      max[axis] = Math.max(max[axis], positionArray[index + axis]);
    }
  }
  const attributes = {
    POSITION: accessor(Buffer.from(positionArray.buffer), 5126, "VEC3", positionArray.length / 3, 34962, min, max),
  };
  if (hasUv) {
    const data = Float32Array.from(outTexcoords);
    attributes.TEXCOORD_0 = accessor(Buffer.from(data.buffer), 5126, "VEC2", data.length / 2, 34962);
  }
  const indexData = Uint32Array.from(indices);
  primitives.push({
    attributes,
    indices: accessor(Buffer.from(indexData.buffer), 5125, "SCALAR", indexData.length, 34963),
    material: materialIndex.get(name),
    mode: 4,
  });
}

if (optimizedVertexCount !== 44784) throw new Error(`Unexpected optimized vertex count ${optimizedVertexCount}`);

const gltf = {
  asset: { version: "2.0", generator: "RampReady authored CRJ900 converter" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{
    mesh: 0,
    name: "American Eagle CRJ900 authored aircraft",
    extras: { noseGearCaptureOrigin: [0, 0, 0], upAxis: "+Y", forwardAxis: "-Z" },
  }],
  meshes: [{ name: "American Eagle CRJ900", primitives }],
  materials,
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
  textures,
  images,
  accessors,
  bufferViews,
  buffers: [{ byteLength: binary.length }],
};

const jsonChunk = align4(Buffer.from(JSON.stringify(gltf)));
const binChunk = align4(binary);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const header = Buffer.alloc(12);
header.write("glTF");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, glb);
const sha256 = createHash("sha256").update(glb).digest("hex");
const metadata = {
  contractVersion: 1,
  aircraftType: "CRJ700",
  sourceAircraftType: "CRJ900",
  sha256,
  orientation: { up: "+Y", forward: "-Z" },
  dimensionsMeters: { length: 32.5, wingspan: 23.64, height: 7.5 },
  noseGearCaptureOrigin: [0, 0, 0],
  preserveMaterials: true,
  materialCount: materials.length,
  textureCount: images.length,
  vertexCount: optimizedVertexCount,
  triangleCount: 41035,
  normalsGeneratedAtRuntime: true,
};
await writeFile(outputPath.replace(/\.glb$/i, ".asset.json"), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Prepared authored aircraft ${outputPath}: ${glb.length} bytes, sha256 ${sha256}, ${optimizedVertexCount} vertices, ${materials.length} materials, ${images.length} textures.`);
