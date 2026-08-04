import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CHUNK_COUNT = 37;
const CHUNK_ROOT = path.resolve(".jetway-source-v4");
const OUTPUT_ROOT = path.resolve("public/models/airport-jetway/source");
const ARCHIVE_PATH = path.resolve(".cache/airport-jetway-source-v4.tar.xz");
const EXPECTED_ENCODED_CHARS = 547_072;
const EXPECTED_ARCHIVE_BYTES = 410_304;
const EXPECTED_ARCHIVE_SHA256 = "179ea0f93250f48a055b08101c10e33497c72d8215c7aca869b47b79c2d81bd6";
const EXPECTED_MESHES = [
  "Tunnel_C_Jetway_0", "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0",
  "Cab_Jetway_0", "Cab_Glass_JW_0", "Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0",
];
const EXPECTED_IMAGES = [
  "Jetway_albedo.avif", "Jetway_metallic.avif", "Jetway_normal.avif", "Jetway_AO.avif",
  "Glass_JW_normal.avif", "Glass_JW_AO.avif", "Glass_JW_emissive.avif",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function payloadFromChunk(source, index) {
  const trimmed = source.trim();
  const separator = trimmed.indexOf("\n\n");
  const payload = separator >= 0 ? trimmed.slice(separator + 2) : trimmed;
  const encoded = payload.replace(/\s+/g, "");
  const expectedLength = index === CHUNK_COUNT - 1 ? 7_072 : 15_000;
  if (encoded.length !== expectedLength) {
    throw new Error(`Jetway source part ${index} expected ${expectedLength} characters, received ${encoded.length}`);
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error(`Jetway source part ${index} is not base64 text`);
  return encoded;
}

const encodedParts = [];
for (let index = 0; index < CHUNK_COUNT; index += 1) {
  const source = await readFile(path.join(CHUNK_ROOT, `part${String(index).padStart(3, "0")}.b64`), "utf8");
  const encoded = payloadFromChunk(source, index);
  console.log(`JETWAY_SOURCE_PART ${String(index).padStart(3, "0")} chars=${encoded.length} sha256=${sha256(Buffer.from(encoded))}`);
  encodedParts.push(encoded);
}
const encoded = encodedParts.join("");
if (encoded.length !== EXPECTED_ENCODED_CHARS) throw new Error(`Jetway source package length changed: ${encoded.length}`);
const archive = Buffer.from(encoded, "base64");
const archiveDigest = sha256(archive);
if (archive.length !== EXPECTED_ARCHIVE_BYTES || archiveDigest !== EXPECTED_ARCHIVE_SHA256) {
  throw new Error(`Jetway source archive mismatch: ${archive.length} bytes / ${archiveDigest}`);
}
if (archive.subarray(0, 6).toString("hex") !== "fd377a585a00") throw new Error("Jetway source archive is not an XZ stream");
const test = spawnSync("xz", ["-t"], { input: archive, encoding: null, maxBuffer: 8 * 1024 * 1024 });
if (test.error) throw test.error;
if (test.status !== 0) throw new Error(`Jetway source archive integrity failed: ${String(test.stderr || "").trim()}`);

await mkdir(path.dirname(ARCHIVE_PATH), { recursive: true });
await writeFile(ARCHIVE_PATH, archive);
await rm(OUTPUT_ROOT, { recursive: true, force: true });
await mkdir(OUTPUT_ROOT, { recursive: true });
const extract = spawnSync("tar", ["-xJf", ARCHIVE_PATH, "-C", OUTPUT_ROOT], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
if (extract.error) throw extract.error;
if (extract.status !== 0) throw new Error(`Jetway source extraction failed: ${extract.stderr.trim()}`);

const geometry = await readFile(path.join(OUTPUT_ROOT, "geometry.bin"));
const metadataLength = geometry.readUInt32LE(0);
const metadata = JSON.parse(geometry.subarray(4, 4 + metadataLength).toString("utf8"));
if (metadata.version !== 2 || metadata.authority !== "source-triangles-hierarchy-uvs-quant16-oct8-delta-varint-v2") {
  throw new Error("Jetway source geometry metadata authority changed");
}
if (metadata.meshes?.length !== 7 || metadata.validation?.triangleCount !== 31_978) {
  throw new Error(`Jetway source topology changed: meshes=${metadata.meshes?.length}, triangles=${metadata.validation?.triangleCount}`);
}
if (metadata.validation.maxPositionAbsErrorMeters > 0.0001 || metadata.validation.maxUvAbsError > 0.000008) {
  throw new Error(`Jetway source quantization exceeded visual tolerance: ${JSON.stringify(metadata.validation)}`);
}
const names = new Set(metadata.meshes.map((mesh) => mesh.name));
for (const name of EXPECTED_MESHES) if (!names.has(name)) throw new Error(`Jetway source geometry is missing ${name}`);
const descriptor = JSON.parse(await readFile(path.join(OUTPUT_ROOT, "materials.json"), "utf8"));
if (descriptor.materials?.length !== 2 || descriptor.images?.length !== 7 || descriptor.textures?.length !== 7) {
  throw new Error("Jetway source material or texture counts changed");
}
const files = new Set(await readdir(path.join(OUTPUT_ROOT, "images")));
for (const name of EXPECTED_IMAGES) {
  if (!files.has(name)) throw new Error(`Jetway source package is missing ${name}`);
  if ((await stat(path.join(OUTPUT_ROOT, "images", name))).size < 500) throw new Error(`Jetway source texture ${name} is unexpectedly small`);
}
for (let index = 0; index < 5; index += 1) await rm(path.resolve(`public/models/airport-jetway/geometry.part${index}`), { force: true });
await rm(path.resolve("public/models/airport-jetway/Airport_Jetway.glb"), { force: true });
console.log(`Materialized supplied Airport Jetway source: ${archive.length} bytes, sha256 ${archiveDigest}, 31,978 source triangles, seven UV meshes and seven full-resolution textures.`);
