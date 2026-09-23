import fs from "node:fs";
import { createHash } from "node:crypto";

const targets = [
  {
    name: "Terminal4",
    path: "public/models/kphx/Terminal4.exact.glb",
    expectedSourceVertexCount: 21720,
    expectedSourceIndexCount: 42501,
    expectedRuntimeSha256: "1899c3d3258922868f835b62dbd1b85713871017d52d34167d80c136f8b6d8b2",
  },
  {
    name: "Terminal4b",
    path: "public/models/kphx/Terminal4b.exact.glb",
    expectedSourceVertexCount: 40773,
    expectedSourceIndexCount: 70725,
    expectedRuntimeSha256: "1380cb6b1f33a3beca14a44ca4f17ef765bcf718c099769d6a723f0dbc10ab43",
  },
];

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

const report = {
  generatedAtUtc: new Date().toISOString(),
  authority: "Read-only inspection of recovered exact Terminal4 GLB binaries",
  targets: [],
};

for (const target of targets) {
  const { bytes, binaryChunk, version, declaredLength, chunks, json } = parseGlb(target.path);
  const accessors = json.accessors || [];
  const meshes = json.meshes || [];
  const materials = json.materials || [];
  let totalIndexCount = 0;
  let totalPositionAccessorCount = 0;
  const primitives = [];

  meshes.forEach((mesh, meshIndex) => {
    (mesh.primitives || []).forEach((primitive, primitiveIndex) => {
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
    });
  });

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const bufferViews = json.bufferViews || [];
  const sourceDaySha256 = json.extras?.source?.dayTexture?.sha256 || null;
  const sourceLitSha256 = json.extras?.source?.litTexture?.sha256 || null;
  const imageEvidence = (json.images || []).map((entry, index) => {
    if (entry.bufferView == null) {
      return { index, ...entry, embeddedSha256: null, sourceHashMatches: null };
    }
    const view = bufferViews[entry.bufferView];
    if (!view) throw new Error(`${target.path}: image ${index} references missing bufferView ${entry.bufferView}`);
    const byteOffset = Number(view.byteOffset || 0);
    const byteLength = Number(view.byteLength || 0);
    const imageBytes = binaryChunk.subarray(byteOffset, byteOffset + byteLength);
    const embeddedSha256 = createHash("sha256").update(imageBytes).digest("hex");
    const isLit = /_LIT$/i.test(String(entry.name || "")) || /lit/i.test(String(entry.name || ""));
    const expectedSourceSha256 = isLit ? sourceLitSha256 : sourceDaySha256;
    return {
      index,
      ...entry,
      embeddedByteLength: imageBytes.length,
      embeddedSha256,
      expectedSourceSha256,
      sourceHashMatches: expectedSourceSha256 ? embeddedSha256 === expectedSourceSha256 : null,
    };
  });

  report.targets.push({
    ...target,
    byteLength: bytes.length,
    sha256,
    runtimeHashMatchesCatalog: sha256 === target.expectedRuntimeSha256,
    version,
    declaredLength,
    chunks,
    asset: json.asset || null,
    topLevelExtensionsUsed: json.extensionsUsed || [],
    topLevelExtensionsRequired: json.extensionsRequired || [],
    sceneCount: (json.scenes || []).length,
    nodeCount: (json.nodes || []).length,
    meshCount: meshes.length,
    primitiveCount: primitives.length,
    accessorCount: accessors.length,
    materialCount: materials.length,
    imageCount: (json.images || []).length,
    textureCount: (json.textures || []).length,
    totalIndexCount,
    expectedSourceIndexCount: target.expectedSourceIndexCount,
    exactIndexCountMatch: totalIndexCount === target.expectedSourceIndexCount,
    totalPositionAccessorCount,
    expectedSourceVertexCount: target.expectedSourceVertexCount,
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
    images: imageEvidence,
    embeddedTextureHashesMatchSource: imageEvidence.length > 0 && imageEvidence.every((entry) => entry.sourceHashMatches === true),
    textures: (json.textures || []).map((entry, index) => ({ index, ...entry })),
    primitives,
    extras: json.extras || null,
  });
}

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(
  "reports/kphx-terminal4-recovered-glb-inspection.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
