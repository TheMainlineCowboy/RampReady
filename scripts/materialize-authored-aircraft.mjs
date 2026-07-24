import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";

const compressedUrl = new URL("../assets/aircraft/crj700-user.glb.br", import.meta.url);
const outputUrl = new URL("../public/models/crj700-user.glb", import.meta.url);
const metadataUrl = new URL("../public/models/crj700-user.asset.json", import.meta.url);

const EXPECTED = Object.freeze({
  compressedByteLength: 939980,
  compressedSha256: "f4124a1ca343b6aaeb961f6bfcd970d09de3945088b08b06052f333f3ac788ae",
  glbByteLength: 1873128,
  glbSha256: "01383b502fa9a5e0aca3b5cc4a90b5ffe82d52160778bc309e2de73579b1056b",
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const compressed = await readFile(compressedUrl);
if (compressed.byteLength !== EXPECTED.compressedByteLength) {
  throw new Error(`Authored-aircraft compressed source is ${compressed.byteLength} bytes; expected ${EXPECTED.compressedByteLength}`);
}
if (sha256(compressed) !== EXPECTED.compressedSha256) {
  throw new Error("Authored-aircraft compressed source hash mismatch");
}

const glb = brotliDecompressSync(compressed);
if (glb.byteLength !== EXPECTED.glbByteLength || sha256(glb) !== EXPECTED.glbSha256) {
  throw new Error("Authored-aircraft GLB identity mismatch");
}
if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.byteLength) {
  throw new Error("Authored aircraft payload is not a valid GLB 2.0 file");
}

const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));
if (metadata.sha256 !== EXPECTED.glbSha256 || metadata.byteLength !== EXPECTED.glbByteLength) {
  throw new Error("Authored-aircraft metadata does not match the verified GLB");
}
if (metadata.preserveMaterials !== true || metadata.materialCount !== 106 || metadata.textureCount !== 9) {
  throw new Error("Authored-aircraft material and texture contract is incomplete");
}

await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(outputUrl, glb);
console.log(`Materialized authored American Eagle aircraft: ${glb.byteLength} bytes, sha256 ${EXPECTED.glbSha256}`);
