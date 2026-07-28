import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { deflateSync } from "node:zlib";

const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const SOURCE_BGL_SHA256 = "57140405cac64a0ce7f73a875d490307cf44f74f47b996441666dd0abad37df9";
const SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${SOURCE_COMMIT}`;
const SOURCE_BGL_URL = `${SOURCE_ROOT}/scenery/term4.BGL`;
const EXTRACTOR_URL = `${SOURCE_ROOT}/scripts/extract-terminal4-mdlx.mjs`;
const OUTPUT_DIR = path.resolve("public/models/phx-terminal4");
const TEXTURE_DIR = path.join(OUTPUT_DIR, "textures");
const CACHE_DIR = path.resolve(".cache/phx-terminal4-source");
const EXPECTED = Object.freeze({
  modelName: "phx_term400",
  triangleCount: 11138,
  partCount: 19,
  embeddedModelCount: 1,
  boundsMin: [-361.947998046875, 0, -213.22799682617188],
  boundsMax: [488.2799987792969, 30.215999603271484, 266.8240051269531],
});

// The four diffuse files absent from the uploaded package are mapped only to
// other authored textures from the same pinned Sky Harbor source package.
const TEXTURE_SOURCES = Object.freeze({
  "BGATE1.BMP": { sourcePath: "bgate1.bmp", fidelity: "exact" },
  "BGATE3.BMP": { sourcePath: "bgate3.bmp", fidelity: "exact" },
  "DGATE1.BMP": { sourcePath: "dgate1.bmp", fidelity: "exact" },
  "DGATE2.BMP": { sourcePath: "dgate2.bmp", fidelity: "exact" },
  "DGATE3.BMP": { sourcePath: "dgate3.bmp", fidelity: "exact" },
  "DGATE4.BMP": { sourcePath: "dgate4.bmp", fidelity: "exact" },
  "DGATE5.BMP": { sourcePath: "dgate5.bmp", fidelity: "exact" },
  "PARKRAMP1.BMP": { sourcePath: "parkramp1.bmp", fidelity: "exact" },
  "PARKRAMPS.BMP": { sourcePath: "parkramps.bmp", fidelity: "exact" },
  "PARKRAMPS2.BMP": { sourcePath: "parkramps.bmp", fidelity: "authored-source-fallback" },
  "PHX_TERM400_0.DDS": { sourcePath: "bgate1.bmp", fidelity: "authored-source-fallback" },
  "PHX_TERM400_1.DDS": { sourcePath: "bgate3.bmp", fidelity: "authored-source-fallback" },
  "PHXRAMPLIGHT.BMP": { sourcePath: "supports2.bmp", fidelity: "authored-source-fallback" },
  "RW.BMP": { sourcePath: "rw.bmp", fidelity: "exact" },
  "SUPPORTS.BMP": { sourcePath: "supports.bmp", fidelity: "exact" },
  "T4_WALK.BMP": { sourcePath: "t4_walk.bmp", fidelity: "exact" },
  "T4_WALK2.BMP": { sourcePath: "t4_walk2.bmp", fidelity: "exact" },
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const nearlyEqual = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

async function download(url) {
  const response = await fetch(url, { headers: { "User-Agent": "RampReady-Terminal4-Materializer" } });
  if (!response.ok) throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function rgb565(value) {
  const red = (value >> 11) & 0x1f;
  const green = (value >> 5) & 0x3f;
  const blue = value & 0x1f;
  return [
    Math.round(red * 255 / 31),
    Math.round(green * 255 / 63),
    Math.round(blue * 255 / 31),
    255,
  ];
}

function decodeDxt1Bmp(bytes, width, height, dataOffset, bottomUp) {
  const rgba = Buffer.alloc(width * height * 4);
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  let offset = dataOffset;

  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      if (offset + 8 > bytes.length) throw new Error("DXT1 bitmap ended inside a compression block");
      const color0 = bytes.readUInt16LE(offset);
      const color1 = bytes.readUInt16LE(offset + 2);
      const lookup = bytes.readUInt32LE(offset + 4);
      offset += 8;

      const c0 = rgb565(color0);
      const c1 = rgb565(color1);
      const colors = [c0, c1];
      if (color0 > color1) {
        colors.push(
          [
            Math.round((2 * c0[0] + c1[0]) / 3),
            Math.round((2 * c0[1] + c1[1]) / 3),
            Math.round((2 * c0[2] + c1[2]) / 3),
            255,
          ],
          [
            Math.round((c0[0] + 2 * c1[0]) / 3),
            Math.round((c0[1] + 2 * c1[1]) / 3),
            Math.round((c0[2] + 2 * c1[2]) / 3),
            255,
          ],
        );
      } else {
        colors.push(
          [
            Math.round((c0[0] + c1[0]) / 2),
            Math.round((c0[1] + c1[1]) / 2),
            Math.round((c0[2] + c1[2]) / 2),
            255,
          ],
          [0, 0, 0, 0],
        );
      }

      for (let pixelY = 0; pixelY < 4; pixelY += 1) {
        for (let pixelX = 0; pixelX < 4; pixelX += 1) {
          const x = blockX * 4 + pixelX;
          const encodedY = blockY * 4 + pixelY;
          if (x >= width || encodedY >= height) continue;
          const y = bottomUp ? height - 1 - encodedY : encodedY;
          const paletteIndex = (lookup >>> (2 * (pixelY * 4 + pixelX))) & 0x3;
          const target = (y * width + x) * 4;
          rgba.set(colors[paletteIndex], target);
        }
      }
    }
  }
  return rgba;
}

function decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp) {
  if (![24, 32].includes(bitsPerPixel)) throw new Error(`Unsupported uncompressed BMP depth ${bitsPerPixel}`);
  const rgba = Buffer.alloc(width * height * 4);
  const sourceBytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil(width * sourceBytesPerPixel / 4) * 4;
  for (let encodedY = 0; encodedY < height; encodedY += 1) {
    const y = bottomUp ? height - 1 - encodedY : encodedY;
    const rowOffset = dataOffset + encodedY * rowStride;
    for (let x = 0; x < width; x += 1) {
      const source = rowOffset + x * sourceBytesPerPixel;
      const target = (y * width + x) * 4;
      rgba[target] = bytes[source + 2];
      rgba[target + 1] = bytes[source + 1];
      rgba[target + 2] = bytes[source];
      rgba[target + 3] = sourceBytesPerPixel === 4 ? bytes[source + 3] : 255;
    }
  }
  return rgba;
}

function decodeLegacyBmp(bytes) {
  if (bytes.length < 54 || bytes.toString("ascii", 0, 2) !== "BM") throw new Error("Texture is not a Windows/FSX bitmap");
  const dataOffset = bytes.readUInt32LE(10);
  const signedWidth = bytes.readInt32LE(18);
  const signedHeight = bytes.readInt32LE(22);
  const width = Math.abs(signedWidth);
  const height = Math.abs(signedHeight);
  const bitsPerPixel = bytes.readUInt16LE(28);
  const compression = bytes.readUInt32LE(30);
  const bottomUp = signedHeight > 0;
  if (!(width > 0 && height > 0)) throw new Error(`Invalid bitmap dimensions ${signedWidth} x ${signedHeight}`);

  const DXT1 = 0x31545844;
  let rgba;
  if (compression === DXT1) rgba = decodeDxt1Bmp(bytes, width, height, dataOffset, bottomUp);
  else if (compression === 0) rgba = decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp);
  else throw new Error(`Unsupported bitmap compression 0x${compression.toString(16)}`);
  return { width, height, rgba, compression: compression === DXT1 ? "DXT1" : "BI_RGB" };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    scanlines[row] = 0;
    rgba.copy(scanlines, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND"),
  ]);
}

await rm(CACHE_DIR, { recursive: true, force: true });
await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(CACHE_DIR, { recursive: true });
await mkdir(TEXTURE_DIR, { recursive: true });

const [bgl, extractor] = await Promise.all([download(SOURCE_BGL_URL), download(EXTRACTOR_URL)]);
const sourceHash = sha256(bgl);
if (sourceHash !== SOURCE_BGL_SHA256) {
  throw new Error(`Terminal 4 source identity mismatch: ${sourceHash} != ${SOURCE_BGL_SHA256}`);
}

const bglPath = path.join(CACHE_DIR, "term4.BGL");
const extractorPath = path.join(CACHE_DIR, "extract-terminal4-mdlx.mjs");
await writeFile(bglPath, bgl);
await writeFile(extractorPath, extractor);

const result = spawnSync(process.execPath, [extractorPath, bglPath, OUTPUT_DIR], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 60_000,
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Terminal 4 extractor failed (${result.status}):\n${result.stderr || result.stdout}`);
}

const manifestPath = path.join(OUTPUT_DIR, "extraction-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const gltf = JSON.parse(await readFile(path.join(OUTPUT_DIR, "terminal4.gltf"), "utf8"));
const bin = await readFile(path.join(OUTPUT_DIR, "terminal4.bin"));

if (manifest.sourceSha256 !== SOURCE_BGL_SHA256) throw new Error("Terminal 4 extraction manifest source SHA mismatch");
if (manifest.embeddedModelCount !== EXPECTED.embeddedModelCount) throw new Error(`Unexpected embedded model count ${manifest.embeddedModelCount}`);
if (manifest.selectedModel !== EXPECTED.modelName) throw new Error(`Unexpected Terminal 4 model ${manifest.selectedModel}`);
if (manifest.output?.triangleCount !== EXPECTED.triangleCount) throw new Error(`Unexpected Terminal 4 triangle count ${manifest.output?.triangleCount}`);
if (manifest.output?.partCount !== EXPECTED.partCount || manifest.output?.skipped !== 0) throw new Error("Terminal 4 did not preserve all authored parts");
if (gltf?.nodes?.[0]?.name !== "PHX_Terminal4_Authored") throw new Error("Terminal 4 glTF root identity is missing");
if (gltf?.meshes?.[0]?.primitives?.length !== EXPECTED.partCount) throw new Error(`Terminal 4 primitive count is ${gltf?.meshes?.[0]?.primitives?.length}`);
if (bin.length !== 1_069_248) throw new Error(`Unexpected Terminal 4 binary size ${bin.length}`);

for (let i = 0; i < 3; i += 1) {
  if (!nearlyEqual(manifest.output.bounds.min[i], EXPECTED.boundsMin[i])) throw new Error(`Terminal 4 min bound ${i} drifted`);
  if (!nearlyEqual(manifest.output.bounds.max[i], EXPECTED.boundsMax[i])) throw new Error(`Terminal 4 max bound ${i} drifted`);
  if (!nearlyEqual(manifest.output.declaredBounds.min[i], manifest.output.bounds.min[i])) throw new Error(`Terminal 4 reconstructed/declaration min bound mismatch ${i}`);
  if (!nearlyEqual(manifest.output.declaredBounds.max[i], manifest.output.bounds.max[i])) throw new Error(`Terminal 4 reconstructed/declaration max bound mismatch ${i}`);
}

const diffuseReferences = [...new Set((gltf.materials ?? []).map((entry) => entry.extras?.diffuseTexture).filter(Boolean))];
const unknownReferences = diffuseReferences.filter((reference) => !TEXTURE_SOURCES[reference]);
if (unknownReferences.length) throw new Error(`Terminal 4 texture mapping is incomplete: ${unknownReferences.join(", ")}`);

const sourceCache = new Map();
const materialTextures = {};
for (const reference of diffuseReferences) {
  const mapping = TEXTURE_SOURCES[reference];
  let sourceBytes = sourceCache.get(mapping.sourcePath);
  if (!sourceBytes) {
    sourceBytes = await download(`${SOURCE_ROOT}/${mapping.sourcePath}`);
    sourceCache.set(mapping.sourcePath, sourceBytes);
  }
  const decoded = decodeLegacyBmp(sourceBytes);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);
  const fileName = `${reference.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_")}.png`;
  await writeFile(path.join(TEXTURE_DIR, fileName), png);
  materialTextures[reference] = {
    url: `textures/${fileName}`,
    sourcePath: mapping.sourcePath,
    sourceSha256: sha256(sourceBytes),
    pngSha256: sha256(png),
    width: decoded.width,
    height: decoded.height,
    sourceCompression: decoded.compression,
    fidelity: mapping.fidelity,
  };
}

const exactTextureCount = Object.values(materialTextures).filter((entry) => entry.fidelity === "exact").length;
const fallbackTextureCount = Object.values(materialTextures).length - exactTextureCount;
const textureManifest = {
  schemaVersion: 2,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  sourceModel: "scenery/term4.BGL",
  materialCount: gltf.materials?.length ?? 0,
  diffuseReferenceCount: diffuseReferences.length,
  exactTextureCount,
  fallbackTextureCount,
  outputFormat: "PNG converted deterministically from pinned FSX DXT1/bitmap sources",
  materials: materialTextures,
};
await writeFile(path.join(OUTPUT_DIR, "texture-manifest.json"), `${JSON.stringify(textureManifest, null, 2)}\n`);

const runtimeManifest = {
  schemaVersion: 2,
  sourceRepository: "TheMainlineCowboy/SkyHarborPhx",
  sourceCommit: SOURCE_COMMIT,
  sourcePath: "scenery/term4.BGL",
  sourceBytes: bgl.length,
  sourceSha256: sourceHash,
  modelName: EXPECTED.modelName,
  triangleCount: EXPECTED.triangleCount,
  partCount: EXPECTED.partCount,
  bounds: manifest.output.bounds,
  gltfBytes: Buffer.byteLength(JSON.stringify(gltf)),
  binBytes: bin.length,
  binSha256: sha256(bin),
  texturesReferenced: manifest.output.textureNames,
  activeDiffuseTextures: diffuseReferences,
  exactTextureCount,
  fallbackTextureCount,
  textureStatus: "pinned-authored-source-textures-active",
};
await writeFile(path.join(OUTPUT_DIR, "runtime-manifest.json"), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
console.log(`RampReady real PHX Terminal 4 materialized: ${EXPECTED.triangleCount} triangles, ${EXPECTED.partCount} parts, ${exactTextureCount} exact and ${fallbackTextureCount} source-authored fallback textures.`);
