import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [, , libraryRootArg, requestPathArg, outputPathArg, ...optionArgs] = process.argv;
if (!libraryRootArg || !requestPathArg || !outputPathArg) {
  throw new Error("Usage: node scripts/resolve-xplane-library.mjs <library-root> <requested-resources.json> <output-map.json> [--virtual-prefix=ZDP_Library]");
}

const options = Object.fromEntries(optionArgs
  .filter((entry) => entry.startsWith("--") && entry.includes("="))
  .map((entry) => {
    const [key, ...value] = entry.slice(2).split("=");
    return [key, value.join("=")];
  }));

const libraryRoot = path.resolve(libraryRootArg);
const requestPath = path.resolve(requestPathArg);
const outputPath = path.resolve(outputPathArg);
const virtualPrefix = options["virtual-prefix"] || null;

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function findLibraryTxt(root) {
  const direct = path.join(root, "library.txt");
  if (await exists(direct)) return direct;
  const queue = [root];
  while (queue.length) {
    const current = queue.shift();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === ".git") continue;
      const child = path.join(current, entry.name);
      const candidate = path.join(child, "library.txt");
      if (await exists(candidate)) return candidate;
      queue.push(child);
    }
  }
  throw new Error(`library.txt not found under ${root}`);
}

function normalize(value = "") {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function priority(command) {
  if (command === "EXPORT") return 0;
  if (command === "EXPORT_EXCLUDE") return 1;
  if (command === "EXPORT_BACKUP") return 2;
  if (command === "EXPORT_RATIO") return 3;
  return 99;
}

const libraryTxt = await findLibraryTxt(libraryRoot);
const actualRoot = path.dirname(libraryTxt);
const source = await fs.readFile(libraryTxt, "utf8");
const mappings = new Map();
let region = null;

for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.replace(/#.*/, "").trim();
  if (!line) continue;
  const parts = line.split(/\s+/);
  const command = parts[0];

  if (command === "REGION") {
    region = parts[1] || null;
    continue;
  }
  if (command === "REGION_DEFINE" || command === "REGION_ALL" || command === "REGION_DREF" || command === "REGION_RECT") {
    continue;
  }
  if (!["EXPORT", "EXPORT_EXCLUDE", "EXPORT_BACKUP", "EXPORT_RATIO"].includes(command)) continue;

  let virtual;
  let physical;
  if (command === "EXPORT_RATIO") {
    if (parts.length < 4) continue;
    virtual = parts[2];
    physical = parts.slice(3).join(" ");
  } else {
    if (parts.length < 3) continue;
    virtual = parts[1];
    physical = parts.slice(2).join(" ");
  }

  const key = normalize(virtual);
  const candidate = {
    command,
    region,
    virtualResource: key,
    physicalResource: normalize(physical),
  };
  const list = mappings.get(key) || [];
  list.push(candidate);
  mappings.set(key, list);
}

const requestedPayload = JSON.parse(await fs.readFile(requestPath, "utf8"));
const requested = Array.isArray(requestedPayload)
  ? requestedPayload
  : Array.isArray(requestedPayload.resources)
    ? requestedPayload.resources
    : Object.keys(requestedPayload.resources || {});

const resolutions = {};
const unresolved = [];
const ambiguous = [];

for (const requestedResourceRaw of requested) {
  const requestedResource = normalize(requestedResourceRaw);
  if (virtualPrefix && !requestedResource.startsWith(`${virtualPrefix}/`)) continue;

  const allCandidates = (mappings.get(requestedResource) || [])
    .sort((a, b) => priority(a.command) - priority(b.command));

  if (!allCandidates.length) {
    unresolved.push({ resource: requestedResource, reason: "no library export" });
    continue;
  }

  const preferredCandidates = allCandidates.filter((entry) => entry.region === null || entry.region === "default");
  const candidates = preferredCandidates.length ? preferredCandidates : allCandidates;

  const existing = [];
  for (const candidate of candidates) {
    const physicalPath = path.resolve(actualRoot, candidate.physicalResource);
    if (await exists(physicalPath)) existing.push({ ...candidate, physicalPath });
  }

  if (!existing.length) {
    unresolved.push({
      resource: requestedResource,
      reason: "library export exists but physical resource is missing",
      candidates: candidates.map((entry) => ({
        command: entry.command,
        region: entry.region,
        physicalResource: entry.physicalResource,
      })),
    });
    continue;
  }

  const bestPriority = priority(existing[0].command);
  const best = existing.filter((entry) => priority(entry.command) === bestPriority);
  const uniquePhysical = [...new Set(best.map((entry) => entry.physicalPath))];

  if (uniquePhysical.length > 1) {
    ambiguous.push({
      resource: requestedResource,
      reason: preferredCandidates.length
        ? "multiple exact default/unscoped physical resources"
        : "multiple exact region-scoped physical resources; geographic selection required",
      candidates: best.map((entry) => ({
        command: entry.command,
        region: entry.region,
        physicalResource: entry.physicalResource,
      })),
    });
    continue;
  }

  const selected = best[0];
  resolutions[requestedResource] = {
    command: selected.command,
    region: selected.region,
    virtualResource: requestedResource,
    physicalResource: selected.physicalResource,
    physicalPath: selected.physicalPath,
    sha256: createHash("sha256").update(await fs.readFile(selected.physicalPath)).digest("hex"),
  };
}

const report = {
  schemaVersion: 1,
  libraryRoot,
  libraryTxt,
  libraryTxtSha256: createHash("sha256").update(await fs.readFile(libraryTxt)).digest("hex"),
  virtualPrefix,
  requestedCount: requested.filter((resource) => !virtualPrefix || normalize(resource).startsWith(`${virtualPrefix}/`)).length,
  resolvedCount: Object.keys(resolutions).length,
  unresolved,
  ambiguous,
  resources: resolutions,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (unresolved.length || ambiguous.length) {
  throw new Error(`X-Plane library resolution incomplete: resolved ${report.resolvedCount}/${report.requestedCount}, unresolved=${unresolved.length}, ambiguous=${ambiguous.length}`);
}

console.log(JSON.stringify({
  outputPath,
  libraryTxt,
  virtualPrefix,
  requestedCount: report.requestedCount,
  resolvedCount: report.resolvedCount,
}, null, 2));
