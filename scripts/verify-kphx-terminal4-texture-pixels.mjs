import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const sourceDirectory = process.argv[2] || "/tmp/kphx-t4-source-textures";
const reportPath = process.argv[3] || "reports/kphx-terminal4-texture-pixel-verification.json";

const targets = [
  {
    name: "Terminal4",
    glbPath: "public/models/kphx/Terminal4.exact.glb",
    sourceTextures: {
      Terminal4_comb: {
        file: "Terminal4_comb.dds",
        sha256: "84667f356e16d83065773fadcba30cc222b4d6a2a739b4000545cca265f53186",
      },
      Terminal4_LIT: {
        file: "Terminal4_LIT.dds",
        sha256: "65937e43b6eff0b95480496d64d98d3b59779b2fe4b7af9c984f1e404624b17f",
      },
    },
  },
  {
    name: "Terminal4b",
    glbPath: "public/models/kphx/Terminal4b.exact.glb",
    sourceTextures: {
      Terminal4b_comb: {
        file: "Terminal4b_comb.dds",
        sha256: "11a129f33940c99de15c2941faac041af42834c869ab6bdae974d134c54bc00b",
      },
      Terminal4b_LIT: {
        file: "Terminal4b_LIT.dds",
        sha256: "90cff1e29f629570d6ea1ee237a3f8dd337860aef36dfd4d478d0ee8057f90f9",
      },
    },
  },
];

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function parseGlb(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error(`${filePath}: bad GLB magic`);
  let offset = 12;
  let json = null;
  let binaryChunk = null;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = bytes.subarray(offset, offset + chunkLength);
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(chunk.toString("utf8").replace(/\0+$/g, "").trim());
    } else if (chunkType === 0x004e4942) {
      binaryChunk = chunk;
    }
    offset += chunkLength;
  }
  if (!json || !binaryChunk) throw new Error(`${filePath}: incomplete GLB`);
  return { json, binaryChunk };
}

async function decodedRgbaSha256(filePath) {
  return await new Promise((resolve, reject) => {
    const child = spawn("convert", [filePath, "rgba:-"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const hash = crypto.createHash("sha256");
    let stderr = "";
    child.stdout.on("data", (chunk) => hash.update(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick convert failed for ${filePath}: ${stderr.trim()}`));
        return;
      }
      resolve(hash.digest("hex"));
    });
  });
}

async function imageSize(filePath) {
  return await new Promise((resolve, reject) => {
    const child = spawn("identify", ["-format", "%w %h", filePath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ImageMagick identify failed for ${filePath}: ${stderr.trim()}`));
        return;
      }
      const [width, height] = stdout.trim().split(/\s+/).map(Number);
      resolve([width, height]);
    });
  });
}

const report = {
  generatedAtUtc: new Date().toISOString(),
  authority: "Decoded RGBA equality between exact KPHX 1.75.1 source DDS textures and recovered Terminal4 GLB embedded PNG textures",
  sourceDirectory,
  targets: [],
};

const tempDirectory = "/tmp/kphx-t4-embedded-textures";
fs.rmSync(tempDirectory, { recursive: true, force: true });
fs.mkdirSync(tempDirectory, { recursive: true });

for (const target of targets) {
  const { json, binaryChunk } = parseGlb(target.glbPath);
  const bufferViews = json.bufferViews || [];
  const images = json.images || [];
  const targetReport = {
    name: target.name,
    glbPath: target.glbPath,
    textures: [],
  };

  for (const [imageName, source] of Object.entries(target.sourceTextures)) {
    const imageIndex = images.findIndex((entry) => String(entry.name || "") === imageName);
    if (imageIndex < 0) throw new Error(`${target.glbPath}: embedded image ${imageName} not found`);
    const image = images[imageIndex];
    if (image.bufferView == null) throw new Error(`${target.glbPath}: ${imageName} is not embedded`);
    const view = bufferViews[image.bufferView];
    if (!view) throw new Error(`${target.glbPath}: ${imageName} missing bufferView`);

    const sourcePath = path.join(sourceDirectory, source.file);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing exact source texture: ${sourcePath}`);
    const sourceBytes = fs.readFileSync(sourcePath);
    const sourceFileSha256 = sha256(sourceBytes);
    if (sourceFileSha256 !== source.sha256) {
      throw new Error(`${source.file} source SHA changed: ${sourceFileSha256} !== ${source.sha256}`);
    }

    const byteOffset = Number(view.byteOffset || 0);
    const byteLength = Number(view.byteLength || 0);
    const embeddedBytes = binaryChunk.subarray(byteOffset, byteOffset + byteLength);
    const embeddedPath = path.join(tempDirectory, `${imageName}.png`);
    fs.writeFileSync(embeddedPath, embeddedBytes);

    const [sourcePixelSha256, embeddedPixelSha256, sourceSize, embeddedSize] = await Promise.all([
      decodedRgbaSha256(sourcePath),
      decodedRgbaSha256(embeddedPath),
      imageSize(sourcePath),
      imageSize(embeddedPath),
    ]);

    targetReport.textures.push({
      imageName,
      sourceFile: source.file,
      sourceFileBytes: sourceBytes.length,
      sourceFileSha256,
      expectedSourceFileSha256: source.sha256,
      sourceFileHashMatches: sourceFileSha256 === source.sha256,
      embeddedFileBytes: embeddedBytes.length,
      embeddedFileSha256: sha256(embeddedBytes),
      sourceSize,
      embeddedSize,
      decodedSourceRgbaSha256: sourcePixelSha256,
      decodedEmbeddedRgbaSha256: embeddedPixelSha256,
      decodedRgbaExactMatch: sourcePixelSha256 === embeddedPixelSha256,
    });
  }

  targetReport.allDecodedRgbaExact = targetReport.textures.every((entry) => entry.decodedRgbaExactMatch === true);
  report.targets.push(targetReport);
}

report.allDecodedRgbaExact = report.targets.every((target) => target.allDecodedRgbaExact === true);

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

if (!report.allDecodedRgbaExact) {
  throw new Error("Terminal 4 decoded source/runtime texture pixels do not match exactly");
}

console.log(JSON.stringify(report, null, 2));
