import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../assets/aircraft/crj700-user.glb.br", import.meta.url);
const outputUrl = new URL("../public/models/crj700-user.glb", import.meta.url);
const metadataUrl = new URL("../public/models/crj700-user.asset.json", import.meta.url);
const materializerUrl = new URL("./materialize-authored-aircraft.mjs", import.meta.url);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// The repository may store the exact compressed aircraft as deterministic text chunks.
// Materialize first, then verify the exact compressed and decompressed identities.
await import(materializerUrl.href + `?verify=${Date.now()}`);

const source = await readFile(sourceUrl);
const sourceSha = sha256(source);
if (source.byteLength !== 939980) throw new Error(`Compressed authored aircraft size mismatch after materialization: ${source.byteLength}`);
if (sourceSha !== "f4124a1ca343b6aaeb961f6bfcd970d09de3945088b08b06052f333f3ac788ae") {
  throw new Error(`Compressed authored aircraft hash mismatch after materialization: ${sourceSha}`);
}

const glb = await readFile(outputUrl);
const glbSha = sha256(glb);
if (glb.byteLength !== 1873128) throw new Error(`Authored aircraft GLB size mismatch: ${glb.byteLength}`);
if (glbSha !== "01383b502fa9a5e0aca3b5cc4a90b5ffe82d52160778bc309e2de73579b1056b") throw new Error("Authored aircraft GLB hash mismatch");
if (glb.toString("ascii", 0, 4) !== "glTF" || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.byteLength) {
  throw new Error("Authored aircraft output is not a valid GLB 2.0 file");
}

const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));
if (metadata.materialCount !== 106 || metadata.textureCount !== 9 || metadata.preserveMaterials !== true) {
  throw new Error("Authored aircraft metadata does not preserve the verified materials and textures");
}
if (metadata.sha256 !== glbSha || metadata.byteLength !== glb.byteLength) {
  throw new Error("Authored aircraft metadata identity does not match the materialized GLB");
}

console.log("Authored aircraft materialization verification passed: deterministic repository source -> exact 939,980-byte Brotli payload -> exact 1,873,128-byte GLB with 106 materials and nine textures.");
