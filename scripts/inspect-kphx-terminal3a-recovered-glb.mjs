import fs from "node:fs";
import { createHash } from "node:crypto";

const target = {
  name: "Terminal3a",
  resource: "Terminals/Terminal3a.obj",
  path: "public/models/kphx/Terminal3a.exact.glb",
  expectedSourceObjSha256: "4283b54b22abf73eef75259f22318153705efc8372a667fd3de89fbe8db70ea3",
  expectedRuntimeSha256: "0297c2435a9f17a7aaf564c6f0198b6533637b527f2d0628bc918c383d894aa7",
  expectedRuntimeBytes: 18527808,
};

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${filePath}: bad GLB magic`);
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let binaryChunk = null;
  const chunks = [];
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    chunks.push({ chunkLength, chunkType: `0x${chunkType.toString(16)}` });
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(bytes.subarray(offset, offset + chunkLength).toString("utf8").replace(/\0+$/g, "").trim());
    } else if (chunkType === 0x004e4942) {
      binaryChunk = bytes.subarray(offset, offset + chunkLength);
    }
    offset += chunkLength;
  }
  if (!json) throw new Error(`${filePath}: missing JSON chunk`);
  if (!binaryChunk) throw new Error(`${filePath}: missing BIN chunk`);
  return { bytes, binaryChunk, version, declaredLength, chunks, json };
}

const { bytes, binaryChunk, version, declaredLength, chunks, json } = parseGlb(target.path);
const runtimeSha256 = createHash("sha256").update(bytes).digest("hex");
const accessors = json.accessors || [];
const meshes = json.meshes || [];
const materials = json.materials || [];
const bufferViews = json.bufferViews || [];

let totalIndexCount = 0;
let totalPositionAccessorCount = 0;
const primitives = [];
for (const [meshIndex, mesh] of meshes.entries()) {
  for (const [primitiveIndex, primitive] of (mesh.primitives || []).entries()) {
    const indexCount = primitive.indices == null ? 0 : Number(accessors[primitive.indices]?.count || 0);
    const positionCount = primitive.attributes?.POSITION == null
      ? 0
      : Number(accessors[primitive.attributes.POSITION]?.count || 0);
    totalIndexCount += indexCount;
    totalPositionAccessorCount += positionCount;
    primitives.push({
      meshIndex,
      meshName: mesh.name || null,
      primitiveIndex,
      mode: primitive.mode ?? 4,
      materialIndex: primitive.material ?? null,
      indexAccessor: primitive.indices ?? null,
      indexCount,
      positionAccessor: primitive.attributes?.POSITION ?? null,
      positionCount,
    });
  }
}

const images = (json.images || []).map((entry, index) => {
  if (entry.bufferView == null) return { index, ...entry, embeddedByteLength: null, embeddedSha256: null };
  const view = bufferViews[entry.bufferView];
  if (!view) throw new Error(`${target.path}: image ${index} references missing bufferView ${entry.bufferView}`);
  const byteOffset = Number(view.byteOffset || 0);
  const byteLength = Number(view.byteLength || 0);
  const imageBytes = binaryChunk.subarray(byteOffset, byteOffset + byteLength);
  return {
    index,
    ...entry,
    embeddedByteLength: imageBytes.length,
    embeddedSha256: createHash("sha256").update(imageBytes).digest("hex"),
  };
});

const sourceObjSha256 = json.extras?.source?.obj?.sha256 || null;
const report = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  authority: "Read-only inspection of recovered exact KPHX 1.75.1 Terminal3a GLB binary",
  target,
  byteLength: bytes.length,
  runtimeSha256,
  runtimeHashMatchesCatalog: runtimeSha256 === target.expectedRuntimeSha256,
  runtimeBytesMatchCatalog: bytes.length === target.expectedRuntimeBytes,
  sourceObjSha256,
  sourceObjHashMatchesCatalog: sourceObjSha256 === target.expectedSourceObjSha256,
  version,
  declaredLength,
  chunks,
  asset: json.asset || null,
  sceneCount: (json.scenes || []).length,
  nodeCount: (json.nodes || []).length,
  meshCount: meshes.length,
  primitiveCount: primitives.length,
  accessorCount: accessors.length,
  materialCount: materials.length,
  imageCount: images.length,
  textureCount: (json.textures || []).length,
  totalIndexCount,
  totalPositionAccessorCount,
  materials: materials.map((material, index) => ({
    index,
    name: material.name || null,
    alphaMode: material.alphaMode || "OPAQUE",
    alphaCutoff: material.alphaCutoff ?? null,
    doubleSided: material.doubleSided === true,
    baseColorTexture: material.pbrMetallicRoughness?.baseColorTexture || null,
    emissiveTexture: material.emissiveTexture || null,
    normalTexture: material.normalTexture || null,
    extras: material.extras || null,
  })),
  images,
  textures: (json.textures || []).map((entry, index) => ({ index, ...entry })),
  primitives,
  extras: json.extras || null,
};

if (!report.runtimeHashMatchesCatalog) throw new Error("Terminal3a runtime SHA256 does not match exact-asset catalog");
if (!report.runtimeBytesMatchCatalog) throw new Error("Terminal3a runtime byte length does not match exact-asset catalog");
if (!report.sourceObjHashMatchesCatalog) throw new Error("Terminal3a embedded source OBJ SHA256 does not match exact-asset catalog");

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/kphx-terminal3a-recovered-glb-inspection.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({
  resource: target.resource,
  runtimeSha256,
  sourceObjSha256,
  positions: totalPositionAccessorCount,
  indices: totalIndexCount,
  materials: report.materials,
  images: report.images.map(({ name, mimeType, embeddedByteLength, embeddedSha256 }) => ({
    name, mimeType, embeddedByteLength, embeddedSha256,
  })),
  source: report.extras?.source || null,
  status: "PASS",
}, null, 2));
