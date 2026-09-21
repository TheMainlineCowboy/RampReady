import { createHash } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import {
  KPHX_EXACT_RECOVERED_ASSETS,
  kphxExactAssetForResource,
  kphxExactPackedMeshNameForResource,
} from "../src/environment/kphxFullAirport/exactAssetCatalog.js";

const execFile = promisify(execFileCallback);

const [, , sourceRootArg, runtimeRootArg] = process.argv;
const sourceRoot = path.resolve(sourceRootArg || process.env.KPHX_FULL_AIRPORT_SOURCE_DIR || "");
const runtimeRoot = path.resolve(runtimeRootArg || "public/models/kphx-full-airport");
const reportRoot = path.resolve("reports");
const placementReportPath = path.join(reportRoot, "kphx-full-airport-wed-placements.json");
const runtimeManifestPath = path.join(runtimeRoot, "manifest.json");
const materializationReportPath = path.join(reportRoot, "kphx-full-airport-materialization.json");
const magick = process.env.KPHX_MAGICK_BIN || "magick";

if (!sourceRootArg && !process.env.KPHX_FULL_AIRPORT_SOURCE_DIR) {
  throw new Error("Provide the expanded KPHX 1.75.1 package root or set KPHX_FULL_AIRPORT_SOURCE_DIR");
}

const wedPath = path.join(sourceRoot, "earth.wed.xml");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256(filePath) {
  const bytes = await fs.readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeResource(resource) {
  return resource.replaceAll("\\", "/").replace(/^\.\//, "");
}

function safeRelative(relativePath) {
  const normalized = normalizeResource(relativePath);
  if (normalized.startsWith("../") || path.isAbsolute(normalized)) {
    throw new Error(`Unsafe source resource path: ${relativePath}`);
  }
  return normalized;
}

async function readObjTextureRefs(objPath) {
  const source = await fs.readFile(objPath, "utf8");
  let diffuse = null;
  let lit = null;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("TEXTURE\t")
      || trimmed.startsWith("TEXTURE ")
      || trimmed.startsWith("TEXTURE_DRAPED\t")
      || trimmed.startsWith("TEXTURE_DRAPED ")
    ) {
      diffuse = trimmed.split(/\s+/).slice(1).join(" ");
    } else if (trimmed.startsWith("TEXTURE_LIT\t") || trimmed.startsWith("TEXTURE_LIT ")) {
      lit = trimmed.split(/\s+/).slice(1).join(" ");
    }
  }
  return { diffuse, lit };
}

async function resolveTexture(sourceDirectory, requested) {
  if (!requested || /^none$/i.test(requested)) return null;
  const relative = safeRelative(requested);
  const parsed = path.parse(relative);
  const candidates = [
    path.resolve(sourceDirectory, relative),
    path.resolve(sourceDirectory, path.join(parsed.dir, `${parsed.name}.dds`)),
    path.resolve(sourceDirectory, path.join(parsed.dir, `${parsed.name}.DDS`)),
    path.resolve(sourceDirectory, path.join(parsed.dir, `${parsed.name}.png`)),
    path.resolve(sourceDirectory, path.join(parsed.dir, `${parsed.name}.PNG`)),
  ];
  for (const candidate of [...new Set(candidates)]) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`Texture not found for ${requested} beside ${sourceDirectory}`);
}

async function identify(filePath) {
  const { stdout } = await execFile(magick, ["identify", "-format", "%w %h %[channels]", filePath], {
    maxBuffer: 4 * 1024 * 1024,
  });
  const [width, height, ...channels] = stdout.trim().split(/\s+/);
  return { width: Number(width), height: Number(height), channels: channels.join(" ") };
}

async function decodedRgbaSha256(filePath) {
  return new Promise((resolve, reject) => {
    const child = spawn(magick, [filePath, "rgba:-"], { stdio: ["ignore", "pipe", "pipe"] });
    const hash = createHash("sha256");
    let stderr = "";
    child.stdout.on("data", (chunk) => hash.update(chunk));
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`ImageMagick decode failed for ${filePath}: ${stderr.trim()}`));
      else resolve(hash.digest("hex"));
    });
  });
}

async function materializeTexture(sourcePath, requested, outputDirectory) {
  if (!sourcePath || !requested) return null;
  const outputName = `${path.parse(requested).name}.png`;
  const outputPath = path.join(outputDirectory, outputName);
  const sourceInfo = await identify(sourcePath);
  const sourceDecodedHash = await decodedRgbaSha256(sourcePath);

  if (/\.png$/i.test(sourcePath)) {
    await fs.copyFile(sourcePath, outputPath);
  } else {
    await execFile(magick, [sourcePath, "-define", "png:color-type=6", outputPath], {
      maxBuffer: 16 * 1024 * 1024,
    });
  }

  const outputInfo = await identify(outputPath);
  const outputDecodedHash = await decodedRgbaSha256(outputPath);
  if (sourceInfo.width !== outputInfo.width || sourceInfo.height !== outputInfo.height) {
    throw new Error(`Texture dimensions changed during conversion: ${sourcePath}`);
  }
  if (sourceDecodedHash !== outputDecodedHash) {
    throw new Error(`Decoded RGBA pixels changed during conversion: ${sourcePath}`);
  }

  return {
    requested,
    sourcePath: path.relative(sourceRoot, sourcePath).replaceAll("\\", "/"),
    sourceSha256: await sha256(sourcePath),
    sourceDecodedRgbaSha256: sourceDecodedHash,
    outputName,
    outputSha256: await sha256(outputPath),
    outputDecodedRgbaSha256: outputDecodedHash,
    width: outputInfo.width,
    height: outputInfo.height,
    channels: outputInfo.channels,
  };
}

async function convertObject(resource) {
  const safeResource = safeRelative(resource);

  const exactSingle = kphxExactAssetForResource(safeResource);
  if (exactSingle) {
    return {
      sourceResource: safeResource,
      recoveredExact: true,
      sourceAuthority: "verified-recovered-exact-kphx-runtime",
      sourceSha256: exactSingle.sourceSha256,
      assetUrl: exactSingle.assetUrl,
      runtimeSha256: exactSingle.runtimeSha256,
      runtimeBytes: exactSingle.runtimeBytes,
    };
  }

  const packedMeshName = kphxExactPackedMeshNameForResource(safeResource);
  if (packedMeshName) {
    const pack = KPHX_EXACT_RECOVERED_ASSETS.packedAssets.gateNumbers;
    return {
      sourceResource: safeResource,
      recoveredExact: true,
      sourceAuthority: "assets/kphx-source/exact-gate-numbers.json",
      assetUrl: pack.assetUrl,
      packedMeshName,
      runtimeSha256: pack.runtimeSha256,
      runtimeBytes: pack.runtimeBytes,
      layerGroupDraped: pack.layerGroupDraped,
    };
  }

  const sourcePath = path.join(sourceRoot, safeResource);
  if (!(await exists(sourcePath))) throw new Error(`Package-owned WED resource missing: ${safeResource}`);

  const parsed = path.parse(safeResource);
  const relativeAssetDirectory = path.join("package-owned", parsed.dir, parsed.name);
  const outputDirectory = path.join(runtimeRoot, relativeAssetDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const refs = await readObjTextureRefs(sourcePath);
  if (!refs.diffuse || /^none$/i.test(refs.diffuse)) {
    throw new Error(`OBJ8 resource has no diffuse texture: ${safeResource}`);
  }

  const sourceDirectory = path.dirname(sourcePath);
  const diffuseSource = await resolveTexture(sourceDirectory, refs.diffuse);
  const litSource = await resolveTexture(sourceDirectory, refs.lit);
  const diffuse = await materializeTexture(diffuseSource, refs.diffuse, outputDirectory);
  const lit = litSource ? await materializeTexture(litSource, refs.lit, outputDirectory) : null;

  const converterPath = path.resolve("scripts/convert-kphx-obj8-to-gltf.mjs");
  const converterArgs = [
    converterPath,
    sourcePath,
    outputDirectory,
    `--name=${parsed.name}`,
    `--diffuse=${diffuse.outputName}`,
  ];
  if (lit) converterArgs.push(`--lit=${lit.outputName}`);

  const { stdout } = await execFile(process.execPath, converterArgs, {
    maxBuffer: 16 * 1024 * 1024,
  });
  const converterResult = JSON.parse(stdout);
  const gltfPath = path.join(outputDirectory, `${parsed.name}.gltf`);
  const binPath = path.join(outputDirectory, `${parsed.name}.bin`);
  const urlDirectory = relativeAssetDirectory.split(path.sep).join("/");

  return {
    sourceResource: safeResource,
    sourceSha256: await sha256(sourcePath),
    assetUrl: `/models/kphx-full-airport/${urlDirectory}/${parsed.name}.gltf`,
    gltfSha256: await sha256(gltfPath),
    binSha256: await sha256(binPath),
    diffuse,
    lit,
    converter: converterResult,
  };
}

await fs.mkdir(runtimeRoot, { recursive: true });
await fs.mkdir(reportRoot, { recursive: true });

if (!(await exists(wedPath))) {
  throw new Error(`earth.wed.xml not found in KPHX source root: ${wedPath}`);
}

await execFile(process.execPath, [
  path.resolve("scripts/extract-kphx-wed-object-placements.mjs"),
  wedPath,
  placementReportPath,
], { maxBuffer: 16 * 1024 * 1024 });

const placementReport = JSON.parse(await fs.readFile(placementReportPath, "utf8"));
const packagePlacements = placementReport.placements.packageOwned;
const uniqueResources = [...new Set(packagePlacements.map((entry) => normalizeResource(entry.resource)))].sort();

const resources = {};
const failures = [];
for (const [index, resource] of uniqueResources.entries()) {
  try {
    resources[resource] = await convertObject(resource);
    console.log(`[${index + 1}/${uniqueResources.length}] materialized ${resource}`);
  } catch (error) {
    failures.push({
      resource,
      message: error instanceof Error ? error.message : String(error),
    });
    console.error(`[${index + 1}/${uniqueResources.length}] FAILED ${resource}: ${failures.at(-1).message}`);
  }
}

const runtimePlacements = packagePlacements
  .filter((placement) => resources[normalizeResource(placement.resource)])
  .map((placement) => ({
    ...placement,
    resource: normalizeResource(placement.resource),
    assetUrl: resources[normalizeResource(placement.resource)].assetUrl,
    packedMeshName: resources[normalizeResource(placement.resource)].packedMeshName || null,
    recoveredExact: resources[normalizeResource(placement.resource)].recoveredExact === true,
    layerGroupDraped: resources[normalizeResource(placement.resource)].layerGroupDraped || null,
  }));

const manifest = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  source: {
    package: placementReport.source.package,
    version: placementReport.source.version,
    wedSha256: await sha256(wedPath),
    masterAnchor: placementReport.masterAnchor,
  },
  policy: {
    geometry: "source positions/normals/UVs/indices preserved; no remesh or decimation",
    textures: "source texture decoded to browser PNG at original dimensions with decoded-RGBA hash equality required",
    placement: "earth.wed.xml authored lat/lon/heading; no manual placement",
    externalLibraries: "not substituted; tracked separately until exact dependencies are supplied",
  },
  packageOwned: {
    expectedPlacementCount: packagePlacements.length,
    materializedPlacementCount: runtimePlacements.length,
    expectedUniqueResourceCount: uniqueResources.length,
    materializedUniqueResourceCount: Object.keys(resources).length,
    resources,
    placements: runtimePlacements,
  },
  externalLibraries: {
    placementCount: placementReport.externalLibraries.placementCount,
    uniqueResourceCount: placementReport.externalLibraries.uniqueResourceCount,
    prefixCounts: placementReport.externalLibraries.prefixCounts,
  },
  failures,
};

await fs.writeFile(runtimeManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await fs.writeFile(materializationReportPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (failures.length) {
  throw new Error(`KPHX full-airport materialization incomplete: ${failures.length} of ${uniqueResources.length} package-owned resources failed. See ${materializationReportPath}`);
}

console.log(JSON.stringify({
  runtimeManifestPath,
  materializationReportPath,
  packageOwnedPlacements: runtimePlacements.length,
  packageOwnedUniqueResources: Object.keys(resources).length,
  externalLibraryPlacementsTracked: manifest.externalLibraries.placementCount,
  externalLibraryUniqueResourcesTracked: manifest.externalLibraries.uniqueResourceCount,
}, null, 2));
