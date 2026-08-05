#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY || "TheMainlineCowboy/RampReady";
if (!token) throw new Error("GITHUB_TOKEN is required");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "public", "models", "airport-jetway");
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
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-exact-jetway-artifact-recovery",
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exact(bytes) {
  return bytes.length === expectedGlb.bytes && sha256(bytes) === expectedGlb.sha256;
}

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Recovered exact file is not a GLB");
  if (bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Recovered exact GLB header is invalid");
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
  if (!json || !binary) throw new Error("Recovered exact GLB is missing JSON or BIN data");
  return { json, binary };
}

async function finalizeExact(bytes, source) {
  const { json, binary } = parseGlb(bytes);
  if (json.meshes?.length !== 7 || json.materials?.length !== 2 || json.images?.length !== 7) {
    throw new Error(`Recovered GLB structure mismatch: ${json.meshes?.length}/${json.materials?.length}/${json.images?.length}`);
  }
  const embeddedImages = json.images.map((image, index) => {
    const view = json.bufferViews?.[image.bufferView];
    if (!view) throw new Error(`Recovered GLB image ${index} is missing its bufferView`);
    const imageBytes = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    return { index, image, bytes: imageBytes, sha256: sha256(imageBytes) };
  });

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputGlb, bytes);
  const textures = [];
  for (const expected of expectedImages) {
    const match = embeddedImages.find((candidate) => candidate.bytes.length === expected.bytes && candidate.sha256 === expected.sha256);
    if (!match) throw new Error(`Recovered exact GLB is missing texture ${expected.file}`);
    await writeFile(path.join(outputDir, expected.file), match.bytes);
    textures.push({ file: expected.file, bytes: match.bytes.length, sha256: match.sha256, glbImageIndex: match.index, mimeType: match.image.mimeType });
  }
  await writeFile(path.join(outputDir, "exact-asset-manifest.json"), `${JSON.stringify({
    authority: "exact-uploaded-airport-jetway-glb-sha256-v1",
    recoveredFrom: source,
    glb: { file: "Airport_Jetway.glb", ...expectedGlb },
    structure: { meshes: json.meshes.length, materials: json.materials.length, images: json.images.length },
    textures,
  }, null, 2)}\n`);
  console.log(`JETWAY_ACTIONS_EXACT_RECOVERED ${JSON.stringify({ source, ...expectedGlb })}`);
}

async function listArtifacts() {
  const artifacts = [];
  for (let page = 1; page <= 25; page += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`, { headers });
    if (!response.ok) throw new Error(`Artifact listing failed: HTTP ${response.status} ${await response.text()}`);
    const payload = await response.json();
    artifacts.push(...payload.artifacts);
    if (payload.artifacts.length < 100) break;
  }
  const preferredBranches = /fix\/exact-airport-jetway-glb|agent\/fix-supplied-jetway-articulation-v10|agent\/fix-a1-live-door-placement|agent\/fix-terminal4-jetway-geometry/;
  const preferredNames = /exact-supplied-jetway-articulation|source-first-a1-repair|kphx-v181-runtime-evidence|crj700-runtime-evidence/;
  return artifacts
    .filter((artifact) => !artifact.expired && artifact.size_in_bytes >= 15_000_000)
    .filter((artifact) => preferredBranches.test(artifact.workflow_run?.head_branch || "") && preferredNames.test(artifact.name))
    .sort((a, b) => {
      const exactNameA = /^exact-supplied-jetway-articulation/.test(a.name) ? 0 : 1;
      const exactNameB = /^exact-supplied-jetway-articulation/.test(b.name) ? 0 : 1;
      const exactBranchA = a.workflow_run?.head_branch === "fix/exact-airport-jetway-glb" ? 0 : 1;
      const exactBranchB = b.workflow_run?.head_branch === "fix/exact-airport-jetway-glb" ? 0 : 1;
      return exactNameA - exactNameB || exactBranchA - exactBranchB || Date.parse(b.created_at) - Date.parse(a.created_at);
    });
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function inspectExtracted(directory, label) {
  let nestedIndex = 0;
  for (const file of await walk(directory)) {
    const fileStat = await stat(file);
    if (/\.glb$/i.test(file) || fileStat.size === expectedGlb.bytes) {
      const bytes = await readFile(file);
      const digest = sha256(bytes);
      console.log(`JETWAY_ACTIONS_FILE_CANDIDATE ${JSON.stringify({ artifact: label, file: path.relative(directory, file), bytes: bytes.length, sha256: digest })}`);
      if (bytes.length === expectedGlb.bytes && digest === expectedGlb.sha256) {
        await finalizeExact(bytes, `${label}:${path.relative(directory, file)}`);
        return true;
      }
    }
    if (/\.zip$/i.test(file) && nestedIndex < 10) {
      const nestedDir = path.join(directory, `.nested-${nestedIndex++}`);
      await mkdir(nestedDir, { recursive: true });
      const nested = spawnSync("unzip", ["-qq", "-o", file, "-d", nestedDir], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
      if (nested.status === 0 && await inspectExtracted(nestedDir, `${label}:nested:${path.basename(file)}`)) return true;
    }
  }
  return false;
}

async function downloadArtifact(artifact, directory) {
  const response = await fetch(artifact.archive_download_url, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`Artifact ${artifact.id} download failed: HTTP ${response.status} ${await response.text()}`);
  const zipPath = path.join(directory, `${artifact.id}.zip`);
  await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  const extractDir = path.join(directory, String(artifact.id));
  await mkdir(extractDir, { recursive: true });
  const result = spawnSync("unzip", ["-qq", "-o", zipPath, "-d", extractDir], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Artifact ${artifact.id} unzip failed: ${result.stderr || result.status}`);
  return extractDir;
}

async function main() {
  try {
    const existing = await readFile(outputGlb);
    if (exact(existing)) {
      await finalizeExact(existing, "already-present-runtime-file");
      return;
    }
  } catch {}

  const artifacts = await listArtifacts();
  console.log(`JETWAY_ACTIONS_RECOVERY_CANDIDATES ${artifacts.length}`);
  const temp = await mkdtemp(path.join(os.tmpdir(), "rampready-jetway-artifacts-"));
  try {
    const selected = [];
    for (const artifact of artifacts) {
      const family = artifact.name.replace(/-[0-9a-f]{40}$/i, "");
      const branch = artifact.workflow_run?.head_branch || "unknown";
      if (selected.some((item) => item.family === family && item.branch === branch)) continue;
      selected.push({ family, branch, artifact });
      if (selected.length >= 8) break;
    }
    for (const { artifact } of selected) {
      console.log(`JETWAY_ACTIONS_SCANNING ${JSON.stringify({ id: artifact.id, name: artifact.name, size: artifact.size_in_bytes, branch: artifact.workflow_run?.head_branch, sha: artifact.workflow_run?.head_sha })}`);
      const extracted = await downloadArtifact(artifact, temp);
      if (await inspectExtracted(extracted, `artifact:${artifact.id}:${artifact.name}`)) return;
      await rm(extracted, { recursive: true, force: true });
      await rm(path.join(temp, `${artifact.id}.zip`), { force: true });
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  console.log(`JETWAY_ACTIONS_EXACT_NOT_FOUND ${expectedGlb.bytes} ${expectedGlb.sha256}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
