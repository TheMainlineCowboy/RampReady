import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const MODEL_UID = "6067e855917e498abee3d98076293cc6";
const EXPECTED = Object.freeze({
  "Jetway_albedo.jpg": Object.freeze({ bytes: 4_374_151, fileSha256: "ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0", pixelSha256: "9c53bb7ffad689ba20fa574bf0158e5ffc41f8ee4dcd10cf4bc1f4edae1467c5" }),
  "Jetway_metallic.png": Object.freeze({ bytes: 9_300_055, fileSha256: "7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c", pixelSha256: "4a02139c5d83d6dea7235e73bfbf51019546e25860708608bb1b164b62119a7e" }),
  "Jetway_normal.png": Object.freeze({ bytes: 10_763_430, fileSha256: "9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1", pixelSha256: "cbf9564819e4727cc8992b375a13c0540daf83141008b6f722b8c09bec485465" }),
  "Jetway_AO.jpg": Object.freeze({ bytes: 3_529_816, fileSha256: "85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c", pixelSha256: "9c50a72b4759824e3b1bd4820174ebc31b0eaff33aa3d88bdbd117a47d4ce505" }),
  "Glass_JW_normal.png": Object.freeze({ bytes: 1_107_961, fileSha256: "823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794", pixelSha256: "4f7fca07d1a80f5537256e491c9ffbdc2e49b546dd45a72a247a5b5d7f7091e3" }),
  "Glass_JW_AO.jpg": Object.freeze({ bytes: 88_646, fileSha256: "391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13", pixelSha256: "5eb6d6148610332c47a669997da9b16b8cf68a00714a3c7c72d94acc04766922" }),
  "Glass_JW_emissive.jpg": Object.freeze({ bytes: 185_984, fileSha256: "b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9", pixelSha256: "c4d1235e4300303ea85e3702b54a02f3a456b8bfbf12e9e555a233aaf01d1303" }),
});
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const basename = (name) => String(name || "").replace(/\.[^.]+$/, "").toLowerCase();
const cacheRoot = path.resolve(".cache/exact-airport-jetway/viewer-textures");

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

function runPixelProbe(filePath) {
  const code = [
    "import hashlib, json, sys",
    "from PIL import Image",
    "im = Image.open(sys.argv[1]).convert('RGBA')",
    "raw = im.tobytes()",
    "print(json.dumps({'width': im.width, 'height': im.height, 'mode': im.mode, 'pixelBytes': len(raw), 'pixelSha256': hashlib.sha256(raw).hexdigest()}))",
  ].join("; ");
  let result = spawnSync("python3", ["-c", code, filePath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 && /No module named ['\"]PIL['\"]/.test(String(result.stderr))) {
    const install = spawnSync("python3", ["-m", "pip", "install", "--user", "--disable-pip-version-check", "--quiet", "Pillow"], { encoding: "utf8", timeout: 120_000 });
    if (install.status !== 0) throw new Error(`Pillow install failed: ${String(install.stderr || "").trim()}`);
    result = spawnSync("python3", ["-c", code, filePath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Pixel probe failed for ${filePath}: ${String(result.stderr || "").trim()}`);
  return JSON.parse(result.stdout.trim());
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
const serialized = decodeEntities(match[1].trim()).replace(/^<!--\s*/, "").replace(/\s*-->$/, "");
const data = JSON.parse(serialized);
const textureKeys = Object.keys(data).filter((key) => key.includes(`/i/models/${MODEL_UID}`) && key.includes("textures"));
if (!textureKeys.length) throw new Error("Official Sketchfab viewer has no texture manifest key");
const results = textureKeys.flatMap((key) => data[key]?.results || []);
await mkdir(cacheRoot, { recursive: true });

const outcomes = [];
for (const [exactName, expected] of Object.entries(EXPECTED)) {
  const texture = results.find((entry) => basename(entry.name) === basename(exactName));
  if (!texture) {
    outcomes.push({ exactName, status: "missing-viewer-texture" });
    continue;
  }
  const originals = (texture.images || []).filter((candidate) => Object.keys(candidate.options || {}).length === 0);
  const candidate = originals.sort((a, b) => (b.width || 0) - (a.width || 0) || (b.size || 0) - (a.size || 0))[0];
  if (!candidate?.url) {
    outcomes.push({ exactName, status: "missing-original-candidate" });
    continue;
  }
  const response = await fetch(candidate.url, {
    headers: { "User-Agent": "Mozilla/5.0 RampReady exact-source verifier" },
    redirect: "follow",
  });
  if (!response.ok) {
    outcomes.push({ exactName, status: `http-${response.status}`, url: candidate.url });
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = new URL(candidate.url).pathname.match(/\.[^.\/]+$/)?.[0] || ".bin";
  const outputPath = path.join(cacheRoot, `${basename(exactName)}${extension}`);
  await writeFile(outputPath, bytes);
  const fileSha256 = sha256(bytes);
  const pixels = runPixelProbe(outputPath);
  const outcome = {
    exactName,
    viewerName: texture.name,
    width: pixels.width,
    height: pixels.height,
    viewerBytes: bytes.length,
    viewerFileSha256: fileSha256,
    exactFileBytes: expected.bytes,
    exactFileSha256: expected.fileSha256,
    viewerPixelSha256: pixels.pixelSha256,
    exactPixelSha256: expected.pixelSha256,
    byteExact: bytes.length === expected.bytes && fileSha256 === expected.fileSha256,
    pixelExact: pixels.pixelSha256 === expected.pixelSha256,
    url: candidate.url,
  };
  outcomes.push(outcome);
  console.log(`JETWAY_PIXEL_COMPARE ${JSON.stringify(outcome)}`);
}
const byteExactCount = outcomes.filter((entry) => entry.byteExact).length;
const pixelExactCount = outcomes.filter((entry) => entry.pixelExact).length;
console.log(`JETWAY_PIXEL_SUMMARY byteExact=${byteExactCount}/7 pixelExact=${pixelExactCount}/7`);
console.log(`JETWAY_PIXEL_OUTCOMES ${JSON.stringify(outcomes)}`);
