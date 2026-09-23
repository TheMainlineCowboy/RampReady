import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const targets = [
  {
    name: "Terminal4",
    glb: "public/models/kphx/Terminal4.exact.glb",
    sourceDay: ".kphx-t4-source-textures/Terminal4_comb.dds",
    sourceLit: ".kphx-t4-source-textures/Terminal4_LIT.dds",
  },
  {
    name: "Terminal4b",
    glb: "public/models/kphx/Terminal4b.exact.glb",
    sourceDay: ".kphx-t4-source-textures/Terminal4b_comb.dds",
    sourceLit: ".kphx-t4-source-textures/Terminal4b_LIT.dds",
  },
];

const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${filePath}: invalid GLB magic`);
  let offset = 12;
  let json = null;
  let binary = null;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + length);
    if (type === 0x4e4f534a) {
      json = JSON.parse(chunk.toString("utf8").replace(/\0+$/g, "").trim());
    } else if (type === 0x004e4942) {
      binary = chunk;
    }
    offset += length;
  }
  if (!json || !binary) throw new Error(`${filePath}: incomplete GLB`);
  return { json, binary };
}

function embeddedImage(glb, imageIndex) {
  const image = glb.json.images?.[imageIndex];
  if (!image || image.bufferView == null) throw new Error(`Missing embedded image ${imageIndex}`);
  const view = glb.json.bufferViews?.[image.bufferView];
  if (!view) throw new Error(`Missing bufferView ${image.bufferView}`);
  const start = Number(view.byteOffset || 0);
  const length = Number(view.byteLength || 0);
  return {
    image,
    bytes: glb.binary.subarray(start, start + length),
  };
}

function decodeRgbaFromFile(filePath) {
  const result = spawnSync("convert", [filePath, "rgba:-"], {
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed decoding ${filePath}: ${String(result.stderr || "")}`);
  }
  return result.stdout;
}

function decodeRgbaFromPngBytes(bytes) {
  const result = spawnSync("convert", ["png:-", "rgba:-"], {
    input: bytes,
    encoding: null,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`ImageMagick failed decoding embedded PNG: ${String(result.stderr || "")}`);
  }
  return result.stdout;
}

function identifySizeFromFile(filePath) {
  const result = spawnSync("identify", ["-format", "%w %h", filePath], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`identify failed for ${filePath}: ${result.stderr}`);
  return result.stdout.trim().split(/\s+/).map(Number);
}

function identifySizeFromPngBytes(bytes) {
  const result = spawnSync("identify", ["-format", "%w %h", "png:-"], {
    input: bytes,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`identify failed for embedded PNG: ${result.stderr}`);
  return result.stdout.trim().split(/\s+/).map(Number);
}

const report = {
  schemaVersion: 1,
  authority: "Exact KPHX 1.75.1 supplied Terminal4/Terminal4b DDS source textures vs recovered GLB embedded PNG decoded RGBA",
  policy: "Raw DDS and PNG file hashes may differ after lossless format conversion; decoded RGBA must match exactly.",
  generatedAtUtc: new Date().toISOString(),
  targets: [],
};

for (const target of targets) {
  const glb = parseGlb(target.glb);
  const sourceMeta = glb.json.extras?.source;
  if (!sourceMeta?.dayTexture?.sha256 || !sourceMeta?.litTexture?.sha256) {
    throw new Error(`${target.name}: GLB source texture authority metadata missing`);
  }

  const sourceFiles = [
    { kind: "day", path: target.sourceDay, expectedRawSha256: sourceMeta.dayTexture.sha256, imageIndex: 0 },
    { kind: "lit", path: target.sourceLit, expectedRawSha256: sourceMeta.litTexture.sha256, imageIndex: 1 },
  ];

  const textures = [];
  for (const source of sourceFiles) {
    if (!fs.existsSync(source.path)) throw new Error(`${target.name}: missing source texture ${source.path}`);
    const sourceBytes = fs.readFileSync(source.path);
    const sourceRawSha256 = sha256(sourceBytes);
    if (sourceRawSha256 !== source.expectedRawSha256) {
      throw new Error(
        `${target.name} ${source.kind}: supplied DDS SHA changed: ${sourceRawSha256} !== ${source.expectedRawSha256}`,
      );
    }

    const embedded = embeddedImage(glb, source.imageIndex);
    if (embedded.image.mimeType !== "image/png") {
      throw new Error(`${target.name} ${source.kind}: embedded runtime image is not PNG`);
    }

    const sourceSize = identifySizeFromFile(source.path);
    const embeddedSize = identifySizeFromPngBytes(embedded.bytes);
    const sourceRgba = decodeRgbaFromFile(source.path);
    const embeddedRgba = decodeRgbaFromPngBytes(embedded.bytes);
    const sourceDecodedRgbaSha256 = sha256(sourceRgba);
    const embeddedDecodedRgbaSha256 = sha256(embeddedRgba);

    textures.push({
      kind: source.kind,
      sourcePath: source.path,
      sourceRawByteLength: sourceBytes.length,
      sourceRawSha256,
      expectedSourceRawSha256: source.expectedRawSha256,
      sourceRawHashMatchesAuthority: sourceRawSha256 === source.expectedRawSha256,
      sourceSize,
      embeddedName: embedded.image.name || null,
      embeddedByteLength: embedded.bytes.length,
      embeddedRawSha256: sha256(embedded.bytes),
      embeddedSize,
      sourceDecodedRgbaByteLength: sourceRgba.length,
      embeddedDecodedRgbaByteLength: embeddedRgba.length,
      sourceDecodedRgbaSha256,
      embeddedDecodedRgbaSha256,
      decodedSizeMatches: JSON.stringify(sourceSize) === JSON.stringify(embeddedSize),
      decodedRgbaMatchesSource: sourceDecodedRgbaSha256 === embeddedDecodedRgbaSha256,
    });
  }

  report.targets.push({
    name: target.name,
    glb: target.glb,
    glbSourceObjSha256: sourceMeta.obj?.sha256 || null,
    textures,
    allSourceRawHashesMatchAuthority: textures.every((entry) => entry.sourceRawHashMatchesAuthority),
    allDecodedSizesMatch: textures.every((entry) => entry.decodedSizeMatches),
    allDecodedRgbaMatchSource: textures.every((entry) => entry.decodedRgbaMatchesSource),
  });
}

for (const target of report.targets) {
  if (!target.allSourceRawHashesMatchAuthority) throw new Error(`${target.name}: source DDS raw hash mismatch`);
  if (!target.allDecodedSizesMatch) throw new Error(`${target.name}: decoded texture dimensions mismatch`);
  if (!target.allDecodedRgbaMatchSource) throw new Error(`${target.name}: decoded RGBA differs from supplied source`);
}

const output = "reports/kphx-t4-texture-pixel-verification.json";
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  status: "PASS",
  targets: report.targets.map((target) => ({
    name: target.name,
    textures: target.textures.map((entry) => ({
      kind: entry.kind,
      size: entry.sourceSize,
      decodedRgbaSha256: entry.sourceDecodedRgbaSha256,
    })),
  })),
}, null, 2));
