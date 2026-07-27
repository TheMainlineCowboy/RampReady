import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const manifestPath = path.join(root, "public/models/standup-tug/manifest.json");
const outputPath = path.join(root, "public/models/standup-tug.glb");

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (manifest.schemaVersion !== 1) throw new Error("Unsupported stand-up runtime manifest schema");

const parts = [];
for (let index = 0; index < manifest.runtime.chunkCount; index += 1) {
  const relative = manifest.runtime.chunkPath.replace("{index}", String(index).padStart(2, "0"));
  const partPath = path.join(root, relative);
  if (!fs.existsSync(partPath)) throw new Error(`Missing stand-up runtime part: ${relative}`);
  parts.push(fs.readFileSync(partPath, "utf8").replace(/\s+/g, ""));
}

const encoded = parts.join("");
if (encoded.length !== manifest.runtime.base64Chars) {
  throw new Error(`Stand-up base64 length ${encoded.length} != ${manifest.runtime.base64Chars}`);
}
const compressed = Buffer.from(encoded, "base64");
if (compressed.length !== manifest.runtime.gzipBytes) {
  throw new Error(`Stand-up gzip length ${compressed.length} != ${manifest.runtime.gzipBytes}`);
}
if (sha256(compressed) !== manifest.runtime.gzipSha256) throw new Error("Stand-up gzip SHA-256 mismatch");

const glb = zlib.gunzipSync(compressed);
if (glb.length !== manifest.runtime.glbBytes) throw new Error(`Stand-up GLB length ${glb.length} != ${manifest.runtime.glbBytes}`);
if (sha256(glb) !== manifest.runtime.glbSha256) throw new Error("Stand-up GLB SHA-256 mismatch");
if (glb.subarray(0, 4).toString("ascii") !== "glTF") throw new Error("Materialized stand-up asset is not GLB");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, glb);
console.log(`Materialized verified stand-up tug: ${path.relative(root, outputPath)} (${glb.length} bytes, ${manifest.runtime.glbSha256})`);
