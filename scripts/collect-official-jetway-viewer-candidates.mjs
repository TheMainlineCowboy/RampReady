import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MODEL_UID = "6067e855917e498abee3d98076293cc6";
const OUTPUT_ROOT = path.resolve("test-results/official-viewer-texture-candidates");
const TARGETS = new Set([
  "jetway_albedo",
  "jetway_metallic",
  "jetway_roughness",
  "jetway_normal",
  "jetway_ao",
  "glass_jw_normal",
  "glass_jw_ao",
  "glass_jw_emissive",
]);
const basename = (name) => String(name || "").replace(/\.[^.]+$/, "").toLowerCase();

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

const page = await fetch(`https://sketchfab.com/models/${MODEL_UID}/embed?api_log=1`, {
  headers: { "User-Agent": "Mozilla/5.0 RampReady exact-source candidate collector" },
  redirect: "follow",
});
if (!page.ok) throw new Error(`Official Sketchfab viewer returned HTTP ${page.status}`);
const html = await page.text();
const match = html.match(/<[^>]+id=["']js-dom-data-prefetched-data["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
if (!match) throw new Error("Official Sketchfab viewer did not expose prefetched model data");
const serialized = decodeEntities(match[1].trim()).replace(/^<!--\s*/, "").replace(/\s*-->$/, "");
const data = JSON.parse(serialized);
const textureKey = Object.keys(data).find((key) => key.includes(`/i/models/${MODEL_UID}`) && key.includes("textures"));
const textures = data[textureKey]?.results || [];
await mkdir(OUTPUT_ROOT, { recursive: true });

const manifest = [];
for (const texture of textures) {
  const base = basename(texture.name);
  if (!TARGETS.has(base)) continue;
  const images = texture.images || [];
  const maximumWidth = Math.max(...images.map((entry) => Number(entry.width || 0)));
  const candidates = images.filter((entry) => Number(entry.width || 0) === maximumWidth);
  for (const candidate of candidates) {
    const response = await fetch(candidate.url, {
      headers: { "User-Agent": "Mozilla/5.0 RampReady exact-source candidate collector" },
      redirect: "follow",
    });
    if (!response.ok) throw new Error(`Official viewer candidate ${texture.name}/${candidate.uid} returned HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const extension = new URL(candidate.url).pathname.match(/\.[^.\/]+$/)?.[0] || ".bin";
    const relativePath = `${base}/${String(candidate.width)}-${candidate.uid}${extension}`;
    const outputPath = path.join(OUTPUT_ROOT, relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
    manifest.push({
      textureName: texture.name,
      textureUid: texture.uid,
      candidateUid: candidate.uid,
      width: candidate.width,
      height: candidate.height,
      declaredSize: candidate.size,
      actualSize: bytes.length,
      options: candidate.options || {},
      relativePath,
      url: candidate.url,
    });
    console.log(`JETWAY_VIEWER_CANDIDATE_SAVED ${JSON.stringify(manifest.at(-1))}`);
  }
}
await writeFile(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify({ modelUid: MODEL_UID, candidates: manifest }, null, 2)}\n`, "utf8");
console.log(`JETWAY_VIEWER_CANDIDATES saved=${manifest.length}`);
