import fs from "node:fs";
import path from "node:path";

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const GLB_MAGIC = 0x46546c67;
const TARGET_LENGTH_METERS = 4.5854875;
const TARGET_CAPTURE_Z = 3.45;
const SOURCE_SHA256 = "6f2e9da495e407cb95ad677a9110b1767139fbc69e2e9e62b4bcd059aece5504";

function pad4(buffer, fill = 0x20) {
  const remainder = buffer.length % 4;
  if (!remainder) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, fill)]);
}

export function parseGlb(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error("Not a glTF binary file");
  if (buffer.readUInt32LE(4) !== 2) throw new Error("Only GLB version 2 is supported");
  const chunks = [];
  let offset = 12;
  while (offset < buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === JSON_CHUNK);
  if (!jsonChunk) throw new Error("GLB JSON chunk is missing");
  return { json: JSON.parse(jsonChunk.data.toString("utf8").replace(/[\u0000 ]+$/g, "")), chunks };
}

function accessorBounds(document, meshIndex) {
  const mesh = document.meshes?.[meshIndex];
  if (!mesh) return null;
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const primitive of mesh.primitives || []) {
    const accessor = document.accessors?.[primitive.attributes?.POSITION];
    if (!accessor?.min || !accessor?.max) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], accessor.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], accessor.max[axis]);
    }
  }
  return Number.isFinite(bounds.min[0]) ? bounds : null;
}

export function normalizeStandupTugDocument(document) {
  const sourceNodes = document.nodes || [];
  const tugMeshNodes = sourceNodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => Number.isInteger(node.mesh) && /^Tug_/i.test(node.name || ""));
  if (tugMeshNodes.length < 4) throw new Error(`Expected at least four Tug mesh nodes, found ${tugMeshNodes.length}`);

  const sourceBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const { node } of tugMeshNodes) {
    const bounds = accessorBounds(document, node.mesh);
    if (!bounds) continue;
    for (let axis = 0; axis < 3; axis += 1) {
      sourceBounds.min[axis] = Math.min(sourceBounds.min[axis], bounds.min[axis]);
      sourceBounds.max[axis] = Math.max(sourceBounds.max[axis], bounds.max[axis]);
    }
  }
  if (!Number.isFinite(sourceBounds.min[0])) throw new Error("Tug source bounds are unavailable");

  const rawLength = sourceBounds.max[2] - sourceBounds.min[2];
  const scale = TARGET_LENGTH_METERS / rawLength;
  const translation = [
    -((sourceBounds.min[0] + sourceBounds.max[0]) / 2) * scale,
    -sourceBounds.min[1] * scale,
    TARGET_CAPTURE_Z - sourceBounds.max[2] * scale,
  ];

  const copiedNodes = tugMeshNodes.map(({ node }) => ({ ...node, matrix: undefined, translation: undefined, rotation: undefined, scale: undefined }));
  const rootIndex = copiedNodes.length;
  copiedNodes.push({
    name: "RampReady_Standup_Tug",
    children: tugMeshNodes.map((_, index) => index),
    translation,
    scale: [scale, scale, scale],
    extras: {
      sourceSha256: SOURCE_SHA256,
      sourceBounds,
      normalizedBoundsMeters: {
        min: [sourceBounds.min[0] * scale + translation[0], 0, sourceBounds.min[2] * scale + translation[2]],
        max: [sourceBounds.max[0] * scale + translation[0], (sourceBounds.max[1] - sourceBounds.min[1]) * scale, TARGET_CAPTURE_Z],
      },
      removedDetachedAssembly: "polySurface487_dash_handle",
    },
  });

  const anchors = [
    ["RR_CAPTURE_ANCHOR", [0, 0.34, TARGET_CAPTURE_Z]],
    ["RR_OPERATOR_EYE", [0, 1.46, -0.18]],
    ["RR_OPERATOR_LOOK", [0, 1.18, 3.2]],
    ["RR_CRADLE_LIFT", [0, 0.28, 2.72]],
    ["RR_STEER_LEFT", [-0.53, 0.28, 1.38]],
    ["RR_STEER_RIGHT", [0.53, 0.28, 1.38]],
  ];
  for (const [name, anchorTranslation] of anchors) {
    copiedNodes[rootIndex].children.push(copiedNodes.length);
    copiedNodes.push({ name, translation: anchorTranslation });
  }

  return {
    ...document,
    scene: 0,
    scenes: [{ name: "RampReady Stand-up Tug", nodes: [rootIndex] }],
    nodes: copiedNodes,
    extras: {
      ...(document.extras || {}),
      rampReadyStandupTug: {
        schemaVersion: 1,
        sourceSha256: SOURCE_SHA256,
        targetLengthMeters: TARGET_LENGTH_METERS,
        captureZ: TARGET_CAPTURE_Z,
        scale,
        translation,
        retainedMeshNodes: tugMeshNodes.map(({ node }) => node.name),
        removedNodeFamilies: ["polySurface487"],
      },
    },
  };
}

export function encodeGlb(document, chunks) {
  const jsonData = pad4(Buffer.from(JSON.stringify(document)), 0x20);
  const binaryChunks = chunks.filter((chunk) => chunk.type === BIN_CHUNK);
  const parts = [];
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonData.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  parts.push(jsonHeader, jsonData);
  for (const chunk of binaryChunks) {
    const data = pad4(Buffer.from(chunk.data), 0x00);
    const header = Buffer.alloc(8);
    header.writeUInt32LE(data.length, 0);
    header.writeUInt32LE(BIN_CHUNK, 4);
    parts.push(header, data);
  }
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

export function normalizeStandupTugGlb(inputBuffer) {
  const parsed = parseGlb(inputBuffer);
  const document = normalizeStandupTugDocument(parsed.json);
  return { buffer: encodeGlb(document, parsed.chunks), document };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const input = process.argv[2];
  const output = process.argv[3] || "public/models/standup-tug.glb";
  if (!input) throw new Error("Usage: node scripts/standup-tug-glb-normalizer.mjs <Aircraft_Tug.glb> [output.glb]");
  const result = normalizeStandupTugGlb(fs.readFileSync(input));
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, result.buffer);
  console.log(`Normalized stand-up tug written to ${output} (${result.buffer.length} bytes)`);
  console.log(JSON.stringify(result.document.extras.rampReadyStandupTug, null, 2));
}
