import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CHUNK_COUNT = 106;
const CHUNK_ROOT = path.resolve(".jetway-source-v3");
const OUTPUT_ROOT = path.resolve("public/models/airport-jetway/source");
const ARCHIVE_PATH = path.resolve(".jetway-source-v3/airport-jetway-source.tar.xz");
const EXPECTED_ENCODED_CHARS = 1_053_264;
const EXPECTED_ARCHIVE_BYTES = 789_948;
const EXPECTED_ARCHIVE_SHA256 = "d197405c68f24f0870a700679838c5ac8fca8410ec51d706abdd8ea7a53ddc9e";
const EXPECTED_MESHES = [
  "Tunnel_C_Jetway_0",
  "Tunnel_C_Glass_JW_0",
  "Rotunda_Jetway_0",
  "Cab_Jetway_0",
  "Cab_Glass_JW_0",
  "Tunnel_A_Jetway_0",
  "Tunnel_B_Jetway_0",
];
const EXPECTED_NODES = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
const EXPECTED_IMAGES = [
  "Jetway_albedo.avif",
  "Jetway_metallic.avif",
  "Jetway_normal.avif",
  "Jetway_AO.avif",
  "Glass_JW_normal.avif",
  "Glass_JW_AO.avif",
  "Glass_JW_emissive.avif",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function payloadFromChunk(source, index) {
  const trimmed = source.trim();
  if (!trimmed.startsWith("RAMPREADY_JETWAY_ASSET_PART_")) return trimmed;
  const separator = trimmed.indexOf("\n\n");
  if (separator < 0) throw new Error(`Jetway source part ${index} has a header but no payload separator`);
  return trimmed.slice(separator + 2).replace(/\s+/g, "");
}

const encodedParts = [];
for (let index = 0; index < CHUNK_COUNT; index += 1) {
  const chunkPath = path.join(CHUNK_ROOT, `part${String(index).padStart(3, "0")}.b64`);
  const source = await readFile(chunkPath, "utf8");
  const encoded = payloadFromChunk(source, index);
  const expectedLength = index === CHUNK_COUNT - 1 ? 3_264 : 10_000;
  if (encoded.length !== expectedLength) {
    throw new Error(`Jetway source part ${index} expected ${expectedLength} characters, received ${encoded.length}`);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error(`Jetway source part ${index} is not valid base64 text`);
  console.log(`JETWAY_SOURCE_PART ${String(index).padStart(3, "0")} chars=${encoded.length} sha256=${sha256(Buffer.from(encoded))}`);
  encodedParts.push(encoded);
}

const encoded = encodedParts.join("");
if (encoded.length !== EXPECTED_ENCODED_CHARS) {
  throw new Error(`Jetway source package expected ${EXPECTED_ENCODED_CHARS} base64 characters, received ${encoded.length}`);
}
const archive = Buffer.from(encoded, "base64");
const archiveDigest = sha256(archive);
if (archive.length !== EXPECTED_ARCHIVE_BYTES || archiveDigest !== EXPECTED_ARCHIVE_SHA256) {
  throw new Error(`Jetway source archive mismatch: ${archive.length} bytes / ${archiveDigest}`);
}
if (archive.subarray(0, 6).toString("hex") !== "fd377a585a00") throw new Error("Jetway source archive is not an XZ stream");
const test = spawnSync("xz", ["-t"], { input: archive, encoding: null, maxBuffer: 16 * 1024 * 1024 });
if (test.error) throw test.error;
if (test.status !== 0) throw new Error(`Jetway source archive integrity failed: ${String(test.stderr || "").trim()}`);

await mkdir(CHUNK_ROOT, { recursive: true });
await writeFile(ARCHIVE_PATH, archive);
await rm(OUTPUT_ROOT, { recursive: true, force: true });
await mkdir(OUTPUT_ROOT, { recursive: true });
const extract = spawnSync("tar", ["-xJf", ARCHIVE_PATH, "-C", OUTPUT_ROOT], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
if (extract.error) throw extract.error;
if (extract.status !== 0) throw new Error(`Jetway source archive extraction failed: ${extract.stderr.trim()}`);

const gltfPath = path.join(OUTPUT_ROOT, "Airport_Jetway.gltf");
const binPath = path.join(OUTPUT_ROOT, "Airport_Jetway.bin");
const gltf = JSON.parse(await readFile(gltfPath, "utf8"));
const binStat = await stat(binPath);
if (binStat.size !== gltf.buffers?.[0]?.byteLength) throw new Error("Jetway source binary length does not match glTF metadata");
if (!gltf.extensionsUsed?.includes("EXT_texture_avif")) throw new Error("Jetway source glTF is missing EXT_texture_avif");
if (gltf.meshes?.length !== 7 || gltf.materials?.length !== 2 || gltf.images?.length !== 7) {
  throw new Error(`Jetway source glTF expected 7 meshes, 2 materials and 7 images; received ${gltf.meshes?.length}, ${gltf.materials?.length}, ${gltf.images?.length}`);
}
const meshNames = new Set(gltf.meshes.map((entry) => entry.name));
const nodeNames = new Set(gltf.nodes.map((entry) => entry.name));
for (const name of EXPECTED_MESHES) if (!meshNames.has(name)) throw new Error(`Jetway source glTF is missing mesh ${name}`);
for (const name of EXPECTED_NODES) if (!nodeNames.has(name)) throw new Error(`Jetway source glTF is missing node ${name}`);
for (const mesh of gltf.meshes) {
  for (const primitive of mesh.primitives) {
    if (primitive.attributes?.POSITION == null || primitive.attributes?.TEXCOORD_0 == null) {
      throw new Error(`Jetway source mesh ${mesh.name} lost source positions or UVs`);
    }
  }
}
const imageFiles = new Set(await readdir(path.join(OUTPUT_ROOT, "images")));
for (const name of EXPECTED_IMAGES) if (!imageFiles.has(name)) throw new Error(`Jetway source package is missing clean texture ${name}`);
for (let index = 0; index < 5; index += 1) await rm(path.resolve(`public/models/airport-jetway/geometry.part${index}`), { force: true });
await rm(path.resolve("public/models/airport-jetway/Airport_Jetway.glb"), { force: true });
console.log(`Materialized supplied Airport Jetway source package: ${archive.length} bytes, sha256 ${archiveDigest}, 7 UV-mapped meshes and 7 clean full-resolution textures.`);
