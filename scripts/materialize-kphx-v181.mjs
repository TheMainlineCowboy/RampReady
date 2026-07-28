import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";

const root = process.cwd();
const manifestPath = path.join(root, "public/models/kphx-v181/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const chunks = [];
for (let index = 0; index < manifest.payload.chunkCount; index += 1) {
  const relative = manifest.payload.chunkPath.replace("{index}", String(index).padStart(2, "0"));
  const text = (await readFile(path.join(root, relative), "utf8")).replace(/\s+/g, "");
  if (index < manifest.payload.chunkCount - 1 && text.length !== manifest.payload.chunkChars) {
    throw new Error(`KPHX v1.8.1 payload part ${index} has ${text.length} chars; expected ${manifest.payload.chunkChars}`);
  }
  chunks.push(text);
}
const encoded = chunks.join("");
if (encoded.length !== manifest.payload.base64Chars) {
  throw new Error(`KPHX v1.8.1 base64 length ${encoded.length} != ${manifest.payload.base64Chars}`);
}
const compressed = Buffer.from(encoded, "base64");
if (compressed.length !== manifest.runtime.brotliBytes) {
  throw new Error(`KPHX v1.8.1 Brotli bytes ${compressed.length} != ${manifest.runtime.brotliBytes}`);
}
if (sha256(compressed) !== manifest.runtime.brotliSha256) {
  throw new Error("KPHX v1.8.1 Brotli SHA-256 mismatch");
}
const glb = brotliDecompressSync(compressed);
if (glb.length !== manifest.runtime.glbBytes) {
  throw new Error(`KPHX v1.8.1 GLB bytes ${glb.length} != ${manifest.runtime.glbBytes}`);
}
if (sha256(glb) !== manifest.runtime.glbSha256) {
  throw new Error("KPHX v1.8.1 GLB SHA-256 mismatch");
}
if (glb.subarray(0, 4).toString("ascii") !== "glTF" || glb.readUInt32LE(4) !== 2) {
  throw new Error("KPHX v1.8.1 payload is not a GLB v2 asset");
}
const outputPath = path.join(root, manifest.runtime.outputPath);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, glb);
console.log(`KPHX v1.8.1 materialized: ${glb.length} bytes, ${manifest.counts.jetways} jetways, ${manifest.counts.aprons} apron surfaces.`);
