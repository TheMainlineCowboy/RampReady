import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const EXACT_DIR = "source-assets/kphx-exact-terminal4";
const exactManifestPath = path.join(EXACT_DIR, "manifest.json");
if (!fs.existsSync(exactManifestPath)) throw new Error("Recovered exact KPHX texture manifest is missing");
const exactManifest = JSON.parse(fs.readFileSync(exactManifestPath, "utf8"));
if (exactManifest.exactRecoveredFileCount !== 10) throw new Error(`Expected 10 exact KPHX files, found ${exactManifest.exactRecoveredFileCount}`);
const recoveredByTarget = new Map(exactManifest.recovered.map((entry) => [entry.target, entry]));
for (const entry of exactManifest.recovered) {
  const filePath = path.join(EXACT_DIR, entry.target);
  if (!fs.existsSync(filePath)) throw new Error(`Recovered exact KPHX file is missing: ${entry.target}`);
  const bytes = fs.readFileSync(filePath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.length !== entry.bytes || hash !== entry.sha256) throw new Error(`Recovered exact KPHX identity drifted: ${entry.target}`);
}

function replaceOnce(source, oldText, newText, marker, label) {
  if (source.includes(marker)) return source;
  if (!source.includes(oldText)) throw new Error(`${label} anchor is missing for ${marker}`);
  return source.replace(oldText, newText);
}

const exactDiffuse = Object.freeze({
  "PARKRAMPS2.BMP": recoveredByTarget.get("PARKRAMPS2.BMP"),
  "PHX_TERM400_0.DDS": recoveredByTarget.get("PHX_TERM400_0.DDS"),
  "PHX_TERM400_1.DDS": recoveredByTarget.get("PHX_TERM400_1.DDS"),
  "PHXRAMPLIGHT.BMP": recoveredByTarget.get("PHXRAMPLIGHT.BMP"),
});
const exactLightmaps = Object.freeze({
  "PARKRAMPS2.BMP": recoveredByTarget.get("PARKRAMPS2_LM.BMP"),
  "PHX_TERM400_0.DDS": recoveredByTarget.get("PHX_TERM400_0_LM.DDS"),
  "PHX_TERM400_1.DDS": recoveredByTarget.get("PHX_TERM400_1_LM.DDS"),
  "PHXRAMPLIGHT.BMP": recoveredByTarget.get("PHXRAMPLIGHT_LM.BMP"),
});
for (const [reference, entry] of [...Object.entries(exactDiffuse), ...Object.entries(exactLightmaps)]) {
  if (!entry) throw new Error(`Recovered exact KPHX mapping is missing for ${reference}`);
}

const diffusePath = "scripts/materialize-phx-terminal4.mjs";
let diffuse = fs.readFileSync(diffusePath, "utf8");
diffuse = replaceOnce(
  diffuse,
  'const CACHE_DIR = path.resolve(".cache/phx-terminal4-source");',
  'const CACHE_DIR = path.resolve(".cache/phx-terminal4-source");\nconst EXACT_TEXTURE_DIR = path.resolve("source-assets/kphx-exact-terminal4");',
  "EXACT_TEXTURE_DIR",
  "Terminal 4 exact diffuse directory",
);
for (const [reference, entry] of Object.entries(exactDiffuse)) {
  const historical = {
    "PARKRAMPS2.BMP": '  "PARKRAMPS2.BMP": { sourcePath: "parkramps.bmp", fidelity: "authored-source-fallback" },',
    "PHX_TERM400_0.DDS": '  "PHX_TERM400_0.DDS": { sourcePath: "bgate1.bmp", fidelity: "authored-source-fallback" },',
    "PHX_TERM400_1.DDS": '  "PHX_TERM400_1.DDS": { sourcePath: "bgate3.bmp", fidelity: "authored-source-fallback" },',
    "PHXRAMPLIGHT.BMP": '  "PHXRAMPLIGHT.BMP": { sourcePath: "supports2.bmp", fidelity: "authored-source-fallback" },',
  }[reference];
  const exactLine = `  "${reference}": { localFile: "${entry.target}", sourcePath: "${entry.archiveEntry}", expectedSha256: "${entry.sha256}", fidelity: "exact-recovered-original-freeware" },`;
  if (!diffuse.includes(exactLine)) {
    if (!diffuse.includes(historical)) throw new Error(`Terminal 4 fallback mapping anchor is missing for ${reference}`);
    diffuse = diffuse.replace(historical, exactLine);
  }
}
const ddsDecoder = `function decodeDdsDxt1(bytes) {
  if (bytes.length < 128 || bytes.toString("ascii", 0, 4) !== "DDS ") throw new Error("Texture is not a DDS file");
  if (bytes.readUInt32LE(4) !== 124) throw new Error(\`Unexpected DDS header size \${bytes.readUInt32LE(4)}\`);
  const height = bytes.readUInt32LE(12);
  const width = bytes.readUInt32LE(16);
  const fourCc = bytes.toString("ascii", 84, 88);
  if (fourCc !== "DXT1") throw new Error(\`Unsupported DDS compression \${fourCc}\`);
  if (!(width > 0 && height > 0)) throw new Error(\`Invalid DDS dimensions \${width} x \${height}\`);
  return { width, height, rgba: decodeDxt1Bmp(bytes, width, height, 128, false), compression: "DDS-DXT1" };
}

function decodeSourceTexture(bytes) {
  const magic = bytes.toString("ascii", 0, 4);
  if (magic.startsWith("BM")) return decodeLegacyBmp(bytes);
  if (magic === "DDS ") return decodeDdsDxt1(bytes);
  throw new Error(\`Unsupported exact Terminal 4 texture magic \${magic}\`);
}
`;
diffuse = replaceOnce(
  diffuse,
  'const CRC_TABLE = (() => {',
  `${ddsDecoder}\nconst CRC_TABLE = (() => {`,
  "function decodeDdsDxt1",
  "Terminal 4 DDS decoder",
);
const oldDiffuseLoad = `  const mapping = TEXTURE_SOURCES[reference];
  let sourceBytes = sourceCache.get(mapping.sourcePath);
  if (!sourceBytes) {
    sourceBytes = await download(\`${"${SOURCE_ROOT}"}/${"${mapping.sourcePath}"}\`);
    sourceCache.set(mapping.sourcePath, sourceBytes);
  }
  const decoded = decodeLegacyBmp(sourceBytes);`;
const newDiffuseLoad = `  const mapping = TEXTURE_SOURCES[reference];
  const sourceIdentity = mapping.localFile ? \`local:${"${mapping.localFile}"}\` : \`pinned:${"${mapping.sourcePath}"}\`;
  let sourceBytes = sourceCache.get(sourceIdentity);
  if (!sourceBytes) {
    sourceBytes = mapping.localFile
      ? await readFile(path.join(EXACT_TEXTURE_DIR, mapping.localFile))
      : await download(\`${"${SOURCE_ROOT}"}/${"${mapping.sourcePath}"}\`);
    if (mapping.expectedSha256 && sha256(sourceBytes) !== mapping.expectedSha256) {
      throw new Error(\`Exact recovered Terminal 4 texture identity mismatch for ${"${mapping.localFile}"}\`);
    }
    sourceCache.set(sourceIdentity, sourceBytes);
  }
  const decoded = decodeSourceTexture(sourceBytes);`;
diffuse = replaceOnce(diffuse, oldDiffuseLoad, newDiffuseLoad, "const sourceIdentity = mapping.localFile", "Terminal 4 exact diffuse loader");
if (!diffuse.includes('sourceOrigin: mapping.localFile ? "exact-recovered-original-freeware-archive"')) {
  diffuse = diffuse.replace(
    '    sourcePath: mapping.sourcePath,',
    '    sourcePath: mapping.sourcePath,\n    sourceOrigin: mapping.localFile ? "exact-recovered-original-freeware-archive" : "pinned-skyharbor-source-repository",',
  );
}
diffuse = diffuse.replace('  textureStatus: "pinned-authored-source-textures-active",', '  textureStatus: "all-exact-source-textures-active-no-fallbacks",\n  exactRecoveredArchiveSha256: "0cc4d2eac2249f4b477b9d1cb273b845b9dab08a17d60aa53f9c16d76f0861f5",');
diffuse = diffuse.replace('console.log(`RampReady real PHX Terminal 4 materialized: ${EXPECTED.triangleCount} triangles, ${EXPECTED.partCount} parts, ${exactTextureCount} exact and ${fallbackTextureCount} source-authored fallback textures.`);', 'if (fallbackTextureCount !== 0) throw new Error(`Terminal 4 still has ${fallbackTextureCount} fallback textures`);\nconsole.log(`RampReady real PHX Terminal 4 materialized: ${EXPECTED.triangleCount} triangles, ${EXPECTED.partCount} parts, ${exactTextureCount} exact textures and zero fallbacks.`);');
for (const token of [
  "EXACT_TEXTURE_DIR",
  'fidelity: "exact-recovered-original-freeware"',
  "function decodeDdsDxt1",
  "function decodeSourceTexture",
  "decodeSourceTexture(sourceBytes)",
  'sourceOrigin: mapping.localFile ? "exact-recovered-original-freeware-archive"',
  'textureStatus: "all-exact-source-textures-active-no-fallbacks"',
  "fallbackTextureCount !== 0",
]) if (!diffuse.includes(token)) throw new Error(`Prepared Terminal 4 exact diffuse materializer is missing ${token}`);
for (const forbidden of [
  '"PARKRAMPS2.BMP": { sourcePath: "parkramps.bmp"',
  '"PHX_TERM400_0.DDS": { sourcePath: "bgate1.bmp"',
  '"PHX_TERM400_1.DDS": { sourcePath: "bgate3.bmp"',
  '"PHXRAMPLIGHT.BMP": { sourcePath: "supports2.bmp"',
  'fidelity: "authored-source-fallback"',
]) if (diffuse.includes(forbidden)) throw new Error(`Counterfeit Terminal 4 fallback remains: ${forbidden}`);
fs.writeFileSync(diffusePath, diffuse, "utf8");

const lightmapPath = "scripts/materialize-phx-terminal4-lightmaps.mjs";
let lightmaps = fs.readFileSync(lightmapPath, "utf8");
lightmaps = replaceOnce(
  lightmaps,
  'const RUNTIME_MANIFEST_PATH = path.join(OUTPUT_DIR, "runtime-manifest.json");',
  'const RUNTIME_MANIFEST_PATH = path.join(OUTPUT_DIR, "runtime-manifest.json");\nconst EXACT_TEXTURE_DIR = path.resolve("source-assets/kphx-exact-terminal4");',
  "EXACT_TEXTURE_DIR",
  "Terminal 4 exact lightmap directory",
);
const recoveredLightmapBlock = `const EXACT_RECOVERED_LIGHTMAP_SOURCES = Object.freeze({
${Object.entries(exactLightmaps).map(([reference, entry]) => `  "${reference}": { localFile: "${entry.target}", sourcePath: "${entry.archiveEntry}", expectedSha256: "${entry.sha256}" },`).join("\n")}
});
`;
lightmaps = replaceOnce(
  lightmaps,
  'const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");',
  `${recoveredLightmapBlock}\nconst sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");`,
  "EXACT_RECOVERED_LIGHTMAP_SOURCES",
  "Terminal 4 recovered lightmap mapping",
);
lightmaps = replaceOnce(
  lightmaps,
  'const CRC_TABLE = (() => {',
  `${ddsDecoder}\nconst CRC_TABLE = (() => {`,
  "function decodeDdsDxt1",
  "Terminal 4 lightmap DDS decoder",
);
const oldLightmapLoop = `let emitted = 0;
for (const [reference, sourcePath] of Object.entries(EXACT_LIGHTMAP_SOURCES)) {
  const material = manifest.materials[reference];
  if (!material) throw new Error(\`Terminal 4 exact lightmap target is absent from the diffuse manifest: ${"${reference}"}\`);
  const sourceBytes = await download(sourcePath);
  const decoded = decodeLegacyBmp(sourceBytes);`;
const newLightmapLoop = `const lightmapSources = [
  ...Object.entries(EXACT_LIGHTMAP_SOURCES).map(([reference, sourcePath]) => [reference, { sourcePath }]),
  ...Object.entries(EXACT_RECOVERED_LIGHTMAP_SOURCES),
];
let emitted = 0;
for (const [reference, mapping] of lightmapSources) {
  const material = manifest.materials[reference];
  if (!material) throw new Error(\`Terminal 4 exact lightmap target is absent from the diffuse manifest: ${"${reference}"}\`);
  const sourceBytes = mapping.localFile
    ? await readFile(path.join(EXACT_TEXTURE_DIR, mapping.localFile))
    : await download(mapping.sourcePath);
  if (mapping.expectedSha256 && sha256(sourceBytes) !== mapping.expectedSha256) {
    throw new Error(\`Exact recovered Terminal 4 lightmap identity mismatch for ${"${mapping.localFile}"}\`);
  }
  const decoded = decodeSourceTexture(sourceBytes);
  const sourcePath = mapping.sourcePath;`;
lightmaps = replaceOnce(lightmaps, oldLightmapLoop, newLightmapLoop, "const lightmapSources = [", "Terminal 4 exact lightmap loader");
lightmaps = lightmaps.replace('if (emitted !== Object.keys(EXACT_LIGHTMAP_SOURCES).length) throw new Error(`Terminal 4 exact lightmap count drifted: ${emitted}`);', 'if (emitted !== lightmapSources.length || emitted !== 15) throw new Error(`Terminal 4 exact lightmap count drifted: ${emitted}`);');
lightmaps = lightmaps.replace('manifest.lightmapStatus = "pinned-exact-source-lightmaps-active-no-invented-missing-maps";', 'manifest.lightmapStatus = "all-15-exact-source-lightmaps-active-no-missing-dependencies";');
lightmaps = lightmaps.replace('console.log(`RampReady Terminal 4 exact source lightmaps materialized: ${emitted} emissive textures; missing package dependencies remain unfilled.`);', 'console.log(`RampReady Terminal 4 exact source lightmaps materialized: ${emitted} emissive textures; all recovered dependencies are active.`);');
for (const token of [
  "EXACT_RECOVERED_LIGHTMAP_SOURCES",
  "const lightmapSources = [",
  "function decodeSourceTexture",
  "decodeSourceTexture(sourceBytes)",
  "emitted !== 15",
  'all-15-exact-source-lightmaps-active-no-missing-dependencies',
]) if (!lightmaps.includes(token)) throw new Error(`Prepared Terminal 4 exact lightmap materializer is missing ${token}`);
fs.writeFileSync(lightmapPath, lightmaps, "utf8");

for (const sourcePath of [
  "src/environment/authoredTerminal4Visual.js",
  "scripts/prepare-phx-visual-authority.mjs",
  "scripts/prepare-phx-visual-contract.mjs",
]) {
  let source = fs.readFileSync(sourcePath, "utf8");
  source = source.replaceAll("emissiveTextureCount !== 11", "emissiveTextureCount !== 15");
  source = source.replaceAll("exactLightmapCount !== 11", "exactLightmapCount !== 15");
  source = source.replaceAll('"exactLightmapCount !== 11"', '"exactLightmapCount !== 15"');
  source = source.replaceAll('"manifest.emissiveTextureCount !== 11"', '"manifest.emissiveTextureCount !== 15"');
  source = source.replaceAll('"emissiveTextureCount !== 11"', '"emissiveTextureCount !== 15"');
  fs.writeFileSync(sourcePath, source, "utf8");
}

const verifierPath = "scripts/verify-kphx-v181-source-contract.mjs";
let verifier = fs.readFileSync(verifierPath, "utf8");
for (const [oldToken, newToken] of [
  ['"manifest.emissiveTextureCount !== 11"', '"manifest.emissiveTextureCount !== 15"'],
  ['\'"PARKRAMPS2.BMP": { sourcePath: "parkramps.bmp"\'', '\'"PARKRAMPS2.BMP": { localFile: "PARKRAMPS2.BMP"\''],
  ['\'"PHX_TERM400_0.DDS": { sourcePath: "bgate1.bmp"\'', '\'"PHX_TERM400_0.DDS": { localFile: "PHX_TERM400_0.DDS"\''],
  ['\'"PHX_TERM400_1.DDS": { sourcePath: "bgate3.bmp"\'', '\'"PHX_TERM400_1.DDS": { localFile: "PHX_TERM400_1.DDS"\''],
  ['\'"PHXRAMPLIGHT.BMP": { sourcePath: "supports2.bmp"\'', '\'"PHXRAMPLIGHT.BMP": { localFile: "PHXRAMPLIGHT.BMP"\''],
  ['\'textureStatus: "pinned-authored-source-textures-active"\'', '\'textureStatus: "all-exact-source-textures-active-no-fallbacks"\''],
  ['"missing package dependencies remain unfilled"', '"all recovered dependencies are active"'],
]) verifier = verifier.replace(oldToken, newToken);
if (![
  '"manifest.emissiveTextureCount !== 15"',
  '"exactLightmapCount !== 15"',
].some((token) => verifier.includes(token))) throw new Error("Terminal 4 exact verifier lightmap count was not upgraded to 15");
for (const token of [
  '"PARKRAMPS2.BMP": { localFile: "PARKRAMPS2.BMP"',
  '"PHX_TERM400_0.DDS": { localFile: "PHX_TERM400_0.DDS"',
  '"PHX_TERM400_1.DDS": { localFile: "PHX_TERM400_1.DDS"',
  '"PHXRAMPLIGHT.BMP": { localFile: "PHXRAMPLIGHT.BMP"',
  'textureStatus: "all-exact-source-textures-active-no-fallbacks"',
  "all recovered dependencies are active",
]) if (!verifier.includes(token)) throw new Error(`Terminal 4 exact verifier is missing ${token}`);
fs.writeFileSync(verifierPath, verifier, "utf8");

console.log("Prepared exact Terminal 4 textures: four recovered diffuse maps, four recovered lightmaps, 15 exact emissive materials, zero fallbacks, and upgraded runtime contracts.");
