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

const [, , sourceRootArg, runtimeRootArg, ...optionArgs] = process.argv;
const options = Object.fromEntries(optionArgs
  .filter((entry) => entry.startsWith("--") && entry.includes("="))
  .map((entry) => {
    const [key, ...value] = entry.slice(2).split("=");
    return [key, value.join("=")];
  }));
const sourceRoot = path.resolve(sourceRootArg || process.env.KPHX_FULL_AIRPORT_SOURCE_DIR || "");
const includeExternalPrefixes = new Set((options["include-external-prefixes"] || "").split(",").map((entry) => entry.trim()).filter(Boolean));
const includePackagePrefixes = new Set((options["package-prefixes"] || "").split(",").map((entry) => entry.trim()).filter(Boolean));
const batchName = options["batch-name"] || null;
const placementReportInputPath = options["placement-report"] ? path.resolve(options["placement-report"]) : null;
const libraryMapPath = options["library-map"] ? path.resolve(options["library-map"]) : null;
const libraryMapPayload = libraryMapPath ? JSON.parse(await fs.readFile(libraryMapPath, "utf8")) : null;
const libraryResourceMap = libraryMapPayload?.resources || {};
const runtimeRoot = path.resolve(runtimeRootArg || "public/models/kphx-full-airport");
const reportRoot = path.resolve("reports");
const reportSuffix = batchName ? `-${batchName}` : "";
const placementReportPath = path.join(reportRoot, `kphx-full-airport-wed-placements${reportSuffix}.json`);
const runtimeManifestPath = path.join(runtimeRoot, "manifest.json");
const materializationReportPath = path.join(reportRoot, `kphx-full-airport-materialization${reportSuffix}.json`);
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

function resolvedLibraryRoot(resolution) {
  if (!resolution?.physicalPath || !resolution?.physicalResource) return null;
  let root = path.dirname(path.resolve(resolution.physicalPath));
  const directorySegments = normalizeResource(resolution.physicalResource).split("/").slice(0, -1);
  for (let index = 0; index < directorySegments.length; index += 1) root = path.dirname(root);
  return root;
}

function safeResolvedTexturePath(sourceDirectory, requested, allowedRoot) {
  if (!requested || path.isAbsolute(requested)) throw new Error(`Unsafe source texture path: ${requested}`);
  const normalized = normalizeResource(requested);
  const resolved = path.resolve(sourceDirectory, normalized);
  const root = path.resolve(allowedRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Texture path escapes exact source root: ${requested}`);
  }
  return resolved;
}

async function readObjTextureRefs(objPath) {
  const source = await fs.readFile(objPath, "utf8");
  let diffuse = null;
  let drapedDiffuse = null;
  let lit = null;
  let normal = null;
  let normalScale = null;
  let drapedNormal = null;
  let drapedNormalScale = null;
  let weather = null;
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("TEXTURE\t") || trimmed.startsWith("TEXTURE ")) {
      diffuse = trimmed.split(/\s+/).slice(1).join(" ");
    } else if (trimmed.startsWith("TEXTURE_DRAPED\t") || trimmed.startsWith("TEXTURE_DRAPED ")) {
      drapedDiffuse = trimmed.split(/\s+/).slice(1).join(" ");
    } else if (trimmed.startsWith("TEXTURE_LIT\t") || trimmed.startsWith("TEXTURE_LIT ")) {
      lit = trimmed.split(/\s+/).slice(1).join(" ");
    } else if (
      trimmed.startsWith("TEXTURE_DRAPED_NORMAL\t")
      || trimmed.startsWith("TEXTURE_DRAPED_NORMAL ")
      || trimmed.startsWith("TEXTURE_NORMAL\t")
      || trimmed.startsWith("TEXTURE_NORMAL ")
    ) {
      const parts = trimmed.split(/\s+/);
      const maybeScale = Number(parts[1]);
      const scale = Number.isFinite(maybeScale) && parts.length >= 3 ? maybeScale : 1;
      const texture = Number.isFinite(maybeScale) && parts.length >= 3
        ? parts.slice(2).join(" ")
        : parts.slice(1).join(" ");
      if (trimmed.startsWith("TEXTURE_DRAPED_NORMAL")) {
        drapedNormalScale = scale;
        drapedNormal = texture;
      } else {
        normalScale = scale;
        normal = texture;
      }
    } else if (trimmed.startsWith("WEATHER\t") || trimmed.startsWith("WEATHER ")) {
      weather = trimmed.split(/\s+/).slice(1).join(" ");
    }
  }
  return { diffuse, drapedDiffuse, lit, normal, normalScale, drapedNormal, drapedNormalScale, weather };
}

async function resolveTexture(sourceDirectory, requested, allowedRoot) {
  if (!requested || /^none$/i.test(requested)) return null;
  const normalized = normalizeResource(requested);
  const baseCandidate = safeResolvedTexturePath(sourceDirectory, normalized, allowedRoot);
  const parsed = path.parse(baseCandidate);
  const candidates = [
    baseCandidate,
    path.join(parsed.dir, `${parsed.name}.dds`),
    path.join(parsed.dir, `${parsed.name}.DDS`),
    path.join(parsed.dir, `${parsed.name}.png`),
    path.join(parsed.dir, `${parsed.name}.PNG`),
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
  const outputName = `${path.posix.parse(String(requested).replaceAll("\\", "/")).name}.png`;
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

function sourcePathForResource(resource) {
  const safeResource = safeRelative(resource);
  const mapped = libraryResourceMap[safeResource];
  if (mapped?.physicalPath) return mapped.physicalPath;
  return path.join(sourceRoot, safeResource);
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

  const sourcePath = sourcePathForResource(safeResource);
  if (!(await exists(sourcePath))) throw new Error(`WED resource missing after exact library resolution: ${safeResource}`);

  const parsed = path.parse(safeResource);
  const resolution = libraryResourceMap[safeResource] || null;
  const mappedExternal = Boolean(resolution);
  const textureRoot = mappedExternal ? resolvedLibraryRoot(resolution) : sourceRoot;
  const relativeAssetDirectory = path.join(mappedExternal ? "external" : "package-owned", parsed.dir, parsed.name);
  const outputDirectory = path.join(runtimeRoot, relativeAssetDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const refs = await readObjTextureRefs(sourcePath);
  const hasDiffuse = Boolean(refs.diffuse && !/^none$/i.test(refs.diffuse));
  const hasDrapedDiffuse = Boolean(refs.drapedDiffuse && !/^none$/i.test(refs.drapedDiffuse));
  if (!hasDiffuse && !hasDrapedDiffuse) {
    throw new Error(`OBJ8 resource has no diffuse or draped texture: ${safeResource}`);
  }

  const sourceDirectory = path.dirname(sourcePath);
  const diffuseSource = hasDiffuse
    ? await resolveTexture(sourceDirectory, refs.diffuse, textureRoot)
    : null;
  const drapedDiffuseSource = await resolveTexture(sourceDirectory, refs.drapedDiffuse, textureRoot);
  const litSource = await resolveTexture(sourceDirectory, refs.lit, textureRoot);
  const normalSource = await resolveTexture(sourceDirectory, refs.normal, textureRoot);
  const drapedNormalSource = await resolveTexture(sourceDirectory, refs.drapedNormal, textureRoot);
  const weatherSource = await resolveTexture(sourceDirectory, refs.weather, textureRoot);
  const diffuse = diffuseSource
    ? await materializeTexture(diffuseSource, refs.diffuse, outputDirectory)
    : null;
  const drapedDiffuse = drapedDiffuseSource
    ? await materializeTexture(drapedDiffuseSource, refs.drapedDiffuse, outputDirectory)
    : null;
  const lit = litSource ? await materializeTexture(litSource, refs.lit, outputDirectory) : null;
  const normal = normalSource ? await materializeTexture(normalSource, refs.normal, outputDirectory) : null;
  const drapedNormal = drapedNormalSource
    ? await materializeTexture(drapedNormalSource, refs.drapedNormal, outputDirectory)
    : null;
  const weather = weatherSource ? await materializeTexture(weatherSource, refs.weather, outputDirectory) : null;

  const converterPath = path.resolve("scripts/convert-kphx-obj8-to-gltf.mjs");
  const converterArgs = [
    converterPath,
    sourcePath,
    outputDirectory,
    `--name=${parsed.name}`,
  ];
  if (diffuse) converterArgs.push(`--diffuse=${diffuse.outputName}`);
  if (drapedDiffuse) converterArgs.push(`--draped-diffuse=${drapedDiffuse.outputName}`);
  if (lit) converterArgs.push(`--lit=${lit.outputName}`);
  if (normal) converterArgs.push(`--normal=${normal.outputName}`);
  if (normal && Number.isFinite(refs.normalScale)) converterArgs.push(`--normal-scale=${refs.normalScale}`);
  if (drapedNormal) converterArgs.push(`--draped-normal=${drapedNormal.outputName}`);
  if (drapedNormal && Number.isFinite(refs.drapedNormalScale)) converterArgs.push(`--draped-normal-scale=${refs.drapedNormalScale}`);
  if (weather) converterArgs.push(`--weather=${weather.outputName}`);

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
    drapedDiffuse,
    lit,
    normal,
    drapedNormal,
    weather,
    converter: converterResult,
  };
}

await fs.mkdir(runtimeRoot, { recursive: true });
await fs.mkdir(reportRoot, { recursive: true });

let placementReportReadPath = placementReportInputPath;
if (!placementReportReadPath) {
  if (!(await exists(wedPath))) {
    throw new Error(`earth.wed.xml not found in KPHX source root: ${wedPath}`);
  }
  await execFile(process.execPath, [
    path.resolve("scripts/extract-kphx-wed-object-placements.mjs"),
    wedPath,
    placementReportPath,
  ], { maxBuffer: 16 * 1024 * 1024 });
  placementReportReadPath = placementReportPath;
}
if (!(await exists(placementReportReadPath))) {
  throw new Error(`KPHX WED placement report not found: ${placementReportReadPath}`);
}
const placementReport = JSON.parse(await fs.readFile(placementReportReadPath, "utf8"));
const allPackagePlacements = placementReport.placements.packageOwned;
const packagePlacements = allPackagePlacements.filter((entry) => (
  includePackagePrefixes.size === 0 || includePackagePrefixes.has(entry.resourcePrefix)
));
const externalPlacements = placementReport.placements.externalLibraries
  .filter((entry) => includeExternalPrefixes.has(entry.resourcePrefix));
const selectedPlacements = [...packagePlacements, ...externalPlacements];
const packageUniqueResources = [...new Set(packagePlacements.map((entry) => normalizeResource(entry.resource)))].sort();
const externalUniqueResources = [...new Set(externalPlacements.map((entry) => normalizeResource(entry.resource)))].sort();
const uniqueResources = [...new Set(selectedPlacements.map((entry) => normalizeResource(entry.resource)))].sort();

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

const runtimePlacement = (placement) => ({
    ...placement,
    resource: normalizeResource(placement.resource),
    assetUrl: resources[normalizeResource(placement.resource)].assetUrl,
    packedMeshName: resources[normalizeResource(placement.resource)].packedMeshName || null,
    recoveredExact: resources[normalizeResource(placement.resource)].recoveredExact === true,
    layerGroupDraped: resources[normalizeResource(placement.resource)].layerGroupDraped || null,
  });
const runtimePlacements = packagePlacements
  .filter((placement) => resources[normalizeResource(placement.resource)])
  .map(runtimePlacement);
const runtimeExternalPlacements = externalPlacements
  .filter((placement) => resources[normalizeResource(placement.resource)])
  .map(runtimePlacement);

/* legacy map body removed */
const _unusedLegacyPlacementMap = null;
/*
*/

const manifest = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  source: {
    package: placementReport.source.package,
    version: placementReport.source.version,
    wedSha256: placementReport.source?.wedSha256
      || ((await exists(wedPath)) ? await sha256(wedPath) : null),
    masterAnchor: placementReport.masterAnchor,
  },
  policy: {
    geometry: "source positions/normals/UVs/indices preserved; no remesh or decimation",
    textures: "source texture decoded to browser PNG at original dimensions with decoded-RGBA hash equality required",
    placement: "earth.wed.xml authored lat/lon/heading; no manual placement",
    packageBatch: batchName,
    packagePrefixes: [...includePackagePrefixes],
    externalLibraries: "only explicitly resolved library resources are materialized; unresolved virtual paths are never substituted",
    libraryMap: libraryMapPath,
    placementReport: placementReportReadPath,
  },
  packageOwned: {
    totalSourcePlacementCount: allPackagePlacements.length,
    expectedPlacementCount: packagePlacements.length,
    materializedPlacementCount: runtimePlacements.length,
    expectedUniqueResourceCount: packageUniqueResources.length,
    materializedUniqueResourceCount: packageUniqueResources.filter((resource) => resources[resource]).length,
    resources,
    placements: runtimePlacements,
  },
  resolvedExternal: {
    prefixes: [...includeExternalPrefixes],
    materializedPlacementCount: runtimeExternalPlacements.length,
    expectedUniqueResourceCount: externalUniqueResources.length,
    materializedUniqueResourceCount: externalUniqueResources.filter((resource) => resources[resource]).length,
    placements: runtimeExternalPlacements,
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
  throw new Error(`KPHX full-airport materialization incomplete: ${failures.length} of ${uniqueResources.length} selected WED resources failed. See ${materializationReportPath}`);
}

console.log(JSON.stringify({
  runtimeManifestPath,
  materializationReportPath,
  batchName,
  packagePrefixes: [...includePackagePrefixes],
  packageOwnedPlacements: runtimePlacements.length,
  packageOwnedUniqueResources: packageUniqueResources.filter((resource) => resources[resource]).length,
  resolvedExternalUniqueResources: externalUniqueResources.filter((resource) => resources[resource]).length,
  resolvedExternalPlacements: runtimeExternalPlacements.length,
  resolvedExternalPrefixes: [...includeExternalPrefixes],
  externalLibraryPlacementsTracked: manifest.externalLibraries.placementCount,
  externalLibraryUniqueResourcesTracked: manifest.externalLibraries.uniqueResourceCount,
}, null, 2));
