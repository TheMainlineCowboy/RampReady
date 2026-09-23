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

function readAccessor(accessorIndex) {
  const accessor = accessors[accessorIndex];
  if (!accessor) throw new Error(`Missing accessor ${accessorIndex}`);
  const view = bufferViews[accessor.bufferView];
  if (!view) throw new Error(`Accessor ${accessorIndex} references missing bufferView ${accessor.bufferView}`);
  const componentBytes = accessor.componentType === 5126 || accessor.componentType === 5125 ? 4
    : accessor.componentType === 5123 ? 2
      : accessor.componentType === 5121 ? 1
        : null;
  if (!componentBytes) throw new Error(`Unsupported accessor component type ${accessor.componentType}`);
  const componentCount = accessor.type === "SCALAR" ? 1
    : accessor.type === "VEC2" ? 2
      : accessor.type === "VEC3" ? 3
        : accessor.type === "VEC4" ? 4
          : null;
  if (!componentCount) throw new Error(`Unsupported accessor type ${accessor.type}`);
  const stride = Number(view.byteStride || componentBytes * componentCount);
  const base = Number(view.byteOffset || 0) + Number(accessor.byteOffset || 0);
  const rows = [];
  for (let row = 0; row < Number(accessor.count || 0); row += 1) {
    const values = [];
    const rowBase = base + row * stride;
    for (let component = 0; component < componentCount; component += 1) {
      const offset = rowBase + component * componentBytes;
      if (accessor.componentType === 5126) values.push(binaryChunk.readFloatLE(offset));
      else if (accessor.componentType === 5125) values.push(binaryChunk.readUInt32LE(offset));
      else if (accessor.componentType === 5123) values.push(binaryChunk.readUInt16LE(offset));
      else values.push(binaryChunk.readUInt8(offset));
    }
    rows.push(componentCount === 1 ? values[0] : values);
  }
  return rows;
}

function windingEvidenceForPrimitive(primitive) {
  if (primitive.mode != null && primitive.mode !== 4) throw new Error("Terminal3a primitive is not TRIANGLES");
  const positions = readAccessor(primitive.attributes.POSITION);
  const normals = readAccessor(primitive.attributes.NORMAL);
  const indices = readAccessor(primitive.indices);
  let aligned = 0;
  let opposite = 0;
  let degenerate = 0;
  for (let cursor = 0; cursor < indices.length; cursor += 3) {
    const ia = indices[cursor];
    const ib = indices[cursor + 1];
    const ic = indices[cursor + 2];
    const a = positions[ia], b = positions[ib], c = positions[ic];
    const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const cross = [
      ab[1]*ac[2] - ab[2]*ac[1],
      ab[2]*ac[0] - ab[0]*ac[2],
      ab[0]*ac[1] - ab[1]*ac[0],
    ];
    const crossLenSq = cross[0]**2 + cross[1]**2 + cross[2]**2;
    if (crossLenSq <= 1e-18) {
      degenerate += 1;
      continue;
    }
    const avgNormal = [
      normals[ia][0] + normals[ib][0] + normals[ic][0],
      normals[ia][1] + normals[ib][1] + normals[ic][1],
      normals[ia][2] + normals[ib][2] + normals[ic][2],
    ];
    const dot = cross[0]*avgNormal[0] + cross[1]*avgNormal[1] + cross[2]*avgNormal[2];
    if (dot > 1e-9) aligned += 1;
    else if (dot < -1e-9) opposite += 1;
    else degenerate += 1;
  }
  return {
    triangleCount: Math.floor(indices.length / 3),
    aligned,
    opposite,
    degenerate,
    runtimeNeedsWindingReversal: opposite > aligned,
  };
}

const windingEvidence = (json.meshes || []).flatMap((mesh) =>
  (mesh.primitives || []).map((primitive) => windingEvidenceForPrimitive(primitive))
);
const sourceWindingAgainstAuthoredNormals = windingEvidence.reduce((sum, item) => ({
  triangleCount: sum.triangleCount + item.triangleCount,
  aligned: sum.aligned + item.aligned,
  opposite: sum.opposite + item.opposite,
  degenerate: sum.degenerate + item.degenerate,
  runtimeNeedsWindingReversal: sum.runtimeNeedsWindingReversal || item.runtimeNeedsWindingReversal,
}), { triangleCount: 0, aligned: 0, opposite: 0, degenerate: 0, runtimeNeedsWindingReversal: false });

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
  topLevelExtensionsUsed: json.extensionsUsed || [],
  sourceWindingAgainstAuthoredNormals,
  runtimeCompatibility: {
    windingReversalRequired: sourceWindingAgainstAuthoredNormals.runtimeNeedsWindingReversal,
    legacyTextureVCorrectionRequired: (json.extensionsUsed || []).includes("KHR_texture_transform") === false,
    reason: "Exact recovered GLB preserves source index order, UVs, and decoded texture pixels; browser glTF rendering must bridge X-Plane winding and texture-origin conventions without editing source geometry.",
  },
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
  sourceWindingAgainstAuthoredNormals: report.sourceWindingAgainstAuthoredNormals,
  runtimeCompatibility: report.runtimeCompatibility,
  status: "PASS",
}, null, 2));
