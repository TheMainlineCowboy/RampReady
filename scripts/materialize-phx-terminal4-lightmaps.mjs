import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";

const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const SOURCE_ROOT = `https://raw.githubusercontent.com/TheMainlineCowboy/SkyHarborPhx/${SOURCE_COMMIT}`;
const OUTPUT_DIR = path.resolve("public/models/phx-terminal4");
const TEXTURE_DIR = path.join(OUTPUT_DIR, "textures");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "texture-manifest.json");
const RUNTIME_MANIFEST_PATH = path.join(OUTPUT_DIR, "runtime-manifest.json");

// Only case-insensitive exact matches from the pinned uploaded source package
// are accepted here. The four existing diffuse fallbacks remain deliberately
// unlightmapped rather than inventing night textures for missing dependencies.
const EXACT_LIGHTMAP_SOURCES = Object.freeze({
  "BGATE1.BMP": "bgate1_lm.bmp",
  "BGATE3.BMP": "bgate3_lm.bmp",
  "DGATE1.BMP": "dgate1_lm.bmp",
  "DGATE2.BMP": "dgate2_lm.bmp",
  "DGATE3.BMP": "dgate3_lm.bmp",
  "DGATE4.BMP": "dgate4_lm.bmp",
  "DGATE5.BMP": "dgate5_lm.bmp",
  "PARKRAMP1.BMP": "parkramp1_lm.bmp",
  "SUPPORTS.BMP": "supports_lm.bmp",
  "T4_WALK.BMP": "t4_walk_lm.bmp",
  "T4_WALK2.BMP": "t4_walk2_lm.bmp",
});

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function download(relativePath) {
  const url = `${SOURCE_ROOT}/${relativePath}`;
  const maximumAttempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "RampReady-Terminal4-Lightmap-Materializer" },
        signal: controller.signal,
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const error = new Error(`Failed to download exact Terminal 4 lightmap ${relativePath}: HTTP ${response.status}`);
      if (!retryable || attempt === maximumAttempts) throw error;
      lastError = error;
    } catch (error) {
      lastError = error;
      if (attempt === maximumAttempts) break;
    } finally {
      clearTimeout(timeout);
    }
    const delay = 500 * (2 ** (attempt - 1));
    console.warn(`Terminal 4 lightmap download retry ${attempt}/${maximumAttempts - 1} for ${relativePath} after ${lastError?.message || "network failure"}`);
    await sleep(delay);
  }
  throw new Error(`Failed to download exact Terminal 4 lightmap ${relativePath} after ${maximumAttempts} attempts`, { cause: lastError });
}

function rgb565(value) {
  return [
    Math.round(((value >> 11) & 0x1f) * 255 / 31),
    Math.round(((value >> 5) & 0x3f) * 255 / 63),
    Math.round((value & 0x1f) * 255 / 31),
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
      if (offset + 8 > bytes.length) throw new Error("DXT1 lightmap ended inside a compression block");
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
          rgba.set(colors[paletteIndex], (y * width + x) * 4);
        }
      }
    }
  }
  return rgba;
}

function decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp) {
  if (![24, 32].includes(bitsPerPixel)) throw new Error(`Unsupported lightmap bitmap depth ${bitsPerPixel}`);
  const rgba = Buffer.alloc(width * height * 4);
  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil(width * bytesPerPixel / 4) * 4;
  for (let encodedY = 0; encodedY < height; encodedY += 1) {
    const y = bottomUp ? height - 1 - encodedY : encodedY;
    const rowOffset = dataOffset + encodedY * rowStride;
    for (let x = 0; x < width; x += 1) {
      const source = rowOffset + x * bytesPerPixel;
      const target = (y * width + x) * 4;
      rgba[target] = bytes[source + 2];
      rgba[target + 1] = bytes[source + 1];
      rgba[target + 2] = bytes[source];
      rgba[target + 3] = bytesPerPixel === 4 ? bytes[source + 3] : 255;
    }
  }
  return rgba;
}

function decodeLegacyBmp(bytes) {
  if (bytes.length < 54 || bytes.toString("ascii", 0, 2) !== "BM") throw new Error("Lightmap is not a Windows/FSX bitmap");
  const dataOffset = bytes.readUInt32LE(10);
  const signedWidth = bytes.readInt32LE(18);
  const signedHeight = bytes.readInt32LE(22);
  const width = Math.abs(signedWidth);
  const height = Math.abs(signedHeight);
  const bitsPerPixel = bytes.readUInt16LE(28);
  const compression = bytes.readUInt32LE(30);
  const bottomUp = signedHeight > 0;
  if (!(width > 0 && height > 0)) throw new Error(`Invalid lightmap dimensions ${signedWidth} x ${signedHeight}`);
  const DXT1 = 0x31545844;
  if (compression === DXT1) {
    return { width, height, rgba: decodeDxt1Bmp(bytes, width, height, dataOffset, bottomUp), compression: "DXT1" };
  }
  if (compression === 0) {
    return {
      width,
      height,
      rgba: decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp),
      compression: "BI_RGB",
    };
  }
  throw new Error(`Unsupported lightmap bitmap compression 0x${compression.toString(16)}`);
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

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
if (manifest.schemaVersion !== 2 || !manifest.materials) throw new Error("Terminal 4 diffuse manifest must exist before exact lightmaps are materialized");

let emitted = 0;
for (const [reference, sourcePath] of Object.entries(EXACT_LIGHTMAP_SOURCES)) {
  const material = manifest.materials[reference];
  if (!material) throw new Error(`Terminal 4 exact lightmap target is absent from the diffuse manifest: ${reference}`);
  const sourceBytes = await download(sourcePath);
  const decoded = decodeLegacyBmp(sourceBytes);
  const png = encodePng(decoded.width, decoded.height, decoded.rgba);
  const fileName = `${reference.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]/g, "_")}_LM.png`;
  await writeFile(path.join(TEXTURE_DIR, fileName), png);
  Object.assign(material, {
    emissiveUrl: `textures/${fileName}`,
    emissiveSourcePath: sourcePath,
    emissiveSourceSha256: sha256(sourceBytes),
    emissivePngSha256: sha256(png),
    emissiveWidth: decoded.width,
    emissiveHeight: decoded.height,
    emissiveSourceCompression: decoded.compression,
    emissiveFidelity: "exact",
  });
  emitted += 1;
}

if (emitted !== Object.keys(EXACT_LIGHTMAP_SOURCES).length) throw new Error(`Terminal 4 exact lightmap count drifted: ${emitted}`);
manifest.emissiveTextureCount = emitted;
manifest.lightmapStatus = "pinned-exact-source-lightmaps-active-no-invented-missing-maps";
manifest.lightmapSourceCommit = SOURCE_COMMIT;
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

const runtimeManifest = JSON.parse(await readFile(RUNTIME_MANIFEST_PATH, "utf8"));
runtimeManifest.emissiveTextureCount = emitted;
runtimeManifest.lightmapStatus = manifest.lightmapStatus;
runtimeManifest.lightmapSourceCommit = SOURCE_COMMIT;
await writeFile(RUNTIME_MANIFEST_PATH, `${JSON.stringify(runtimeManifest, null, 2)}\n`);

console.log(`RampReady Terminal 4 exact source lightmaps materialized: ${emitted} emissive textures; missing package dependencies remain unfilled.`);
