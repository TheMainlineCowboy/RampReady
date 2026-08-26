import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const ids = ["lektro-88", "manager-kubota"];
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

for (const id of ids) {
  const manifestPath = path.join(root, `public/models/${id}/manifest.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.schemaVersion !== 1) throw new Error(`${id}: unsupported manifest schema`);

  const parts = [];
  for (let index = 0; index < manifest.chunkCount; index += 1) {
    const relative = manifest.chunkPath.replace("{index}", String(index).padStart(2, "0"));
    const partPath = path.join(root, relative);
    if (!fs.existsSync(partPath)) throw new Error(`${id}: missing payload ${relative}`);
    parts.push(fs.readFileSync(partPath, "utf8").replace(/\s+/g, ""));
  }

  const encoded = parts.join("");
  if (encoded.length !== manifest.base64Chars) {
    throw new Error(`${id}: base64 length ${encoded.length} != ${manifest.base64Chars}`);
  }
  const compressed = Buffer.from(encoded, "base64");
  if (compressed.length !== manifest.brotliBytes) {
    throw new Error(`${id}: Brotli bytes ${compressed.length} != ${manifest.brotliBytes}`);
  }
  if (sha256(compressed) !== manifest.brotliSha256) throw new Error(`${id}: Brotli SHA-256 mismatch`);

  const glb = zlib.brotliDecompressSync(compressed);
  if (glb.length !== manifest.glbBytes) throw new Error(`${id}: GLB bytes ${glb.length} != ${manifest.glbBytes}`);
  if (sha256(glb) !== manifest.glbSha256) throw new Error(`${id}: GLB SHA-256 mismatch`);
  if (glb.subarray(0, 4).toString("ascii") !== "glTF") throw new Error(`${id}: materialized asset is not GLB`);

  const outputPath = path.join(root, manifest.runtimePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, glb);
  console.log(`Materialized authored equipment ${id}: ${path.relative(root, outputPath)} (${glb.length} bytes, ${manifest.glbSha256})`);
}
