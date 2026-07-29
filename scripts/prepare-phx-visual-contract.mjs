import fs from "node:fs";

const path = "scripts/verify-kphx-v181-source-contract.mjs";
let source = fs.readFileSync(path, "utf8");

const replacements = [
  ['"emissiveTextureCount !== 11"', '"exactLightmapCount !== 11"'],
  ['\'detailLevel: "terminal4-authored-textured-v4-source-ramp-exact-a1-nearfield"\'', '\'detailLevel: "terminal4-authored-pavement-v5-source-ramp-stand-markings"\''],
  ['\'surfaceMaterialMode: "source-aerial-diffuse-with-source-atlas-nearfield-concrete"\'', '\'surfaceMaterialMode: "authored-pavement-nearfield-over-source-aerial-background"\''],
  ['"material.bumpScale = 0.022"', '"material.bumpScale = 0.028"'],
];

for (const [oldText, newText] of replacements) {
  if (source.includes(newText)) continue;
  if (!source.includes(oldText)) throw new Error(`PHX visual contract migration anchor is missing: ${oldText}`);
  source = source.replace(oldText, newText);
}

const markingAnchor = '  "authoredGroundEnhancedMarkingMaterialCount",';
const markingReplacement = `${markingAnchor}\n  "authoredGroundGateMarkingCount",\n  "buildTerminal4StandMarkings",\n  "opaque-authored-pavement-over-aerial-background",`;
if (!source.includes('"authoredGroundGateMarkingCount"')) {
  if (!source.includes(markingAnchor)) throw new Error("PHX gate-marking verification anchor is missing");
  source = source.replace(markingAnchor, markingReplacement);
}

const terminalAnchor = '  "texture.anisotropy = 16",\n  "exactLightmapCount !== 11",';
const terminalReplacement = '  "texture.anisotropy = 16",\n  \'manifestUrl.searchParams.set("materialPass"\',\n  \'cache: "no-store"\',\n  "exactLightmapCount !== 11",';
if (!source.includes('manifestUrl.searchParams.set("materialPass"')) {
  if (!source.includes(terminalAnchor)) throw new Error("PHX non-stale Terminal 4 verification anchor is missing");
  source = source.replace(terminalAnchor, terminalReplacement);
}

const photoAnchor = '  "texture.anisotropy = 16",\n  "6400",';
const photoReplacement = '  "texture.anisotropy = 16",\n  \'manifestUrl.searchParams.set("textureMode"\',\n  "tileVersion = encodeURIComponent",\n  "6400",';
if (!source.includes('manifestUrl.searchParams.set("textureMode"')) {
  if (!source.includes(photoAnchor)) throw new Error("PHX non-stale aerial verification anchor is missing");
  source = source.replace(photoAnchor, photoReplacement);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared PHX verification contract for non-stale Terminal 4 assets, opaque authored pavement, and source-positioned stand markings.");
