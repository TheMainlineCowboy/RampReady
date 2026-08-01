import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SOURCE_OWNER = "TheMainlineCowboy";
const SOURCE_REPOSITORY = "SkyHarborPhx";
const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const PACKAGE_ROOT = path.resolve(`.cache/skyharborphx-package/${SOURCE_COMMIT}`);
const MANIFEST_PATH = path.join(PACKAGE_ROOT, "rampready-package-manifest.json");
const REQUIRED_PACKAGE_FILES = Object.freeze([
  "scenery/term4.BGL",
  "scenery/KPHX_ADEX.BGL",
]);
const PACKAGE_FILE_PATTERN = /\.(?:bgl|bmp|dds|agn|mdl|xml|fx|ini)$/i;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function rawUrl(relativePath) {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${SOURCE_OWNER}/${SOURCE_REPOSITORY}/${SOURCE_COMMIT}/${encoded}`;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "RampReady-Terminal4-Package-Mirror",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`Terminal 4 package tree request failed: HTTP ${response.status}`);
  return response.json();
}

async function download(relativePath) {
  const response = await fetch(rawUrl(relativePath), {
    headers: { "User-Agent": "RampReady-Terminal4-Package-Mirror" },
  });
  if (!response.ok) throw new Error(`Terminal 4 package download failed for ${relativePath}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function existingSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if (error?.code === "ENOENT") return -1;
    throw error;
  }
}

const treeUrl = `https://api.github.com/repos/${SOURCE_OWNER}/${SOURCE_REPOSITORY}/git/trees/${SOURCE_COMMIT}?recursive=1`;
const treeResponse = await fetchJson(treeUrl);
if (treeResponse.truncated) throw new Error("Terminal 4 source tree response was truncated");

const packageEntries = (treeResponse.tree || [])
  .filter((entry) => entry.type === "blob")
  .filter((entry) => (
    entry.path.startsWith("scenery/")
    || entry.path.startsWith("texture/")
    || (!entry.path.includes("/") && PACKAGE_FILE_PATTERN.test(entry.path))
  ))
  .sort((a, b) => a.path.localeCompare(b.path));

if (!packageEntries.length) throw new Error("Pinned Sky Harbor package contains no mirrorable scenery or texture assets");
for (const required of REQUIRED_PACKAGE_FILES) {
  if (!packageEntries.some((entry) => entry.path.toLowerCase() === required.toLowerCase())) {
    throw new Error(`Pinned Sky Harbor package is missing ${required}`);
  }
}

await mkdir(PACKAGE_ROOT, { recursive: true });
const mirrored = new Array(packageEntries.length);
let nextIndex = 0;
const workerCount = Math.min(8, packageEntries.length);

async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= packageEntries.length) return;
    const entry = packageEntries[index];
    const outputPath = path.resolve(PACKAGE_ROOT, entry.path);
    if (outputPath !== PACKAGE_ROOT && !outputPath.startsWith(`${PACKAGE_ROOT}${path.sep}`)) {
      throw new Error(`Terminal 4 package path escaped cache root: ${entry.path}`);
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    let bytes;
    if (await existingSize(outputPath) === entry.size) bytes = await readFile(outputPath);
    else {
      bytes = await download(entry.path);
      if (bytes.length !== entry.size) {
        throw new Error(`Terminal 4 package size mismatch for ${entry.path}: ${bytes.length} != ${entry.size}`);
      }
      await writeFile(outputPath, bytes);
    }
    mirrored[index] = {
      path: entry.path,
      sizeBytes: bytes.length,
      gitBlobSha: entry.sha,
      sha256: sha256(bytes),
    };
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));
const totalBytes = mirrored.reduce((sum, entry) => sum + entry.sizeBytes, 0);
const packageManifest = {
  schemaVersion: 1,
  sourceRepository: `${SOURCE_OWNER}/${SOURCE_REPOSITORY}`,
  sourceCommit: SOURCE_COMMIT,
  authority: "complete-pinned-scenery-and-texture-package-mirror-before-browser-conversion-v1",
  requiredFiles: REQUIRED_PACKAGE_FILES,
  fileCount: mirrored.length,
  totalBytes,
  files: mirrored,
};
const manifestText = `${JSON.stringify(packageManifest, null, 2)}\n`;
await writeFile(MANIFEST_PATH, manifestText, "utf8");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const hookPath = path.join(scriptDirectory, "install-terminal4-package-fetch-hook.mjs");
const materializerPath = path.join(scriptDirectory, "materialize-phx-terminal4.mjs");
const result = spawnSync(process.execPath, ["--import", hookPath, materializerPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    RAMPREADY_TERMINAL4_PACKAGE_ROOT: PACKAGE_ROOT,
    RAMPREADY_TERMINAL4_SOURCE_COMMIT: SOURCE_COMMIT,
  },
  timeout: 240_000,
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Package-first Terminal 4 conversion failed with exit code ${result.status}`);

const runtimeManifestPath = path.resolve("public/models/phx-terminal4/runtime-manifest.json");
const runtimeManifest = JSON.parse(await readFile(runtimeManifestPath, "utf8"));
runtimeManifest.packageImportAuthority = packageManifest.authority;
runtimeManifest.packageManifestSha256 = sha256(Buffer.from(manifestText));
runtimeManifest.packageFileCount = packageManifest.fileCount;
runtimeManifest.packageTotalBytes = packageManifest.totalBytes;
runtimeManifest.packageRequiredFiles = [...REQUIRED_PACKAGE_FILES];
await writeFile(runtimeManifestPath, `${JSON.stringify(runtimeManifest, null, 2)}\n`, "utf8");

console.log(`RampReady mirrored ${packageManifest.fileCount} pinned Sky Harbor package assets (${packageManifest.totalBytes} bytes) before converting Terminal 4.`);
