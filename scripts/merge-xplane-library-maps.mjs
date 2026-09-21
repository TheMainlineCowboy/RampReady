import fs from "node:fs/promises";
import path from "node:path";

const [, , outputPathArg, ...inputPaths] = process.argv;
if (!outputPathArg || !inputPaths.length) {
  throw new Error("Usage: node scripts/merge-xplane-library-maps.mjs <output.json> <map1.json> [map2.json ...]");
}

const outputPath = path.resolve(outputPathArg);
const merged = {
  schemaVersion: 1,
  sources: [],
  resources: {},
};

for (const inputPathArg of inputPaths) {
  const inputPath = path.resolve(inputPathArg);
  const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
  merged.sources.push({
    inputPath,
    libraryTxt: payload.libraryTxt || null,
    libraryTxtSha256: payload.libraryTxtSha256 || null,
    virtualPrefix: payload.virtualPrefix || null,
    resolvedCount: payload.resolvedCount || 0,
  });
  for (const [resource, resolution] of Object.entries(payload.resources || {})) {
    const existing = merged.resources[resource];
    if (existing) {
      const same = (
        existing.sha256 === resolution.sha256
        && existing.physicalPath === resolution.physicalPath
      );
      if (!same) throw new Error(`Conflicting exact library resolution for ${resource}`);
    } else {
      merged.resources[resource] = resolution;
    }
  }
}

merged.resolvedCount = Object.keys(merged.resources).length;
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, resolvedCount: merged.resolvedCount, sources: merged.sources.length }, null, 2));
