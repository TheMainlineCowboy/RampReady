import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const EXPECTED = new Map([
  ["ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0", "Jetway_albedo.jpg"],
  ["7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c", "Jetway_metallic.png"],
  ["9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1", "Jetway_normal.png"],
  ["85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c", "Jetway_AO.jpg"],
  ["823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794", "Glass_JW_normal.png"],
  ["391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13", "Glass_JW_AO.jpg"],
  ["b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9", "Glass_JW_emissive.jpg"],
]);
const SKIP = new Set([".git", "node_modules", "dist"]);
const found = new Map();

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(absolute);
    if (info.size < 10_000 || info.size > 12_000_000) continue;
    const bytes = await readFile(absolute);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const expectedName = EXPECTED.get(digest);
    if (!expectedName) continue;
    const relative = path.relative(process.cwd(), absolute);
    found.set(digest, relative);
    console.log(`JETWAY_EXACT_TEXTURE_FOUND name=${expectedName} bytes=${bytes.length} sha256=${digest} path=${relative}`);
  }
}

await walk(process.cwd());
for (const [digest, name] of EXPECTED) {
  if (!found.has(digest)) console.log(`JETWAY_EXACT_TEXTURE_MISSING name=${name} sha256=${digest}`);
}
console.log(`JETWAY_EXACT_TEXTURE_SUMMARY found=${found.size}/${EXPECTED.size}`);
