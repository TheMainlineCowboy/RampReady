import fs from "node:fs/promises";
import path from "node:path";

const [, , wedPath, outputPath = "reports/kphx-wed-object-placements.json"] = process.argv;
if (!wedPath) {
  throw new Error("Usage: node scripts/extract-kphx-wed-object-placements.mjs <earth.wed.xml> [output.json]");
}

const PACKAGE_PREFIXES = new Set([
  "Terminals",
  "Runways",
  "Ramps",
  "ParkingGarages",
  "CargoBuildings",
  "SkyTrain",
  "Vehicles",
  "StaticAircraft",
  "People",
  "Trees",
  "Misc",
  "Lights",
  "Lines",
  "GroundMarkings",
  "GroundPolys",
  "Ground_Textures",
  "GateNumbers",
  "gate_number",
  "Downtown",
  "Construction",
  "Digging",
  "DGSs-Marshaller",
  "Ortho",
]);

function decodeXml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function attribute(fragment, key) {
  const expression = new RegExp(`\\b${key}="([^"]*)"`);
  const match = fragment.match(expression);
  return match ? decodeXml(match[1]) : null;
}

function resourcePrefix(resource) {
  const normalized = resource.replaceAll("\\", "/").replace(/^\.\//, "");
  const slash = normalized.indexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "(root)";
}

const xml = await fs.readFile(wedPath, "utf8");
const objectExpression = /<object\s+class="([^"]+)"\s+id="([^"]+)"\s+parent_id="([^"]+)"[^>]*>([\s\S]*?)<\/object>/g;
const placements = [];
const rampStarts = [];
let match;

while ((match = objectExpression.exec(xml)) !== null) {
  const [, objectClass, id, parentId, body] = match;
  const hierarchyTag = body.match(/<hierarchy\b[^>]*\/>/)?.[0] || "";
  const pointTag = body.match(/<point\b[^>]*\/>/)?.[0] || "";
  const name = attribute(hierarchyTag, "name") || "";

  if (objectClass === "WED_ObjPlacement") {
    const placementTag = body.match(/<obj_placement\b[^>]*\/>/)?.[0];
    if (!placementTag || !pointTag) continue;
    const resource = attribute(placementTag, "resource");
    if (!resource) continue;
    const prefix = resourcePrefix(resource);
    placements.push({
      id,
      parentId,
      name,
      resource: resource.replaceAll("\\", "/"),
      resourcePrefix: prefix,
      sourceClass: PACKAGE_PREFIXES.has(prefix) ? "package-owned" : "external-library",
      latitude: Number(attribute(pointTag, "latitude")),
      longitude: Number(attribute(pointTag, "longitude")),
      headingDegrees: Number(attribute(pointTag, "heading") || 0),
      customMsl: attribute(placementTag, "custom_msl") === "1",
      mslMeters: Number(attribute(placementTag, "msl") || 0),
      showLevel: attribute(placementTag, "show_level") || null,
    });
  }

  if (objectClass === "WED_RampPosition") {
    const rampTag = body.match(/<ramp_start\b[^>]*\/>/)?.[0];
    if (!rampTag || !pointTag) continue;
    rampStarts.push({
      id,
      parentId,
      name,
      latitude: Number(attribute(pointTag, "latitude")),
      longitude: Number(attribute(pointTag, "longitude")),
      headingDegrees: Number(attribute(pointTag, "heading") || 0),
      type: attribute(rampTag, "type") || null,
      traffic: attribute(rampTag, "traffic") || null,
      width: attribute(rampTag, "width") || null,
      rampOperationType: attribute(rampTag, "ramp_op_type") || null,
      airlines: attribute(rampTag, "airlines") || "",
    });
  }
}

const a1 = rampStarts.find((entry) => entry.name === "T4 Gate A1");
if (!a1) throw new Error("Authoritative WED ramp start 'T4 Gate A1' was not found");

const packageOwned = placements.filter((entry) => entry.sourceClass === "package-owned");
const external = placements.filter((entry) => entry.sourceClass === "external-library");

function summarize(entries) {
  const prefixCounts = {};
  const resources = {};
  for (const entry of entries) {
    prefixCounts[entry.resourcePrefix] = (prefixCounts[entry.resourcePrefix] || 0) + 1;
    resources[entry.resource] = (resources[entry.resource] || 0) + 1;
  }
  return {
    placementCount: entries.length,
    uniqueResourceCount: Object.keys(resources).length,
    prefixCounts: Object.fromEntries(Object.entries(prefixCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    resources: Object.fromEntries(Object.entries(resources).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  };
}

const report = {
  schemaVersion: 1,
  source: {
    package: "KPHX - Phoenix Sky Harbor Intl",
    version: "1.75.1",
    wedFile: path.basename(wedPath),
    authority: "user-supplied expanded X-Plane package",
  },
  masterAnchor: {
    ...a1,
    rampReadyPosition: [0, 0, 6.2],
  },
  totals: {
    objectPlacements: placements.length,
    rampStarts: rampStarts.length,
  },
  packageOwned: summarize(packageOwned),
  externalLibraries: summarize(external),
  placements: {
    packageOwned,
    externalLibraries: external,
  },
  rampStarts,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  outputPath,
  a1,
  objectPlacements: placements.length,
  packageOwnedPlacements: packageOwned.length,
  packageOwnedUniqueResources: report.packageOwned.uniqueResourceCount,
  externalPlacements: external.length,
  externalUniqueResources: report.externalLibraries.uniqueResourceCount,
  rampStarts: rampStarts.length,
}, null, 2));
