import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_LEKTRO_SCAN_FILES = ["3DModel.obj", "3DModel.mtl", "3DModel.jpg"];

async function isDirectory(candidate) {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function inspectDirectory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  if (!REQUIRED_LEKTRO_SCAN_FILES.every((name) => names.has(name))) return null;

  const files = {};
  for (const name of REQUIRED_LEKTRO_SCAN_FILES) {
    const filePath = path.join(directory, name);
    const info = await stat(filePath);
    files[name] = {
      bytes: info.size,
      sha256: await sha256File(filePath),
    };
  }
  return { directory: path.resolve(directory), files };
}

export async function locateLektroScanSources(roots, { maxDepth = 4 } = {}) {
  const queue = [];
  for (const root of roots.map((value) => path.resolve(value))) {
    if (await isDirectory(root)) queue.push({ directory: root, depth: 0 });
  }

  const visited = new Set();
  const matches = [];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current.directory)) continue;
    visited.add(current.directory);

    const match = await inspectDirectory(current.directory);
    if (match) matches.push(match);
    if (current.depth >= maxDepth) continue;

    const entries = await readdir(current.directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
      queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
    }
  }

  return matches.sort((a, b) => a.directory.localeCompare(b.directory));
}

function parseArguments(argv) {
  const roots = [];
  let output = "artifacts/lektro-scan/source-discovery.json";
  let maxDepth = 4;
  let allowMissing = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--output") output = argv[++index];
    else if (value === "--max-depth") maxDepth = Number(argv[++index]);
    else if (value === "--allow-missing") allowMissing = true;
    else roots.push(value);
  }
  if (!roots.length) roots.push(process.cwd());
  return { roots, output, maxDepth, allowMissing };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new Error("--max-depth must be a non-negative integer");
  }
  const matches = await locateLektroScanSources(options.roots, { maxDepth: options.maxDepth });
  const report = {
    schemaVersion: 2,
    hashAlgorithm: "sha256",
    requiredFiles: REQUIRED_LEKTRO_SCAN_FILES,
    searchedRoots: options.roots.map((value) => path.resolve(value)),
    maxDepth: options.maxDepth,
    matches,
    found: matches.length > 0,
    generatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(path.resolve(options.output)), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, { flag: "w" });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.found && !options.allowMissing) {
    throw new Error("No complete KIRI scan package found. Expected 3DModel.obj, 3DModel.mtl, and 3DModel.jpg in one directory.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
