import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";

const repoRoot = new URL("../", import.meta.url);
const manifestUrl = new URL("assets/aircraft/crj700-user.parts.json", repoRoot);
const compressedUrl = new URL("assets/aircraft/crj700-user.glb.br", repoRoot);
const v4PartsBase = "assets/aircraft/crj700-user-v4.glb.br.parts/";
const outputUrl = new URL("public/models/crj700-user.glb", repoRoot);
const metadataUrl = new URL("public/models/crj700-user.asset.json", repoRoot);

const recoveryGroups = [
  { start: 59, end: 63, path: "assets/aircraft/recovery-tail-059-063.b64" },
  { start: 64, end: 68, path: "assets/aircraft/recovery-tail-064-068.b64" },
  { start: 69, end: 73, path: "assets/aircraft/recovery-tail-069-073.b64" },
  { start: 74, end: 78, path: "assets/aircraft/recovery-tail-074-078.b64" },
];

const knownSingleCharacterRepairs = new Map([
  [22, { offset: 3702, value: "u" }],
  [29, { offset: 7394, value: "Z" }],
  [48, { offset: 6448, value: "9" }],
  [53, { offset: 6369, value: "V" }],
]);

const part56TailPrefix = "vQnNwMgkLGyc5xZ2HjWduZnJzxRQIRV";
const part56ExactPrefixLength = 7040;
const part56RecoveryCandidates = [
  "assets/aircraft/recovery-tail/recovery-00.b64",
  "assets/aircraft/recovered-compressed/part-00.b64",
  "assets/aircraft/crj700-user.glb.br.b64",
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeBase64(text) {
  return text.replace(/\s+/g, "");
}

function validatePart(text, part) {
  return text.length === part.charLength && sha256(Buffer.from(text, "utf8")) === part.sha256;
}

async function tryKnownRepair(direct, part, index) {
  const repair = knownSingleCharacterRepairs.get(index);
  if (repair && direct.length === part.charLength) {
    const repaired = `${direct.slice(0, repair.offset)}${repair.value}${direct.slice(repair.offset + 1)}`;
    if (validatePart(repaired, part)) return { ok: true, text: repaired, mode: "verified-single-character-repair" };
  }

  if (index === 56 && direct.length >= part56ExactPrefixLength) {
    const prefix = direct.slice(0, part56ExactPrefixLength);
    for (const path of part56RecoveryCandidates) {
      try {
        const candidate = normalizeBase64(await readFile(new URL(path, repoRoot), "utf8"));
        const start = candidate.indexOf(part56TailPrefix);
        if (start < 0) continue;
        const tailLength = part.charLength - part56ExactPrefixLength;
        const tail = candidate.slice(start, start + tailLength);
        const repaired = prefix + tail;
        if (validatePart(repaired, part)) {
          return { ok: true, text: repaired, mode: `verified-recovery-tail:${path}` };
        }
      } catch {}
    }
  }
  return null;
}

async function inspectRecoveryGroup(part, index, manifest) {
  const group = recoveryGroups.find((entry) => index >= entry.start && index <= entry.end);
  if (!group) return null;
  try {
    const encoded = normalizeBase64(await readFile(new URL(group.path, repoRoot), "utf8"));
    const expectedLength = manifest.parts
      .slice(group.start, group.end + 1)
      .reduce((sum, entry) => sum + entry.charLength, 0);
    if (encoded.length !== expectedLength) {
      return { ok: false, error: `recovery group ${group.path} length ${encoded.length}/${expectedLength}` };
    }
    let offset = 0;
    for (let cursor = group.start; cursor <= group.end; cursor += 1) {
      const current = manifest.parts[cursor];
      const text = encoded.slice(offset, offset + current.charLength);
      if (!validatePart(text, current)) {
        return { ok: false, error: `recovery group ${group.path} failed exact validation at part ${String(cursor).padStart(3, "0")}` };
      }
      if (cursor === index) return { ok: true, text, mode: `recovery-group:${group.path}` };
      offset += current.charLength;
    }
  } catch (error) {
    return { ok: false, error: `recovery group ${group.path} missing (${error.code || error.message})` };
  }
  return null;
}

async function inspectExactPart(part, index, manifest) {
  const partUrl = new URL(part.path, repoRoot);
  const directProblems = [];
  let direct = "";
  try {
    direct = normalizeBase64(await readFile(partUrl, "utf8"));
    const directHash = sha256(Buffer.from(direct, "utf8"));
    if (direct.length === part.charLength && directHash === part.sha256) {
      return { ok: true, text: direct, mode: "direct" };
    }
    if (direct.length !== part.charLength) directProblems.push(`direct length ${direct.length}/${part.charLength}`);
    if (directHash !== part.sha256) directProblems.push(`direct sha256 ${directHash}/${part.sha256}`);

    const knownRepair = await tryKnownRepair(direct, part, index);
    if (knownRepair?.ok) return knownRepair;
  } catch (error) {
    directProblems.push(`direct missing (${error.code || error.message})`);
  }

  const shardBase = `${part.path}.shards/`;
  const shards = [];
  const shardProblems = [];
  for (let shardIndex = 0; shardIndex < 8; shardIndex += 1) {
    const shardPath = `${shardBase}shard-${String(shardIndex).padStart(3, "0")}.b64`;
    try {
      const shard = normalizeBase64(await readFile(new URL(shardPath, repoRoot), "utf8"));
      if (!shard) {
        shardProblems.push(`${shardPath} is empty`);
        break;
      }
      shards.push(shard);
    } catch (error) {
      if (shardIndex === 0) shardProblems.push(`no shards (${error.code || error.message})`);
      break;
    }
  }

  const reconstructed = shards.join("");
  if (reconstructed.length === part.charLength) {
    const reconstructedHash = sha256(Buffer.from(reconstructed, "utf8"));
    if (reconstructedHash === part.sha256) {
      return { ok: true, text: reconstructed, mode: `shards:${shards.length}` };
    }
    shardProblems.push(`shard sha256 ${reconstructedHash}/${part.sha256}`);
  } else if (shards.length > 0) {
    shardProblems.push(`shard length ${reconstructed.length}/${part.charLength}`);
  }

  const recovered = await inspectRecoveryGroup(part, index, manifest);
  if (recovered?.ok) return recovered;
  if (recovered?.error) shardProblems.push(recovered.error);

  return {
    ok: false,
    index,
    path: part.path,
    error: [...directProblems, ...shardProblems].join("; "),
  };
}

async function tryV4Payload(manifest) {
  const parts = [];
  for (let index = 0; index < 9; index += 1) {
    const path = `${v4PartsBase}part-${String(index).padStart(3, "0")}.b64`;
    try {
      const text = normalizeBase64(await readFile(new URL(path, repoRoot), "utf8"));
      if (!text) return { compressed: null, detail: `${path} is empty` };
      parts.push(text);
    } catch (error) {
      return { compressed: null, detail: `${path} missing (${error.code || error.message})` };
    }
  }

  const encoded = parts.join("");
  let compressed;
  try {
    compressed = Buffer.from(encoded, "base64");
  } catch (error) {
    return { compressed: null, detail: `base64 decode failed (${error.message})` };
  }
  const hash = sha256(compressed);
  if (compressed.byteLength !== manifest.compressedByteLength || hash !== manifest.compressedSha256) {
    return {
      compressed: null,
      detail: `v4 payload decoded to ${compressed.byteLength} bytes sha256 ${hash}; expected ${manifest.compressedByteLength} bytes sha256 ${manifest.compressedSha256}`,
    };
  }
  return { compressed, detail: `9 v4 parts, ${encoded.length} base64 characters` };
}

const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
if (manifest.version !== 1 || manifest.encoding !== "base64-concatenated-brotli") {
  throw new Error("Unsupported authored-aircraft repository manifest");
}
if (!Array.isArray(manifest.parts) || manifest.parts.length !== manifest.partCount || manifest.partCount !== 79) {
  throw new Error(`Authored aircraft manifest is invalid; expected 79 legacy parts, found ${manifest.parts?.length ?? 0}`);
}

let compressed;
let sourceMode = "exact-compressed-blob";
const sourceProblems = [];
try {
  const directCompressed = await readFile(compressedUrl);
  const directHash = sha256(directCompressed);
  if (directCompressed.byteLength === manifest.compressedByteLength && directHash === manifest.compressedSha256) {
    compressed = directCompressed;
  } else {
    sourceProblems.push(`direct compressed source is ${directCompressed.byteLength} bytes sha256 ${directHash}`);
  }
} catch (error) {
  sourceProblems.push(`direct compressed source missing (${error.code || error.message})`);
}

if (!compressed) {
  const v4 = await tryV4Payload(manifest);
  if (v4.compressed) {
    compressed = v4.compressed;
    sourceMode = "committed-v4-parts";
    await writeFile(compressedUrl, compressed);
    console.log(`Reconstructed exact compressed authored aircraft from ${v4.detail}.`);
  } else {
    sourceProblems.push(v4.detail);
  }
}

if (!compressed) {
  sourceMode = "verified-repository-recovery";
  const inspections = await Promise.all(manifest.parts.map((part, index) => inspectExactPart(part, index, manifest)));
  const failures = inspections.filter((entry) => !entry.ok);
  if (failures.length) {
    const lines = failures.map((entry) => `part ${String(entry.index).padStart(3, "0")} ${entry.path}: ${entry.error}`);
    throw new Error(`Authored-aircraft payload could not be reconstructed. Source attempts: ${sourceProblems.join(" | ")}. Legacy payload is incomplete or invalid (${failures.length}/${manifest.partCount} parts):\n${lines.join("\n")}`);
  }

  const encoded = inspections.map((entry) => entry.text).join("");
  if (encoded.length !== manifest.totalBase64Characters) {
    throw new Error(`Authored-aircraft base64 stream has ${encoded.length} characters; expected ${manifest.totalBase64Characters}`);
  }
  compressed = Buffer.from(encoded, "base64");
  if (compressed.byteLength !== manifest.compressedByteLength || sha256(compressed) !== manifest.compressedSha256) {
    throw new Error("Authored-aircraft compressed stream identity mismatch");
  }
  await writeFile(compressedUrl, compressed);
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
console.log(`Authored aircraft source audit passed via ${sourceMode}.`);
console.log(`Materialized authored American Eagle aircraft: ${glb.byteLength} bytes, sha256 ${manifest.glbSha256}`);
