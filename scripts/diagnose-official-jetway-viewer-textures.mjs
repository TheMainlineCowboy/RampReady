import { createHash } from "node:crypto";

const MODEL_UID = "6067e855917e498abee3d98076293cc6";
const EXPECTED = Object.freeze({
  "Jetway_albedo.jpg": [4_374_151, "ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0"],
  "Jetway_metallic.png": [9_300_055, "7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c"],
  "Jetway_normal.png": [10_763_430, "9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1"],
  "Jetway_AO.jpg": [3_529_816, "85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c"],
  "Glass_JW_normal.png": [1_107_961, "823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794"],
  "Glass_JW_AO.jpg": [88_646, "391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13"],
  "Glass_JW_emissive.jpg": [185_984, "b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9"],
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

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

const pageUrl = `https://sketchfab.com/models/${MODEL_UID}/embed?api_log=1`;
const page = await fetch(pageUrl, {
  headers: { "User-Agent": "Mozilla/5.0 RampReady exact-source verifier" },
  redirect: "follow",
});
if (!page.ok) throw new Error(`Official Sketchfab viewer returned HTTP ${page.status}`);
const html = await page.text();
const match = html.match(/<[^>]+id=["']js-dom-data-prefetched-data["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
if (!match) throw new Error("Official Sketchfab viewer did not expose prefetched model data");
const data = JSON.parse(decodeEntities(match[1].trim()));
const textureKeys = Object.keys(data).filter((key) => key.includes(`/i/models/${MODEL_UID}`) && key.includes("textures"));
console.log(`JETWAY_VIEWER textureKeys=${JSON.stringify(textureKeys)}`);
if (!textureKeys.length) throw new Error("Official Sketchfab viewer has no texture manifest key");

const results = textureKeys.flatMap((key) => data[key]?.results || []);
const matched = new Set();
for (const texture of results) {
  const sourceName = String(texture.name || "");
  const expectedEntry = Object.entries(EXPECTED).find(([name]) => (
    sourceName === name || sourceName === name.replace(/\.[^.]+$/, "") || sourceName.replace(/\.[^.]+$/, "") === name.replace(/\.[^.]+$/, "")
  ));
  const candidates = [...(texture.images || [])].sort((a, b) => (b.width || 0) - (a.width || 0));
  console.log(`JETWAY_VIEWER_TEXTURE name=${JSON.stringify(sourceName)} candidates=${candidates.length}`);
  for (const candidate of candidates) {
    const response = await fetch(candidate.url, {
      headers: { "User-Agent": "Mozilla/5.0 RampReady exact-source verifier" },
      redirect: "follow",
    });
    if (!response.ok) {
      console.log(`JETWAY_VIEWER_CANDIDATE name=${JSON.stringify(sourceName)} width=${candidate.width} http=${response.status}`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = sha256(bytes);
    const exactName = Object.entries(EXPECTED).find(([, [size, hash]]) => size === bytes.length && hash === digest)?.[0] || null;
    console.log(`JETWAY_VIEWER_CANDIDATE name=${JSON.stringify(sourceName)} width=${candidate.width} bytes=${bytes.length} sha256=${digest} exact=${exactName || "no"}`);
    if (exactName) matched.add(exactName);
    if (expectedEntry && exactName === expectedEntry[0]) break;
  }
}
console.log(`JETWAY_VIEWER_EXACT matched=${matched.size}/7 names=${JSON.stringify([...matched].sort())}`);
