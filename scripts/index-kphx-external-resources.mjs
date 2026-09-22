import fs from "node:fs/promises";
import path from "node:path";

const inputs = [
  "public/models/kphx/wed-objects.exact.json",
  "public/models/kphx/wed-ground.exact.json",
  "public/models/kphx/wed-jetways.exact.json",
];

const prefixes = [
  "MisterX_Library/",
  "CDB-Library/",
  "ZDP_Library/",
  "RA_Library/",
  "Fruitstand_Aircraft/",
  "opensceneryx/",
  "lib/",
];

const found = Object.fromEntries(prefixes.map((p) => [p.slice(0, -1), new Set()]));

function visit(value) {
  if (typeof value === "string") {
    const normalized = value.replaceAll("\\", "/");
    for (const prefix of prefixes) {
      if (normalized.startsWith(prefix)) found[prefix.slice(0, -1)].add(normalized);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visit(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) visit(item);
  }
}

for (const input of inputs) {
  const data = JSON.parse(await fs.readFile(input, "utf8"));
  visit(data);
}

const resources = Object.fromEntries(
  Object.entries(found).map(([prefix, set]) => [prefix, [...set].sort()])
);
const counts = Object.fromEntries(
  Object.entries(resources).map(([prefix, list]) => [prefix, list.length])
);

const out = {
  schemaVersion: 1,
  authority: "Recovered exact KPHX 1.75.1 WED extracts already committed in RampReady",
  inputs,
  counts,
  resources,
};

const output = process.argv[2] || "reports/kphx-external-resource-index.json";
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({output, counts}, null, 2));
