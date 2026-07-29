import { deflateSync } from "node:zlib";

function rgb565(value) {
  return [
    Math.round(((value >> 11) & 0x1f) * 255 / 31),
    Math.round(((value >> 5) & 0x3f) * 255 / 63),
    Math.round((value & 0x1f) * 255 / 31),
    255,
  ];
}

function decodeDxt1(bytes, width, height, dataOffset, bottomUp) {
  const rgba = Buffer.alloc(width * height * 4);
  let offset = dataOffset;
  for (let blockY = 0; blockY < Math.ceil(height / 4); blockY += 1) {
    for (let blockX = 0; blockX < Math.ceil(width / 4); blockX += 1) {
      if (offset + 8 > bytes.length) throw new Error("DXT1 bitmap ended inside a compression block");
      const color0 = bytes.readUInt16LE(offset);
      const color1 = bytes.readUInt16LE(offset + 2);
      const lookup = bytes.readUInt32LE(offset + 4);
      offset += 8;
      const c0 = rgb565(color0);
      const c1 = rgb565(color1);
      const colors = [c0, c1];
      colors.push(
        color0 > color1
          ? [Math.round((2 * c0[0] + c1[0]) / 3), Math.round((2 * c0[1] + c1[1]) / 3), Math.round((2 * c0[2] + c1[2]) / 3), 255]
          : [Math.round((c0[0] + c1[0]) / 2), Math.round((c0[1] + c1[1]) / 2), Math.round((c0[2] + c1[2]) / 2), 255],
        color0 > color1
          ? [Math.round((c0[0] + 2 * c1[0]) / 3), Math.round((c0[1] + 2 * c1[1]) / 3), Math.round((c0[2] + 2 * c1[2]) / 3), 255]
          : [0, 0, 0, 0],
      );
      for (let py = 0; py < 4; py += 1) {
        for (let px = 0; px < 4; px += 1) {
          const x = blockX * 4 + px;
          const encodedY = blockY * 4 + py;
          if (x >= width || encodedY >= height) continue;
          const y = bottomUp ? height - 1 - encodedY : encodedY;
          rgba.set(colors[(lookup >>> (2 * (py * 4 + px))) & 3], (y * width + x) * 4);
        }
      }
    }
  }
  return rgba;
}

function decodeRgb(bytes, width, height, dataOffset, bitsPerPixel, bottomUp) {
  if (![24, 32].includes(bitsPerPixel)) throw new Error(`Unsupported uncompressed BMP depth ${bitsPerPixel}`);
  const rgba = Buffer.alloc(width * height * 4);
  const bytesPerPixel = bitsPerPixel / 8;
  const rowStride = Math.ceil(width * bytesPerPixel / 4) * 4;
  for (let encodedY = 0; encodedY < height; encodedY += 1) {
    const y = bottomUp ? height - 1 - encodedY : encodedY;
    for (let x = 0; x < width; x += 1) {
      const source = dataOffset + encodedY * rowStride + x * bytesPerPixel;
      const target = (y * width + x) * 4;
      rgba[target] = bytes[source + 2];
      rgba[target + 1] = bytes[source + 1];
      rgba[target + 2] = bytes[source];
      rgba[target + 3] = bytesPerPixel === 4 ? bytes[source + 3] : 255;
    }
  }
  return rgba;
}

export function decodeLegacyBmp(bytes) {
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
  if (compression === DXT1) return { width, height, rgba: decodeDxt1(bytes, width, height, dataOffset, bottomUp), compression: "DXT1" };
  if (compression === 0) return { width, height, rgba: decodeRgb(bytes, width, height, dataOffset, bitsPerPixel, bottomUp), compression: "BI_RGB" };
  throw new Error(`Unsupported bitmap compression 0x${compression.toString(16)}`);
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

export function encodePng(width, height, rgba) {
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
