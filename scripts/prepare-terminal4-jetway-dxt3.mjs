import fs from "node:fs";

const path = "scripts/materialize-phx-terminal4.mjs";
let source = fs.readFileSync(path, "utf8");

if (!source.includes("function decodeDxt3Bmp")) {
  const anchor = "function decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp) {";
  if (!source.includes(anchor)) throw new Error("Terminal 4 DXT3 decoder insertion anchor is missing");
  const decoder = `function decodeDxt3Bmp(bytes, width, height, dataOffset, bottomUp) {
  const rgba = Buffer.alloc(width * height * 4);
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  let offset = dataOffset;
  for (let blockY = 0; blockY < blocksHigh; blockY += 1) {
    for (let blockX = 0; blockX < blocksWide; blockX += 1) {
      if (offset + 16 > bytes.length) throw new Error("DXT3 bitmap ended inside a compression block");
      const alphaBytes = bytes.subarray(offset, offset + 8);
      const color0 = bytes.readUInt16LE(offset + 8);
      const color1 = bytes.readUInt16LE(offset + 10);
      const lookup = bytes.readUInt32LE(offset + 12);
      offset += 16;
      const c0 = rgb565(color0);
      const c1 = rgb565(color1);
      const colors = [
        c0,
        c1,
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
      ];
      for (let pixelY = 0; pixelY < 4; pixelY += 1) {
        const alphaRow = alphaBytes.readUInt16LE(pixelY * 2);
        for (let pixelX = 0; pixelX < 4; pixelX += 1) {
          const x = blockX * 4 + pixelX;
          const encodedY = blockY * 4 + pixelY;
          if (x >= width || encodedY >= height) continue;
          const y = bottomUp ? height - 1 - encodedY : encodedY;
          const paletteIndex = (lookup >>> (2 * (pixelY * 4 + pixelX))) & 0x3;
          const target = (y * width + x) * 4;
          const color = colors[paletteIndex];
          rgba[target] = color[0];
          rgba[target + 1] = color[1];
          rgba[target + 2] = color[2];
          rgba[target + 3] = ((alphaRow >>> (pixelX * 4)) & 0x0f) * 17;
        }
      }
    }
  }
  return rgba;
}

${anchor}`;
  source = source.replace(anchor, decoder);
}

if (!source.includes("const DXT3 = 0x33545844")) {
  const oldText = `  const DXT1 = 0x31545844;
  let rgba;
  if (compression === DXT1) rgba = decodeDxt1Bmp(bytes, width, height, dataOffset, bottomUp);
  else if (compression === 0) rgba = decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp);
  else throw new Error(\`Unsupported bitmap compression 0x\${compression.toString(16)}\`);
  return { width, height, rgba, compression: compression === DXT1 ? "DXT1" : "BI_RGB" };`;
  const newText = `  const DXT1 = 0x31545844;
  const DXT3 = 0x33545844;
  let rgba;
  if (compression === DXT1) rgba = decodeDxt1Bmp(bytes, width, height, dataOffset, bottomUp);
  else if (compression === DXT3) rgba = decodeDxt3Bmp(bytes, width, height, dataOffset, bottomUp);
  else if (compression === 0) rgba = decodeUncompressedBmp(bytes, width, height, dataOffset, bitsPerPixel, bottomUp);
  else throw new Error(\`Unsupported bitmap compression 0x\${compression.toString(16)}\`);
  return {
    width,
    height,
    rgba,
    compression: compression === DXT1 ? "DXT1" : compression === DXT3 ? "DXT3" : "BI_RGB",
  };`;
  if (!source.includes(oldText)) throw new Error("Terminal 4 bitmap compression switch anchor is missing");
  source = source.replace(oldText, newText);
}

for (const token of [
  "function decodeDxt3Bmp",
  "const DXT3 = 0x33545844",
  "compression === DXT3",
  'compression === DXT3 ? "DXT3"',
  "alphaRow >>> (pixelX * 4)",
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 exact DXT3 decoder is missing ${token}`);
}
fs.writeFileSync(path, source, "utf8");
console.log("Prepared exact FSX DXT3 decoding for M1DGJETWAY day and night textures, including explicit 4-bit alpha.");
