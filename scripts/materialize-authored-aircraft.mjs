import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";

const repoRoot = new URL("../", import.meta.url);
const manifestUrl = new URL("assets/aircraft/crj700-user.parts.json", repoRoot);
const outputUrl = new URL("public/models/crj700-user.glb", repoRoot);
const metadataUrl = new URL("public/models/crj700-user.asset.json", repoRoot);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
if (manifest.version !== 1 || manifest.encoding !== "base64-concatenated-brotli") {
  throw new Error("Unsupported authored-aircraft repository manifest");
}
if (!Array.isArray(manifest.parts) || manifest.parts.length !== manifest.partCount || manifest.partCount !== 79) {
  throw new Error(`Authored aircraft requires 79 repository parts; found ${manifest.parts?.length ?? 0}`);
}

const encodedParts = [];
for (const [index, part] of manifest.parts.entries()) {
  const partUrl = new URL(part.path, repoRoot);
  let text;
  try {
    text = (await readFile(partUrl, "utf8")).trim();
  } catch (error) {
    throw new Error(`Missing authored-aircraft repository part ${index}: ${part.path}`, { cause: error });
  }
  if (text.length !== part.charLength) {
    throw new Error(`Authored-aircraft part ${index} has ${text.length} characters; expected ${part.charLength}`);
  }
  if (sha256(Buffer.from(text, "utf8")) !== part.sha256) {
    throw new Error(`Authored-aircraft part ${index} hash mismatch`);
  }
  encodedParts.push(text);
}

const encoded = encodedParts.join("");
if (encoded.length !== manifest.totalBase64Characters) {
  throw new Error(`Authored-aircraft base64 stream has ${encoded.length} characters; expected ${manifest.totalBase64Characters}`);
}
const compressed = Buffer.from(encoded, "base64");
if (compressed.byteLength !== manifest.compressedByteLength || sha256(compressed) !== manifest.compressedSha256) {
  throw new Error("Authored-aircraft compressed stream identity mismatch");
}

const glb = brotliDecompressSync(compressed);
if (glb.byteLength !== manifest.glbByteLength || sha256(glb) !== manifest.glbSha256) {
  throw new Error("Authored-aircraft GLB identity mismatch");
}
if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.byteLength) {
  throw new Error("Authored aircraft payload is not a valid GLB 2.0 file");
}

const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));
if (metadata.sha256 !== manifest.glbSha256 || metadata.byteLength !== manifest.glbByteLength) {
  throw new Error("Authored-aircraft metadata does not match the verified GLB");
}
if (metadata.preserveMaterials !== true || metadata.materialCount !== 106 || metadata.textureCount !== 9) {
  throw new Error("Authored-aircraft material and texture contract is incomplete");
}

await mkdir(new URL("public/models/", repoRoot), { recursive: true });
await writeFile(outputUrl, glb);
console.log(`Materialized authored American Eagle aircraft: ${glb.byteLength} bytes, sha256 ${manifest.glbSha256}`);
