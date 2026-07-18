import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeLektroScanForCleanup } from "./analyze-lektro-scan-clean.mjs";

const REQUIRED_FILES = ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"];

export function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("3DModel.jpg is not a JPEG file");
  }
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 1 >= buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame) {
      if (segmentLength < 7) throw new Error("3DModel.jpg has an invalid SOF segment");
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new Error("Unable to read 3DModel.jpg dimensions");
}

async function sha256(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function percentDifference(actual, expected) {
  return Math.abs(actual - expected) / expected * 100;
}

export async function intakeLektroScan(inputDirectory, outputDirectory) {
  const input = path.resolve(inputDirectory);
  const output = path.resolve(outputDirectory);
  const contract = JSON.parse(await readFile(new URL("../docs/assets/lektro-scan-source-intake.json", import.meta.url), "utf8"));

  const files = {};
  for (const required of contract.requiredFiles) {
    const filePath = path.join(input, required.name);
    const info = await stat(filePath);
    if (!info.isFile() || info.size < required.minimumBytes) {
      throw new Error(`${required.name} is missing or smaller than the intake minimum`);
    }
    files[required.name] = {
      bytes: info.size,
      sha256: await sha256(filePath),
    };
  }

  const textureBytes = await readFile(path.join(input, "3DModel.jpg"));
  const texture = readJpegDimensions(textureBytes);
  const analysis = await analyzeLektroScanForCleanup(input);
  const expected = contract.expectedInspection;
  const tolerance = expected.numericTolerance;

  const checks = {
    vertices: percentDifference(analysis.vertices, expected.vertices) <= tolerance.meshCountsPercent,
    triangles: percentDifference(analysis.triangles, expected.triangles) <= tolerance.meshCountsPercent,
    textureWidth: texture.width === expected.textureWidth,
    textureHeight: texture.height === expected.textureHeight,
    bounds: analysis.bounds.extents.every((value, axis) =>
      percentDifference(value, expected.rawExtents[axis]) <= tolerance.boundsPercent),
    diffuseTextureReference: analysis.material.diffuseTextureReferences.some((value) => value.endsWith("3DModel.jpg")),
  };
  const passed = Object.values(checks).every(Boolean);

  await mkdir(output, { recursive: true });
  const intakeReport = {
    schemaVersion: 1,
    asset: contract.asset,
    sourceArchive: contract.sourceArchive,
    inputDirectory: input,
    files,
    texture,
    checks,
    passed,
    runtimeUseAllowed: false,
    generatedAt: new Date().toISOString(),
  };
  const componentsReport = {
    schemaVersion: 1,
    asset: contract.asset,
    sourceBounds: analysis.bounds,
    topology: analysis.topology,
    provisionalNormalization: analysis.provisionalNormalization,
    destructiveCleanupAllowed: passed,
  };

  await writeFile(path.join(output, "source-intake-report.json"), `${JSON.stringify(intakeReport, null, 2)}\n`);
  await writeFile(path.join(output, "connected-components.json"), `${JSON.stringify(componentsReport, null, 2)}\n`);
  await writeFile(path.join(output, "SHA256SUMS"), `${REQUIRED_FILES.map((name) => `${files[name].sha256}  ${name}`).join("\n")}\n`);

  if (!passed) throw new Error("KIRI scan package failed source-intake tolerances; reports were written for diagnosis");
  return { intakeReport, componentsReport };
}

async function main() {
  const inputDirectory = process.argv[2];
  const outputDirectory = process.argv[3] ?? "artifacts/lektro-scan";
  if (!inputDirectory) {
    throw new Error("Usage: npm run intake:lektro-scan -- <source-directory> [output-directory]");
  }
  const result = await intakeLektroScan(inputDirectory, outputDirectory);
  process.stdout.write(`${JSON.stringify(result.intakeReport, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
