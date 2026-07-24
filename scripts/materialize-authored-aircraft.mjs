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

function normalizeBase64(text) {
  return text.replace(/\s+/g, "");
}

async function readExactPart(part, index) {
  const partUrl = new URL(part.path, repoRoot);
  try {
    const direct = normalizeBase64(await readFile(partUrl, "utf8"));
    if (direct.length === part.charLength && sha256(Buffer.from(direct, "utf8")) === part.sha256) {
      return direct;
    }
  } catch {
    // Fall through to repository-safe shards.
  }

  const shardBase = `${part.path}.shards/`;
  const shards = [];
  for (let shardIndex = 0; shardIndex < 8; shardIndex += 1) {
    const shardPath = `${shardBase}shard-${String(shardIndex).padStart(3, "0")}.b64`;
    try {
      const shard = normalizeBase64(await readFile(new URL(shardPath, repoRoot), "utf8"));
      if (!shard) throw new Error(`empty shard ${shardPath}`);
      shards.push(shard);
    } catch (error) {
      if (shardIndex === 0) {
        throw new Error(`Missing or invalid authored-aircraft part ${index}: ${part.path}; no verified shards found`, { cause: error });
      }
      break;
    }
  }

  const reconstructed = shards.join("");
  if (reconstructed.length !== part.charLength) {
    throw new Error(`Authored-aircraft part ${index} reconstructed to ${reconstructed.length} characters; expected ${part.charLength}`);
  }
  if (sha256(Buffer.from(reconstructed, "utf8")) !== part.sha256) {
    throw new Error(`Authored-aircraft part ${index} reconstructed hash mismatch`);
  }
  return reconstructed;
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
  encodedParts.push(await readExactPart(part, index));
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
