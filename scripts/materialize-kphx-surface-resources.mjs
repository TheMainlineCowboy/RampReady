import { createHash } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

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
const skipPackageOwned = options["skip-package-owned"] === "true";
const placementReportInputPath = options["placement-report"] ? path.resolve(options["placement-report"]) : null;
const libraryMapPath = options["library-map"] ? path.resolve(options["library-map"]) : null;
const libraryMapPayload = libraryMapPath ? JSON.parse(await fs.readFile(libraryMapPath, "utf8")) : null;
const libraryResourceMap = libraryMapPayload?.resources || {};
const runtimeRoot = path.resolve(runtimeRootArg || "public/models/kphx-full-airport/surfaces");
const publicRoot = path.resolve("public");
const runtimeBaseUrl = `/${path.relative(publicRoot, runtimeRoot).replaceAll("\\", "/")}`;
const reportPath = path.resolve("reports/kphx-wed-surface-network.json");
const manifestPath = path.join(runtimeRoot, "manifest.json");
const networkOutputPath = path.join(runtimeRoot, "surface-network.json");
const magick = process.env.KPHX_MAGICK_BIN || "magick";

if (!sourceRootArg && !process.env.KPHX_FULL_AIRPORT_SOURCE_DIR) {
  throw new Error("Provide the expanded KPHX 1.75.1 package root or set KPHX_FULL_AIRPORT_SOURCE_DIR");
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => run()));
  return results;
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function sha256(filePath) {
  return createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

function normalizeResource(value = "") {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function safeRelative(value) {
  const normalized = normalizeResource(value);
  if (path.isAbsolute(normalized) || normalized.startsWith("../")) {
    throw new Error(`Unsafe package resource path: ${value}`);
  }
  return normalized;
}

function resolvedLibraryRoot(resource) {
  const mapped = libraryResourceMap[normalizeResource(resource)];
  if (!mapped?.physicalPath || !mapped?.physicalResource) return null;
  let root = path.dirname(path.resolve(mapped.physicalPath));
  const directorySegments = normalizeResource(mapped.physicalResource).split("/").slice(0, -1);
  for (let index = 0; index < directorySegments.length; index += 1) root = path.dirname(root);
  return root;
}

function safeResolvedImagePath(parentDirectory, requested, allowedRoot) {
  if (!requested || path.isAbsolute(requested)) throw new Error(`Unsafe surface image path: ${requested}`);
  const resolved = path.resolve(parentDirectory, normalizeResource(requested));
  const root = path.resolve(allowedRoot);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Surface image path escapes exact source root: ${requested}`);
  }
  return resolved;
}

async function identify(filePath) {
  const { stdout } = await execFile(magick, ["identify", "-format", "%w %h %[channels]", filePath], { maxBuffer: 4 * 1024 * 1024 });
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
      if (code) reject(new Error(`ImageMagick decode failed for ${filePath}: ${stderr.trim()}`));
      else resolve(hash.digest("hex"));
    });
  });
}

async function resolveImage(parentDirectory, requested, allowedRoot = sourceRoot) {
  if (!requested || /^none$/i.test(requested)) return null;
  const baseCandidate = safeResolvedImagePath(parentDirectory, requested, allowedRoot);
  const parsed = path.parse(baseCandidate);
  const candidates = [
    baseCandidate,
    path.join(parsed.dir, `${parsed.name}.dds`),
    path.join(parsed.dir, `${parsed.name}.DDS`),
    path.join(parsed.dir, `${parsed.name}.png`),
    path.join(parsed.dir, `${parsed.name}.PNG`),
  ];
  for (const candidate of [...new Set(candidates)]) if (await exists(candidate)) return candidate;
  throw new Error(`Referenced image not found: ${requested} relative to ${parentDirectory}`);
}

async function materializeImage(sourcePath, requested, outputDirectory) {
  if (!sourcePath) return null;
  const outputName = `${path.parse(requested || sourcePath).name}.png`;
  const outputPath = path.join(outputDirectory, outputName);
  const sourceInfo = await identify(sourcePath);
  const sourceDecoded = await decodedRgbaSha256(sourcePath);

  if (/\.png$/i.test(sourcePath)) await fs.copyFile(sourcePath, outputPath);
  else await execFile(magick, [sourcePath, "-define", "png:color-type=6", outputPath], { maxBuffer: 16 * 1024 * 1024 });

  const outputInfo = await identify(outputPath);
  const outputDecoded = await decodedRgbaSha256(outputPath);
  if (sourceInfo.width !== outputInfo.width || sourceInfo.height !== outputInfo.height) {
    throw new Error(`Texture dimensions changed: ${sourcePath}`);
  }
  if (sourceDecoded !== outputDecoded) {
    throw new Error(`Decoded RGBA pixels changed: ${sourcePath}`);
  }

  return {
    requested,
    sourcePath: path.relative(sourceRoot, sourcePath).replaceAll("\\", "/"),
    sourceSha256: await sha256(sourcePath),
    sourceDecodedRgbaSha256: sourceDecoded,
    outputName,
    outputUrl: outputName,
    outputSha256: await sha256(outputPath),
    outputDecodedRgbaSha256: outputDecoded,
    width: outputInfo.width,
    height: outputInfo.height,
  };
}

function tokenize(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^-+$/.test(line))
    .map((line) => ({ raw: line, parts: line.split(/\s+/) }));
}

function parseLayer(parts) {
  if (parts.length < 3) return null;
  const a = parts[1];
  const b = parts[2];
  if (/^[+-]?\d+$/.test(a)) return { group: b, offset: Number(a) };
  return { group: a, offset: Number(b) };
}

function parsePol(source, sourceResource) {
  const commands = tokenize(source);
  const parsed = {
    kind: "DRAPED_POLYGON",
    sourceResource,
    texture: null,
    textureLit: null,
    textureNormal: null,
    normalScale: null,
    scaleMeters: null,
    layerGroup: null,
    surface: null,
    noAlpha: false,
    globalSpecular: null,
    weather: null,
    weatherTransparent: false,
    decalLib: null,
    unsupported: [],
  };
  for (const { raw, parts } of commands.slice(3)) {
    const command = parts[0];
    if (command === "TEXTURE" || command === "TEXTURE_NOWRAP") parsed.texture = parts.slice(1).join(" ");
    else if (command === "TEXTURE_LIT" || command === "TEXTURE_LIT_NOWRAP") parsed.textureLit = parts.slice(1).join(" ");
    else if (command === "TEXTURE_NORMAL") {
      parsed.normalScale = Number(parts[1]);
      parsed.textureNormal = parts.slice(2).join(" ");
    } else if (command === "SCALE") parsed.scaleMeters = [Number(parts[1]), Number(parts[2])];
    else if (command === "LAYER_GROUP") parsed.layerGroup = parseLayer(parts);
    else if (command === "SURFACE") parsed.surface = parts[1] || null;
    else if (command === "NO_ALPHA") parsed.noAlpha = true;
    else if (command === "GLOBAL_specular" || command === "SPECULAR") parsed.globalSpecular = Number(parts[1]);
    else if (command === "WEATHER") parsed.weather = parts.slice(1).join(" ");
    else if (command === "WEATHER_TRANSPARENT") parsed.weatherTransparent = true;
    else if (command === "DECAL_LIB") parsed.decalLib = parts.slice(1).join(" ");
    else if (!["A", "850", "DRAPED_POLYGON"].includes(command)) parsed.unsupported.push(raw);
  }
  if (!parsed.texture) throw new Error(`POL missing required texture: ${sourceResource}`);
  return parsed;
}

function parseLin(source, sourceResource) {
  const commands = tokenize(source);
  const parsed = {
    kind: "LINE_PAINT",
    sourceResource,
    texture: null,
    scaleMeters: null,
    textureWidth: null,
    textureHeight: null,
    textureNormal: null,
    normalScale: null,
    weather: null,
    globalSpecular: null,
    layerGroup: null,
    lodMeters: null,
    mirror: false,
    weatherTransparent: false,
    sOffsets: [],
    unsupported: [],
  };
  for (const { raw, parts } of commands.slice(3)) {
    const command = parts[0];
    if (command === "TEXTURE") parsed.texture = parts.slice(1).join(" ");
    else if (command === "TEXTURE_NORMAL") {
      parsed.normalScale = Number(parts[1]);
      parsed.textureNormal = parts.slice(2).join(" ");
    }
    else if (command === "WEATHER") parsed.weather = parts.slice(1).join(" ");
    else if (command === "GLOBAL_specular" || command === "SPECULAR") parsed.globalSpecular = Number(parts[1]);
    else if (command === "SCALE") parsed.scaleMeters = [Number(parts[1]), Number(parts[2])];
    else if (command === "TEX_WIDTH") parsed.textureWidth = Number(parts[1]);
    else if (command === "TEX_HEIGHT") parsed.textureHeight = Number(parts[1]);
    else if (command === "LAYER_GROUP") parsed.layerGroup = parseLayer(parts);
    else if (command === "LOD") parsed.lodMeters = Number(parts[1]);
    else if (command === "MIRROR") parsed.mirror = true;
    else if (command === "WEATHER_TRANSPARENT") parsed.weatherTransparent = true;
    else if (command === "S_OFFSET") parsed.sOffsets.push({
      layer: Number(parts[1]),
      left: Number(parts[2]),
      center: Number(parts[3]),
      right: Number(parts[4]),
    });
    else if (!["A", "850", "LINE_PAINT"].includes(command)) parsed.unsupported.push(raw);
  }
  if (!parsed.texture || !parsed.scaleMeters || !parsed.textureWidth || !parsed.sOffsets.length) {
    throw new Error(`LIN missing required texture/scale/offset fields: ${sourceResource}`);
  }
  return parsed;
}

function parseDcl(source, sourceResource) {
  const commands = tokenize(source);
  const decals = [];
  const unsupported = [];
  for (const { raw, parts } of commands.slice(3)) {
    if (parts[0] === "DECAL_PARAMS") {
      if (parts.length < 16) throw new Error(`Malformed DECAL_PARAMS in ${sourceResource}: ${raw}`);
      decals.push({
        type: "DECAL_PARAMS",
        scaleRatio: Number(parts[1]),
        dither: Number(parts[2]),
        rgbKey: parts.slice(3, 9).map(Number),
        alphaKey: parts.slice(9, 15).map(Number),
        texture: parts.slice(15).join(" "),
      });
    } else if (!["A", "1000", "DECAL"].includes(parts[0])) unsupported.push(raw);
  }
  return { kind: "DECAL", sourceResource, decals, unsupported };
}

async function materializeDcl(resourcePath, outputDirectory, allowedRoot = sourceRoot) {
  const source = await fs.readFile(resourcePath, "utf8");
  const parsed = parseDcl(source, path.relative(sourceRoot, resourcePath).replaceAll("\\", "/"));
  const parent = path.dirname(resourcePath);
  const decals = [];
  for (const decal of parsed.decals) {
    const sourceImage = await resolveImage(parent, decal.texture, allowedRoot);
    decals.push({ ...decal, image: await materializeImage(sourceImage, decal.texture, outputDirectory) });
  }
  return { ...parsed, decals, sourceSha256: await sha256(resourcePath) };
}

function sourcePathForResource(resource) {
  const safeResource = safeRelative(resource);
  const mapped = libraryResourceMap[safeResource];
  if (mapped?.physicalPath) return mapped.physicalPath;
  return path.join(sourceRoot, safeResource);
}

async function materializeArtResource(resource) {
  const safeResource = safeRelative(resource);
  const sourcePath = sourcePathForResource(safeResource);
  if (!(await exists(sourcePath))) throw new Error(`Surface art resource missing: ${safeResource}`);
  const extension = path.extname(safeResource).toLowerCase();
  if (![".pol", ".lin"].includes(extension)) throw new Error(`Unsupported surface resource extension: ${safeResource}`);

  const relativeOutputDirectory = path.join("resources", path.dirname(safeResource), path.basename(safeResource, extension));
  const outputDirectory = path.join(runtimeRoot, relativeOutputDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });
  const source = await fs.readFile(sourcePath, "utf8");
  const parsed = extension === ".pol" ? parsePol(source, safeResource) : parseLin(source, safeResource);
  if (parsed.unsupported.length) throw new Error(`Unsupported ${extension} commands in ${safeResource}: ${parsed.unsupported.join(" | ")}`);

  const parent = path.dirname(sourcePath);
  const allowedRoot = resolvedLibraryRoot(safeResource) || sourceRoot;
  const texture = await materializeImage(await resolveImage(parent, parsed.texture, allowedRoot), parsed.texture, outputDirectory);
  let lit = null;
  let normal = null;
  let weather = null;
  let decal = null;

  if (parsed.textureLit) lit = await materializeImage(await resolveImage(parent, parsed.textureLit, allowedRoot), parsed.textureLit, outputDirectory);
  if (parsed.textureNormal) normal = await materializeImage(await resolveImage(parent, parsed.textureNormal, allowedRoot), parsed.textureNormal, outputDirectory);
  if (parsed.weather) weather = await materializeImage(await resolveImage(parent, parsed.weather, allowedRoot), parsed.weather, outputDirectory);
  if (parsed.decalLib) {
    const decalPath = safeResolvedImagePath(parent, parsed.decalLib, allowedRoot);
    if (!(await exists(decalPath))) throw new Error(`Local DECAL_LIB resource missing: ${parsed.decalLib}`);
    decal = await materializeDcl(decalPath, outputDirectory, allowedRoot);
  }

  const runtime = {
    ...parsed,
    sourceSha256: await sha256(sourcePath),
    outputBaseUrl: `${runtimeBaseUrl}/${relativeOutputDirectory.split(path.sep).join("/")}`,
    texture,
    lit,
    normal,
    weather,
    decal,
  };
  await fs.writeFile(path.join(outputDirectory, "resource.json"), `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
  return runtime;
}

await fs.mkdir(runtimeRoot, { recursive: true });
await fs.mkdir(path.dirname(reportPath), { recursive: true });

const wedPath = path.join(sourceRoot, "earth.wed.xml");
let networkReadPath = placementReportInputPath;
if (!networkReadPath) {
  if (!(await exists(wedPath))) throw new Error(`earth.wed.xml missing: ${wedPath}`);
  await execFile(process.execPath, [
    path.resolve("scripts/extract-kphx-wed-surface-network.mjs"),
    wedPath,
    reportPath,
  ], { maxBuffer: 64 * 1024 * 1024 });
  networkReadPath = reportPath;
}
if (!(await exists(networkReadPath))) throw new Error(`KPHX surface placement report missing: ${networkReadPath}`);
const network = JSON.parse(await fs.readFile(networkReadPath, "utf8"));
const packageRecords = skipPackageOwned ? [] : [
  ...network.polygons.filter((entry) => entry.sourceClass === "package-owned"),
  ...network.lines.filter((entry) => entry.sourceClass === "package-owned"),
];
const externalRecords = [
  ...network.polygons,
  ...network.lines,
  ...network.drapedOrthophotos,
].filter((entry) => entry.sourceClass === "external-library" && includeExternalPrefixes.has(entry.resourcePrefix));
const records = [...packageRecords, ...externalRecords];
const packageResources = [...new Set(packageRecords.map((entry) => normalizeResource(entry.resource)))].sort();
const externalResources = [...new Set(externalRecords.map((entry) => normalizeResource(entry.resource)))].sort();
const resources = [...new Set(records.map((entry) => normalizeResource(entry.resource)))].sort();

const materialized = {};
const failures = [];
const materializeConcurrency = Number(options["concurrency"] || 1);
await mapWithConcurrency(resources, materializeConcurrency, async (resource, index) => {
  try {
    materialized[resource] = await materializeArtResource(resource);
    console.log(`[${index + 1}/${resources.length}] surface resource ${resource}`);
  } catch (error) {
    const failure = { resource, message: error instanceof Error ? error.message : String(error) };
    failures.push(failure);
    console.error(`[${index + 1}/${resources.length}] FAILED ${resource}: ${failure.message}`);
  }
});

const manifest = {
  schemaVersion: 1,
  generatedAtUtc: new Date().toISOString(),
  source: {
    package: network.source.package,
    version: network.source.version,
    wedSha256: (await exists(wedPath)) ? await sha256(wedPath) : null,
  },
  policy: {
    polygons: "WED-authored rings and Bezier controls; POL texture scale/heading/layer authority",
    lines: "WED-authored chains and Bezier controls; LIN TEX_WIDTH/SCALE/S_OFFSET width and UV authority",
    textures: "browser PNG generated only when decoded RGBA bytes equal source image at original dimensions",
    unsupportedCommands: "fail materialization rather than silently approximate",
    externalResources: "only explicitly resolved library resources are materialized; unresolved virtual resources are never substituted",
    libraryMap: libraryMapPath,
    placementReport: networkReadPath,
    externalPrefixes: [...includeExternalPrefixes],
    skipPackageOwned,
    materializeConcurrency,
  },
  packageOwnedResourceCount: packageResources.length,
  materializedResourceCount: packageResources.filter((resource) => materialized[resource]).length,
  resolvedExternalResourceCount: externalResources.filter((resource) => materialized[resource]).length,
  expectedResolvedExternalResourceCount: externalResources.length,
  resources: materialized,
  failures,
};

await fs.copyFile(networkReadPath, networkOutputPath);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

if (failures.length) throw new Error(`KPHX surface materialization failed for ${failures.length}/${resources.length} resources`);
console.log(JSON.stringify({
  manifestPath,
  networkOutputPath,
  packageOwnedResourceCount: packageResources.length,
  resolvedExternalResourceCount: externalResources.filter((resource) => materialized[resource]).length,
  polygonPlacementCount: network.polygons.filter((entry) => entry.sourceClass === "package-owned").length,
  linePlacementCount: network.lines.filter((entry) => entry.sourceClass === "package-owned").length,
  resolvedExternalPrefixes: [...includeExternalPrefixes],
  resolvedDrapedOrthophotoPlacements: network.drapedOrthophotos.filter((entry) => includeExternalPrefixes.has(entry.resourcePrefix)).length,
}, null, 2));
