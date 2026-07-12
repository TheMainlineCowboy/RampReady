import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";

const assetPath = new URL("../public/models/crj700/crj700-mobile.glb", import.meta.url);
const manifestPath = new URL("../public/models/crj700/crj700-mobile.manifest.json", import.meta.url);
const EXPECTED_LENGTH_METERS = 32.5;
const EXPECTED_WINGSPAN_METERS = 23.64;
const DIMENSION_TOLERANCE_METERS = 0.9;

function fail(message) {
  throw new Error(`CRJ700 asset preparation failed: ${message}`);
}

function parseGlb(buffer) {
  if (buffer.length < 20) fail("committed payload is too small to be a GLB file");
  if (buffer.toString("utf8", 0, 4) !== "glTF") fail("committed payload does not have the GLB magic header");
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

const glb = await readFile(assetPath);
const assetStats = await stat(assetPath);
if (assetStats.size < 10_000) fail(`committed GLB is unexpectedly small (${assetStats.size} bytes)`);

const gltf = parseGlb(glb);
const dimensions = dimensionsFromAccessors(gltf);
const length = dimensions.z;
const wingspan = dimensions.x;
if (Math.abs(length - EXPECTED_LENGTH_METERS) > DIMENSION_TOLERANCE_METERS) {
  fail(`aircraft length ${length.toFixed(2)} m is outside expected CRJ700 range`);
}
if (Math.abs(wingspan - EXPECTED_WINGSPAN_METERS) > DIMENSION_TOLERANCE_METERS) {
  fail(`aircraft wingspan ${wingspan.toFixed(2)} m is outside expected CRJ700 range`);
}

const sha256 = createHash("sha256").update(glb).digest("hex");
await writeFile(manifestPath, `${JSON.stringify({
  source: "CRJ700.stl",
  format: "glTF Binary 2.0",
  byteLength: glb.length,
  sha256,
  dimensionsMeters: { length, wingspan, height: dimensions.y },
  boundsMeters: { min: dimensions.min, max: dimensions.max },
  noseGearOrigin: [0, 0, 0],
  forwardAxis: "-Z",
  upAxis: "+Y",
  renderedAssetPath: "models/crj700/crj700-mobile.glb",
}, null, 2)}\n`, "utf8");

console.log(`Verified committed CRJ700 GLB: ${glb.length} bytes, ${length.toFixed(2)} m long, ${wingspan.toFixed(2)} m span, sha256 ${sha256}.`);
