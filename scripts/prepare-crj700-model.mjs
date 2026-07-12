import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";

const chunkDirectory = new URL("../public/models/crj700/", import.meta.url);
const outputPath = new URL("../public/models/crj700-mobile.glb", import.meta.url);
const manifestPath = new URL("../public/models/crj700-mobile.manifest.json", import.meta.url);
const EXPECTED_LENGTH_METERS = 32.5;
const EXPECTED_WINGSPAN_METERS = 23.64;
const DIMENSION_TOLERANCE_METERS = 0.9;

function fail(message) {
  throw new Error(`CRJ700 asset preparation failed: ${message}`);
}

function parseGlb(buffer) {
  if (buffer.length < 20) fail("decoded payload is too small to be a GLB file");
  if (buffer.toString("utf8", 0, 4) !== "glTF") fail("decoded payload does not have the GLB magic header");
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) fail(`expected GLB version 2, found ${version}`);
  if (declaredLength !== buffer.length) fail(`declared GLB length ${declaredLength} does not match ${buffer.length}`);

  let offset = 12;
  let json;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + chunkLength > buffer.length) fail("GLB chunk exceeds payload length");
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.toString("utf8", offset, offset + chunkLength).replace(/\u0000+$/g, "").trim());
      break;
    }
    offset += chunkLength;
  }
  if (!json) fail("GLB JSON chunk was not found");
  return json;
}

function dimensionsFromAccessors(gltf) {
  const positions = [];
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      const accessorIndex = primitive.attributes?.POSITION;
      const accessor = gltf.accessors?.[accessorIndex];
      if (accessor?.min?.length === 3 && accessor?.max?.length === 3) positions.push(accessor);
    }
  }
  if (!positions.length) fail("no POSITION accessor bounds were found");
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const accessor of positions) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], accessor.min[axis]);
      max[axis] = Math.max(max[axis], accessor.max[axis]);
    }
  }
  return {
    x: max[0] - min[0],
    y: max[1] - min[1],
    z: max[2] - min[2],
    min,
    max,
  };
}

const chunkNames = (await readdir(chunkDirectory))
  .filter((name) => /^chunk-\d+\.txt$/.test(name))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
if (chunkNames.length < 2) fail(`expected multiple payload chunks, found ${chunkNames.length}`);

const chunkContents = await Promise.all(chunkNames.map(async (name) => ({
  name,
  content: (await readFile(new URL(name, chunkDirectory), "utf8")).trim(),
})));
for (const chunk of chunkContents) {
  if (!chunk.content.length) fail(`${chunk.name} is empty`);
  if (!/^[A-Za-z0-9+/=]+$/.test(chunk.content)) fail(`${chunk.name} contains non-base64 characters`);
}

const encoded = chunkContents.map(({ content }) => content).join("");
const encodedSha256 = createHash("sha256").update(encoded, "utf8").digest("hex");
const chunkInventory = chunkContents.map(({ name, content }) => `${name}:${content.length}`).join(", ");
console.log(`CRJ700 payload inventory: ${chunkInventory}; total=${encoded.length}; base64-sha256=${encodedSha256}.`);

if (encoded.length % 4 === 1) {
  fail(`base64 payload length ${encoded.length} is impossible (remainder 1); committed payload is truncated`);
}

const compressed = Buffer.from(encoded, "base64");
if (compressed.length < 18) fail(`compressed payload is only ${compressed.length} bytes`);
if (compressed[0] !== 0x1f || compressed[1] !== 0x8b || compressed[2] !== 0x08) {
  fail("decoded payload does not start with a valid gzip header");
}

let glb;
try {
  glb = gunzipSync(compressed);
} catch (error) {
  const reason = error?.message || String(error);
  const truncationHint = /unexpected end of file|unexpected end of data|buffer error/i.test(reason)
    ? " The committed payload ends before the gzip stream is complete; restore the missing final chunk bytes from the CRJ700 export."
    : "";
  fail(`payload could not be gunzipped (${compressed.length} compressed bytes, ${encoded.length} base64 characters, sha256 ${encodedSha256}): ${reason}.${truncationHint}`);
}

const gltf = parseGlb(glb);
const dimensions = dimensionsFromAccessors(gltf);
const length = Math.max(dimensions.x, dimensions.z);
const wingspan = Math.min(dimensions.x, dimensions.z);
if (Math.abs(length - EXPECTED_LENGTH_METERS) > DIMENSION_TOLERANCE_METERS) {
  fail(`aircraft length ${length.toFixed(2)} m is outside expected CRJ700 range`);
}
if (Math.abs(wingspan - EXPECTED_WINGSPAN_METERS) > DIMENSION_TOLERANCE_METERS) {
  fail(`aircraft wingspan ${wingspan.toFixed(2)} m is outside expected CRJ700 range`);
}

const sha256 = createHash("sha256").update(glb).digest("hex");
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(outputPath, glb);
await writeFile(manifestPath, `${JSON.stringify({
  source: "CRJ700.stl",
  format: "glTF Binary 2.0",
  byteLength: glb.length,
  sha256,
  encodedSha256,
  chunkCount: chunkNames.length,
  chunks: chunkContents.map(({ name, content }) => ({ name, encodedCharacters: content.length })),
  dimensionsMeters: { length, wingspan, height: dimensions.y },
  noseGearOrigin: [0, 0, 0],
  forwardAxis: "-Z",
  upAxis: "+Y",
}, null, 2)}\n`, "utf8");

console.log(`Prepared CRJ700 GLB: ${glb.length} bytes, ${length.toFixed(2)} m long, ${wingspan.toFixed(2)} m span, sha256 ${sha256}.`);