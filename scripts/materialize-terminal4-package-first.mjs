import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SOURCE_OWNER = "TheMainlineCowboy";
const SOURCE_REPOSITORY = "SkyHarborPhx";
const SOURCE_COMMIT = "2e6642778c9c88eac6a82b21063763cc78be7cfe";
const ARCHIVE_URL = `https://codeload.github.com/${SOURCE_OWNER}/${SOURCE_REPOSITORY}/zip/${SOURCE_COMMIT}`;
const ARCHIVE_ROOT = path.resolve(`.cache/skyharborphx-source-archive/${SOURCE_COMMIT}`);
const ARCHIVE_PATH = path.join(ARCHIVE_ROOT, "source.zip");
const EXTRACT_ROOT = path.join(ARCHIVE_ROOT, "extracted");
const PACKAGE_ROOT = path.resolve(`.cache/skyharborphx-package/${SOURCE_COMMIT}`);
const MANIFEST_PATH = path.join(PACKAGE_ROOT, "rampready-package-manifest.json");
const REQUIRED_PACKAGE_FILES = Object.freeze([
  "scenery/term4.BGL",
  "scenery/KPHX_ADEX.BGL",
]);
const PACKAGE_FILE_PATTERN = /\.(?:bgl|bmp|dds|agn|mdl|xml|fx|ini)$/i;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const normalizeRelative = (value) => value.split(path.sep).join("/");

async function existingSize(filePath) {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if (error?.code === "ENOENT") return -1;
    throw error;
  }
}

async function downloadPinnedArchive() {
  await mkdir(ARCHIVE_ROOT, { recursive: true });
  const cachedSize = await existingSize(ARCHIVE_PATH);
  if (cachedSize > 1_000_000) return readFile(ARCHIVE_PATH);

  let finalError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(ARCHIVE_URL, {
        headers: {
          Accept: "application/zip",
          "User-Agent": "RampReady-Terminal4-Pinned-Archive-Mirror",
        },
        redirect: "follow",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length <= 1_000_000) {
        throw new Error(`archive was unexpectedly small (${bytes.length} bytes)`);
      }
      await writeFile(ARCHIVE_PATH, bytes);
      return bytes;
    } catch (error) {
      finalError = error;
      if (attempt < 4) await sleep(attempt * 1_250);
    }
  }
  throw new Error(`Pinned Terminal 4 source archive download failed after retries: ${finalError?.message || finalError}`);
}

function extractArchive() {
  const extractors = [
    ["unzip", ["-q", "-o", ARCHIVE_PATH, "-d", EXTRACT_ROOT]],
    ["tar", ["-xf", ARCHIVE_PATH, "-C", EXTRACT_ROOT]],
  ];
  for (const [command, args] of extractors) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (!result.error && result.status === 0) return;
  }
  throw new Error("Could not extract the pinned Sky Harbor source ZIP with unzip or tar");
}

async function walkFiles(root) {
  const results = [];
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) results.push(fullPath);
    }
  }
  await visit(root);
  return results;
}

function locatePackageRoot(extractedFiles) {
  const term4 = extractedFiles.find((filePath) => normalizeRelative(filePath).toLowerCase().endsWith("/scenery/term4.bgl"));
  if (!term4) throw new Error("Pinned Sky Harbor source archive is missing scenery/term4.BGL");
  const packageRoot = path.dirname(path.dirname(term4));
  for (const required of REQUIRED_PACKAGE_FILES) {
    const requiredPath = path.resolve(packageRoot, ...required.split("/"));
    const found = extractedFiles.some((candidate) => path.resolve(candidate).toLowerCase() === requiredPath.toLowerCase());
    if (!found) throw new Error(`Pinned Sky Harbor source archive is missing ${required}`);
  }
  return packageRoot;
}

const archiveBytes = await downloadPinnedArchive();
await rm(EXTRACT_ROOT, { recursive: true, force: true });
await mkdir(EXTRACT_ROOT, { recursive: true });
extractArchive();

const extractedFiles = await walkFiles(EXTRACT_ROOT);
const packageSourceRoot = locatePackageRoot(extractedFiles);
const packageEntries = extractedFiles
  .map((sourcePath) => ({
    sourcePath,
    path: normalizeRelative(path.relative(packageSourceRoot, sourcePath)),
  }))
  .filter((entry) => (
    entry.path.startsWith("scenery/")
    || entry.path.startsWith("texture/")
    || (!entry.path.includes("/") && PACKAGE_FILE_PATTERN.test(entry.path))
  ))
  .sort((a, b) => a.path.localeCompare(b.path));

if (!packageEntries.length) throw new Error("Pinned Sky Harbor source archive contains no mirrorable scenery or texture assets");

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
    const outputPath = path.resolve(PACKAGE_ROOT, ...entry.path.split("/"));
    if (outputPath !== PACKAGE_ROOT && !outputPath.startsWith(`${PACKAGE_ROOT}${path.sep}`)) {
      throw new Error(`Terminal 4 package path escaped cache root: ${entry.path}`);
    }
    await mkdir(path.dirname(outputPath), { recursive: true });
    const sourceBytes = await readFile(entry.sourcePath);
    if (await existingSize(outputPath) !== sourceBytes.length) await copyFile(entry.sourcePath, outputPath);
    else {
      const existingBytes = await readFile(outputPath);
      if (sha256(existingBytes) !== sha256(sourceBytes)) await copyFile(entry.sourcePath, outputPath);
    }
    mirrored[index] = {
      path: entry.path,
      sizeBytes: sourceBytes.length,
      sha256: sha256(sourceBytes),
      archiveSourcePath: normalizeRelative(path.relative(EXTRACT_ROOT, entry.sourcePath)),
    };
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));
const totalBytes = mirrored.reduce((sum, entry) => sum + entry.sizeBytes, 0);
const packageManifest = {
  schemaVersion: 2,
  sourceRepository: `${SOURCE_OWNER}/${SOURCE_REPOSITORY}`,
  sourceCommit: SOURCE_COMMIT,
  sourceArchiveUrl: ARCHIVE_URL,
  sourceArchiveSha256: sha256(archiveBytes),
  authority: "complete-pinned-source-archive-package-mirror-before-browser-conversion-v2",
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
runtimeManifest.packageSourceArchiveSha256 = packageManifest.sourceArchiveSha256;
runtimeManifest.packageFileCount = packageManifest.fileCount;
runtimeManifest.packageTotalBytes = packageManifest.totalBytes;
runtimeManifest.packageRequiredFiles = [...REQUIRED_PACKAGE_FILES];
await writeFile(runtimeManifestPath, `${JSON.stringify(runtimeManifest, null, 2)}\n`, "utf8");

console.log(`RampReady extracted and mirrored ${packageManifest.fileCount} pinned Sky Harbor package assets (${packageManifest.totalBytes} bytes) from the exact source ZIP before converting Terminal 4.`);
