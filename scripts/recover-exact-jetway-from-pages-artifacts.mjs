#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY || "TheMainlineCowboy/RampReady";
if (!token) throw new Error("GITHUB_TOKEN is required");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "public", "models", "airport-jetway", "Airport_Jetway.glb");
const expected = Object.freeze({
  bytes: 31_459_796,
  sha256: "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0",
});
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "RampReady-exact-jetway-pages-recovery",
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function extractArchive(file, directory) {
  const lower = file.toLowerCase();
  let command = null;
  let args = null;
  if (lower.endsWith(".zip")) {
    command = "unzip";
    args = ["-qq", "-o", file, "-d", directory];
  } else if (lower.endsWith(".tar") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) {
    command = "tar";
    args = ["-xf", file, "-C", directory];
  }
  if (!command) return false;
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0;
}

async function inspectTree(directory, label) {
  const extractedArchives = new Set();
  for (let pass = 0; pass < 4; pass += 1) {
    const files = await walk(directory);
    for (const file of files) {
      const info = await stat(file);
      const base = path.basename(file);
      if (/\.glb$/i.test(base) || info.size === expected.bytes) {
        const bytes = await readFile(file);
        const digest = sha256(bytes);
        console.log(`JETWAY_PAGES_FILE_CANDIDATE ${JSON.stringify({ artifact: label, file: path.relative(directory, file), bytes: bytes.length, sha256: digest })}`);
        if (bytes.length === expected.bytes && digest === expected.sha256) {
          await mkdir(path.dirname(destination), { recursive: true });
          await writeFile(destination, bytes);
          console.log(`JETWAY_PAGES_EXACT_RECOVERED ${JSON.stringify({ artifact: label, file: path.relative(directory, file), ...expected })}`);
          return true;
        }
      }
      if (!extractedArchives.has(file) && /\.(?:zip|tar|tar\.gz|tgz)$/i.test(base)) {
        extractedArchives.add(file);
        const nested = path.join(directory, `.expanded-${extractedArchives.size}`);
        await mkdir(nested, { recursive: true });
        if (!extractArchive(file, nested)) await rm(nested, { recursive: true, force: true });
      }
    }
  }
  return false;
}

async function listArtifacts() {
  const artifacts = [];
  for (let page = 1; page <= 30; page += 1) {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts?per_page=100&page=${page}`, { headers });
    if (!response.ok) throw new Error(`Artifact listing failed: HTTP ${response.status} ${await response.text()}`);
    const payload = await response.json();
    artifacts.push(...payload.artifacts);
    if (payload.artifacts.length < 100) break;
  }
  const start = Date.parse("2026-08-01T00:00:00Z");
  const end = Date.parse("2026-08-05T12:00:00Z");
  return artifacts
    .filter((artifact) => !artifact.expired)
    .filter((artifact) => {
      const created = Date.parse(artifact.created_at);
      return created >= start && created <= end;
    })
    .filter((artifact) => artifact.size_in_bytes >= 10_000_000)
    .filter((artifact) => /github-pages|pages|deployment|site(?:-|_)?build|dist(?:-|_)?bundle|vite(?:-|_)?build|production(?:-|_)?build/i.test(artifact.name))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

async function downloadArtifact(artifact, temp) {
  const response = await fetch(artifact.archive_download_url, { headers, redirect: "follow" });
  if (!response.ok) {
    console.log(`JETWAY_PAGES_DOWNLOAD_SKIPPED ${artifact.id} HTTP_${response.status}`);
    return null;
  }
  const archive = path.join(temp, `${artifact.id}.zip`);
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  const extracted = path.join(temp, String(artifact.id));
  await mkdir(extracted, { recursive: true });
  if (!extractArchive(archive, extracted)) {
    console.log(`JETWAY_PAGES_UNZIP_SKIPPED ${artifact.id}`);
    return null;
  }
  return extracted;
}

async function main() {
  try {
    const existing = await readFile(destination);
    if (existing.length === expected.bytes && sha256(existing) === expected.sha256) {
      console.log(`JETWAY_PAGES_EXACT_ALREADY_PRESENT ${expected.bytes} ${expected.sha256}`);
      return;
    }
  } catch {}

  const artifacts = await listArtifacts();
  console.log(`JETWAY_PAGES_CANDIDATE_COUNT ${artifacts.length}`);
  for (const artifact of artifacts.slice(0, 50)) {
    console.log(`JETWAY_PAGES_CANDIDATE ${JSON.stringify({ id: artifact.id, name: artifact.name, size: artifact.size_in_bytes, createdAt: artifact.created_at, branch: artifact.workflow_run?.head_branch, sha: artifact.workflow_run?.head_sha, runId: artifact.workflow_run?.id })}`);
  }

  const temp = await mkdtemp(path.join(os.tmpdir(), "rampready-pages-artifacts-"));
  try {
    const chosen = [];
    for (const artifact of artifacts) {
      const key = `${artifact.name}:${artifact.workflow_run?.head_branch || ""}:${artifact.workflow_run?.head_sha || ""}`;
      if (chosen.some((entry) => entry.key === key)) continue;
      chosen.push({ key, artifact });
      if (chosen.length >= 24) break;
    }
    for (const { artifact } of chosen) {
      console.log(`JETWAY_PAGES_SCANNING ${JSON.stringify({ id: artifact.id, name: artifact.name, size: artifact.size_in_bytes, createdAt: artifact.created_at, branch: artifact.workflow_run?.head_branch, sha: artifact.workflow_run?.head_sha })}`);
      const extracted = await downloadArtifact(artifact, temp);
      if (!extracted) continue;
      if (await inspectTree(extracted, `artifact:${artifact.id}:${artifact.name}`)) return;
      await rm(extracted, { recursive: true, force: true });
      await rm(path.join(temp, `${artifact.id}.zip`), { force: true });
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
  console.log(`JETWAY_PAGES_EXACT_NOT_FOUND ${expected.bytes} ${expected.sha256}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
