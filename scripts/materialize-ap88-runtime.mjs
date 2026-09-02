import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const manifestUrl = new URL("assets/tug/ap88-r4.parts.json", root);
const outputUrl = new URL("public/models/lektro-ap88-r4.glb", root);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const normalize = (text) => text.replace(/\s+/g, "");

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
if (manifest.version !== 1 || manifest.encoding !== "base64-concatenated-brotli") {
  throw new Error("Unsupported AP88 runtime manifest");
}
if (!Array.isArray(manifest.parts) || manifest.parts.length !== manifest.partCount) {
  throw new Error("AP88 runtime manifest part count is invalid");
}

const encodedParts = [];
for (const part of manifest.parts) {
  const text = normalize(await readFile(new URL(part.path, root), "utf8"));
  if (text.length !== part.charLength) {
    throw new Error(`${part.path} length ${text.length}/${part.charLength}`);
  }
  const hash = sha256(Buffer.from(text, "utf8"));
  if (hash !== part.sha256) throw new Error(`${part.path} sha256 ${hash}/${part.sha256}`);
  encodedParts.push(text);
}
const encoded = encodedParts.join("");
if (encoded.length !== manifest.totalBase64Characters) {
  throw new Error(`AP88 base64 stream length ${encoded.length}/${manifest.totalBase64Characters}`);
}

const compressed = Buffer.from(encoded, "base64");
if (compressed.byteLength !== manifest.compressedByteLength || sha256(compressed) !== manifest.compressedSha256) {
  throw new Error("AP88 compressed runtime identity mismatch");
}
const glb = brotliDecompressSync(compressed);
if (glb.byteLength !== manifest.glbByteLength || sha256(glb) !== manifest.glbSha256) {
  throw new Error("AP88 GLB identity mismatch");
}
if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.byteLength) {
  throw new Error("AP88 payload is not valid GLB 2.0");
}

await mkdir(new URL("public/models/", root), { recursive: true });
await writeFile(outputUrl, glb);
console.log(`Materialized LEKTRO AP88 R4: ${glb.byteLength} bytes, sha256 ${manifest.glbSha256}`);
