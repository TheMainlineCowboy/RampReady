import { createHash } from "node:crypto";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const sourceDir = path.resolve("public/models/airport-jetway");
const manifestPath = path.join(sourceDir, "source-manifest.json");
const outputPath = path.join(sourceDir, "Airport_Jetway.source-web.glb");
const compressedPath = path.join(sourceDir, ".Airport_Jetway.source-web.glb.xz");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.parts) || !manifest.parts.length) throw new Error("Supplied jetway GLB manifest has no parts");
const encoded = (await Promise.all(manifest.parts.map((name) => readFile(path.join(sourceDir, name), "utf8"))))
  .join("")
  .replace(/\s+/g, "");
const compressed = Buffer.from(encoded, "base64");
if (compressed.length !== manifest.xzBytes) {
  throw new Error(`Supplied jetway XZ length mismatch: ${compressed.length} != ${manifest.xzBytes}`);
}
if (sha256(compressed) !== manifest.xzSha256) throw new Error("Supplied jetway XZ SHA-256 mismatch");
await writeFile(compressedPath, compressed);
const result = spawnSync("xz", ["-dc", compressedPath], { encoding: null, maxBuffer: 16 * 1024 * 1024 });
await unlink(compressedPath).catch(() => {});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Supplied jetway XZ decompression failed: ${result.stderr?.toString() || result.status}`);
const glb = Buffer.from(result.stdout);
if (glb.length !== manifest.webGlbBytes) throw new Error(`Supplied jetway GLB length mismatch: ${glb.length} != ${manifest.webGlbBytes}`);
if (sha256(glb) !== manifest.webGlbSha256) throw new Error("Supplied jetway GLB SHA-256 mismatch");
if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("Supplied jetway output is not a GLB");
const jsonLength = glb.readUInt32LE(12);
const jsonType = glb.readUInt32LE(16);
if (jsonType !== 0x4e4f534a) throw new Error("Supplied jetway GLB has no JSON chunk");
const definition = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").replace(/\0+$/g, "").trim());
const nodeNames = new Set((definition.nodes || []).map((node) => node.name));
for (const name of manifest.nodes) {
  if (!nodeNames.has(name)) throw new Error(`Supplied jetway GLB is missing node ${name}`);
}
const materialNames = new Set((definition.materials || []).map((material) => material.name));
for (const name of ["Jetway", "Glass_JW"]) {
  if (!materialNames.has(name)) throw new Error(`Supplied jetway GLB is missing material ${name}`);
}
if ((definition.images || []).length !== 7) throw new Error(`Supplied jetway GLB expected 7 embedded maps, received ${definition.images?.length || 0}`);
for (const mesh of definition.meshes || []) {
  for (const primitive of mesh.primitives || []) {
    for (const attribute of ["POSITION", "NORMAL", "TANGENT", "TEXCOORD_0"]) {
      if (!(attribute in (primitive.attributes || {}))) throw new Error(`Supplied jetway GLB mesh ${mesh.name} lost ${attribute}`);
    }
  }
}
await writeFile(outputPath, glb);
console.log(`Materialized complete supplied jetway GLB: ${glb.length} bytes, ${manifest.webGlbSha256}, ${definition.meshes.length} meshes, ${definition.images.length} embedded maps.`);
