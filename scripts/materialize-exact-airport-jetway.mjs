#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingDir = path.join(repoRoot, ".jetway-geometry-staging-v2");
const outputDir = path.join(repoRoot, "public", "models", "airport-jetway");
const outputGlb = path.join(outputDir, "Airport_Jetway.glb");
const expectedGlb = Object.freeze({
  bytes: 31_459_796,
  sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0",
});
const expectedImages = Object.freeze([
  { file: "Jetway_albedo.jpg", bytes: 4_374_151, sha256: "ded6dbad1930417349bd11a2b22de6f5aa6c89a0b9ef8241b1978ea092f37ed0" },
  { file: "Jetway_metallic.png", bytes: 9_300_055, sha256: "7deac7f078fd2ea28dcd6a88d47a9b2baf55503c7730c3b6846afb11178b7b8c" },
  { file: "Jetway_normal.png", bytes: 10_763_430, sha256: "9319dca63343e55ade0be00f06facf9cbc26dabb432f21240e9aa9781b53a6b1" },
  { file: "Jetway_AO.jpg", bytes: 3_529_816, sha256: "85f8368e13fcf27b7eab3d9b19a554065311df0980566a8e2c8fb3690391011c" },
  { file: "Glass_JW_normal.png", bytes: 1_107_961, sha256: "823cf53bfeaf1bb11fdcfbb7235a456032e5e7d4bea07e2901354ba9e923e794" },
  { file: "Glass_JW_AO.jpg", bytes: 88_646, sha256: "391d039485a6139ddd3f82b97455970c897410f031320e0f04ef1c690415fe13" },
  { file: "Glass_JW_emissive.jpg", bytes: 185_984, sha256: "b04433a9724729d969bb8fee1b6ffc7c452773a228bbf13b44d1696fdff4cce9" },
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireIdentity(label, bytes, expected) {
  const actual = { bytes: bytes.length, sha256: sha256(bytes) };
  if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
    throw new Error(`${label} identity mismatch: ${actual.bytes}/${actual.sha256}; expected ${expected.bytes}/${expected.sha256}`);
  }
  return actual;
}

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Airport_Jetway.glb is missing the glTF binary magic");
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`Airport_Jetway.glb uses unsupported GLB version ${bytes.readUInt32LE(4)}`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("Airport_Jetway.glb header length does not match its exact byte length");
  let cursor = 12;
  let json = null;
  let binary = null;
  while (cursor + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const payload = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(payload.toString("utf8").replace(/\u0000+$/g, "").trimEnd());
    if (type === 0x004e4942) binary = payload;
    cursor += 8 + length;
  }
  if (!json || !binary) throw new Error("Airport_Jetway.glb is missing its JSON or BIN chunk");
  return { json, binary };
}

async function main() {
  const partNames = (await readdir(stagingDir))
    .filter((name) => /^part\d{3}\.b64$/.test(name))
    .sort();
  if (partNames.length !== 25 || partNames[0] !== "part000.b64" || partNames.at(-1) !== "part024.b64") {
    throw new Error(`Exact jetway transfer requires part000.b64 through part024.b64; found ${partNames.length} parts`);
  }

  const encodedParts = await Promise.all(partNames.map(async (name) =>
    (await readFile(path.join(stagingDir, name), "utf8")).replace(/\s+/g, ""),
  ));
  const compressed = Buffer.from(encodedParts.join(""), "base64");
  if (compressed.subarray(0, 6).toString("hex") !== "fd377a585a00") {
    throw new Error("Exact jetway staged stream is not the expected XZ payload");
  }

  const decompressed = spawnSync("xz", ["--decompress", "--stdout"], {
    input: compressed,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (decompressed.status !== 0) {
    throw new Error(`XZ reconstruction failed: ${decompressed.stderr?.toString("utf8") || `status ${decompressed.status}`}`);
  }
  const glb = Buffer.from(decompressed.stdout);
  const glbIdentity = requireIdentity("Airport_Jetway.glb", glb, expectedGlb);
  const { json, binary } = parseGlb(glb);

  if (json.meshes?.length !== 7 || json.materials?.length !== 2 || json.images?.length !== 7) {
    throw new Error(`Exact GLB structure mismatch: meshes=${json.meshes?.length}, materials=${json.materials?.length}, images=${json.images?.length}`);
  }

  const embeddedImages = (json.images || []).map((image, index) => {
    const view = json.bufferViews?.[image.bufferView];
    if (!view) throw new Error(`Embedded image ${index} has no valid bufferView`);
    const bytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    return { index, image, bytes, identity: { bytes: bytes.length, sha256: sha256(bytes) } };
  });

  await mkdir(outputDir, { recursive: true });
  await rm(outputGlb, { force: true });
  await writeFile(outputGlb, glb);

  const extracted = [];
  for (const expected of expectedImages) {
    const match = embeddedImages.find((candidate) =>
      candidate.identity.bytes === expected.bytes && candidate.identity.sha256 === expected.sha256,
    );
    if (!match) throw new Error(`Exact embedded texture is missing or mismatched: ${expected.file}`);
    const destination = path.join(outputDir, expected.file);
    await writeFile(destination, match.bytes);
    extracted.push({ file: expected.file, ...match.identity, glbImageIndex: match.index, mimeType: match.image.mimeType });
  }

  const manifest = {
    authority: "exact-uploaded-airport-jetway-glb-sha256-v1",
    sourceParts: partNames,
    glb: { file: "Airport_Jetway.glb", ...glbIdentity },
    structure: { meshes: json.meshes.length, materials: json.materials.length, images: json.images.length },
    textures: extracted,
  };
  await writeFile(path.join(outputDir, "exact-asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[exact-airport-jetway] Materialized ${manifest.glb.file}: ${manifest.glb.bytes} bytes ${manifest.glb.sha256}`);
  console.log(`[exact-airport-jetway] Verified ${manifest.structure.meshes} meshes, ${manifest.structure.materials} materials, and ${manifest.structure.images} exact embedded textures.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
