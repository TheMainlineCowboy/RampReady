import fs from "node:fs/promises";
import path from "node:path";

const index = JSON.parse(await fs.readFile("reports/kphx-external-resource-index.json", "utf8"));
const externalRoot = path.resolve("public/models/kphx-full-airport/external");

const families = [
  "MisterX_Library",
  "CDB-Library",
  "ZDP_Library",
  "RA_Library",
  "Fruitstand_Aircraft",
  "opensceneryx",
  "lib",
];

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function walk(root) {
  if (!(await exists(root))) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

const runtimeFiles = await walk(externalRoot);
const runtimeText = runtimeFiles.map((p) => p.replaceAll("\\", "/"));

const report = {
  schemaVersion: 1,
  authority: "reports/kphx-external-resource-index.json + committed exact runtime asset tree",
  generatedAtUtc: new Date().toISOString(),
  families: {},
  totals: {
    requestedUniqueResources: 0,
    loadedUniqueResources: 0,
    unresolvedUniqueResources: 0,
  },
};

for (const family of families) {
  const requested = index.resources?.[family] || [];
  const loaded = [];
  const unresolved = [];
  for (const resource of requested) {
    const stem = resource.replace(/\.[^.\/]+$/, "");
    const normalizedFamily = family;
    const expectedPrefix = `/external/${normalizedFamily}/`;
    const basename = path.basename(stem);
    const hit = runtimeText.some((file) =>
      file.includes(expectedPrefix)
      && (
        file.endsWith(`/${basename}.gltf`)
        || file.endsWith(`/${basename}.json`)
        || file.includes(`/${basename}/`)
      )
    );
    (hit ? loaded : unresolved).push(resource);
  }
  report.families[family] = {
    requestedCount: requested.length,
    loadedCount: loaded.length,
    unresolvedCount: unresolved.length,
    loaded,
    unresolved,
  };
  report.totals.requestedUniqueResources += requested.length;
  report.totals.loadedUniqueResources += loaded.length;
  report.totals.unresolvedUniqueResources += unresolved.length;
}

await fs.writeFile("reports/kphx-external-loaded-unresolved-inventory.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.totals, null, 2));
