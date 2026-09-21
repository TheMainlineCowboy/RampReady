import fs from "node:fs/promises";
import path from "node:path";

const [, , wedPath, outputPath = "reports/kphx-wed-surface-network.json"] = process.argv;
if (!wedPath) {
  throw new Error("Usage: node scripts/extract-kphx-wed-surface-network.mjs <earth.wed.xml> [output.json]");
}

const PACKAGE_PREFIXES = new Set([
  "Terminals", "Runways", "Ramps", "ParkingGarages", "CargoBuildings",
  "SkyTrain", "Vehicles", "StaticAircraft", "People", "Trees", "Misc",
  "Lights", "Lines", "GroundMarkings", "GroundPolys", "Ground_Textures",
  "GateNumbers", "gate_number", "Downtown", "Construction", "Digging",
  "DGSs-Marshaller", "Ortho",
]);

function decodeXml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function parseAttributes(fragment = "") {
  const result = {};
  const expression = /([A-Za-z0-9_:-]+)="([^"]*)"/g;
  let match;
  while ((match = expression.exec(fragment)) !== null) result[match[1]] = decodeXml(match[2]);
  return result;
}

function firstTag(body, name) {
  const match = body.match(new RegExp(`<${name}\\b([^>]*)\\/?>`));
  return match ? parseAttributes(match[1]) : null;
}

function allTags(body, name) {
  const result = [];
  const expression = new RegExp(`<${name}\\b([^>]*)\\/?>`, "g");
  let match;
  while ((match = expression.exec(body)) !== null) result.push(parseAttributes(match[1]));
  return result;
}

function normalizeResource(resource = "") {
  return resource.replaceAll("\\", "/").replace(/^\.\//, "");
}

function resourcePrefix(resource) {
  const normalized = normalizeResource(resource);
  const slash = normalized.indexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "(root)";
}

function sourceClass(resource) {
  const prefix = resourcePrefix(resource);
  return PACKAGE_PREFIXES.has(prefix) ? "package-owned" : "external-library";
}

const xml = await fs.readFile(wedPath, "utf8");
const objectExpression = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
const objects = new Map();
const classCounts = {};
let match;

while ((match = objectExpression.exec(xml)) !== null) {
  const objectAttributes = parseAttributes(match[1]);
  const body = match[2];
  const id = objectAttributes.id;
  const objectClass = objectAttributes.class;
  if (!id || !objectClass) continue;
  const hierarchy = firstTag(body, "hierarchy") || {};
  const point = firstTag(body, "point");
  const children = allTags(body, "child").map((entry) => entry.id).filter(Boolean);
  const markings = allTags(body, "marking").map((entry) => entry.value).filter(Boolean);
  objects.set(id, {
    id,
    parentId: objectAttributes.parent_id || null,
    class: objectClass,
    name: hierarchy.name || "",
    locked: hierarchy.locked === "1",
    hidden: hierarchy.hidden === "1",
    point,
    children,
    markings,
    body,
  });
  classCounts[objectClass] = (classCounts[objectClass] || 0) + 1;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function pointRecord(object) {
  if (!object?.point) return null;
  return {
    id: object.id,
    class: object.class,
    name: object.name,
    latitude: numberOrNull(object.point.latitude),
    longitude: numberOrNull(object.point.longitude),
    headingDegrees: numberOrNull(object.point.heading),
    split: object.point.split === "1",
    ctrlLatitudeLo: numberOrNull(object.point.ctrl_latitude_lo),
    ctrlLongitudeLo: numberOrNull(object.point.ctrl_longitude_lo),
    ctrlLatitudeHi: numberOrNull(object.point.ctrl_latitude_hi),
    ctrlLongitudeHi: numberOrNull(object.point.ctrl_longitude_hi),
    markings: object.markings,
    texture: firstTag(object.body, "texture_node"),
    facade: firstTag(object.body, "facade_node"),
  };
}

function childPointRecords(object) {
  return (object?.children || []).map((id) => pointRecord(objects.get(id))).filter(Boolean);
}

function ringPointRecords(ringId) {
  const ring = objects.get(ringId);
  if (!ring) return [];
  return childPointRecords(ring);
}

function placementResourceRecord(resource) {
  const normalized = normalizeResource(resource);
  return {
    resource: normalized,
    resourcePrefix: resourcePrefix(normalized),
    sourceClass: sourceClass(normalized),
  };
}

const runways = [];
const taxiways = [];
const lines = [];
const signs = [];
const drapedOrthophotos = [];
const facades = [];
const polygons = [];
const strings = [];
const lightFixtures = [];
const forests = [];
const roads = [];

for (const object of objects.values()) {
  if (object.class === "WED_Runway") {
    const runway = firstTag(object.body, "runway") || {};
    const line = firstTag(object.body, "line") || {};
    runways.push({
      id: object.id,
      name: object.name,
      widthMeters: numberOrNull(line.width),
      runway,
      endpoints: childPointRecords(object),
    });
  } else if (object.class === "WED_Taxiway") {
    const taxiway = firstTag(object.body, "taxiway") || {};
    const chain = objects.get(object.children[0]);
    taxiways.push({
      id: object.id,
      name: object.name,
      taxiway,
      chainId: chain?.id || null,
      closed: firstTag(chain?.body || "", "airport_chain")?.closed === "1",
      nodes: childPointRecords(chain),
    });
  } else if (object.class === "WED_LinePlacement") {
    const placement = firstTag(object.body, "line_placement") || {};
    const resource = placement.resource || "";
    lines.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      closed: placement.closed === "1",
      nodes: childPointRecords(object),
    });
  } else if (object.class === "WED_AirportSign") {
    signs.push({
      id: object.id,
      name: object.name,
      point: pointRecord(object),
      airportSign: firstTag(object.body, "airport_sign") || {},
    });
  } else if (object.class === "WED_DrapedOrthophoto") {
    const placement = firstTag(object.body, "draped_orthophoto") || {};
    const resource = placement.resource || "";
    drapedOrthophotos.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      rings: object.children.map((ringId) => ({
        ringId,
        nodes: ringPointRecords(ringId),
      })),
    });
  } else if (object.class === "WED_FacadePlacement") {
    const placement = firstTag(object.body, "facade_placement") || {};
    const resource = placement.resource || "";
    facades.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      rings: object.children.map((ringId) => ({
        ringId,
        nodes: ringPointRecords(ringId),
      })),
    });
  } else if (object.class === "WED_PolygonPlacement") {
    const placement = firstTag(object.body, "polygon_placement") || {};
    const resource = placement.resource || "";
    polygons.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      rings: object.children.map((ringId) => ({
        ringId,
        nodes: ringPointRecords(ringId),
      })),
    });
  } else if (object.class === "WED_StringPlacement") {
    const placement = firstTag(object.body, "string_placement") || {};
    const resource = placement.resource || "";
    strings.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      nodes: childPointRecords(object),
    });
  } else if (object.class === "WED_LightFixture") {
    lightFixtures.push({
      id: object.id,
      name: object.name,
      point: pointRecord(object),
      lightFixture: firstTag(object.body, "light_fixture") || {},
    });
  } else if (object.class === "WED_ForestPlacement") {
    const placement = firstTag(object.body, "forest_placement") || {};
    const resource = placement.resource || "";
    forests.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      rings: object.children.map((ringId) => ({
        ringId,
        nodes: ringPointRecords(ringId),
      })),
    });
  } else if (object.class === "WED_RoadEdge") {
    const placement = firstTag(object.body, "road_edge") || {};
    const resource = placement.resource || "";
    const sources = allTags(object.body, "source").map((entry) => entry.id).filter(Boolean);
    roads.push({
      id: object.id,
      name: object.name,
      ...placementResourceRecord(resource),
      placement,
      sourceNodeIds: sources,
      sourceNodes: sources.map((id) => pointRecord(objects.get(id))).filter(Boolean),
    });
  }
}

function resourceSummary(records) {
  const resources = {};
  const prefixes = {};
  let packageOwnedCount = 0;
  let externalCount = 0;
  for (const entry of records) {
    if (!entry.resource) continue;
    resources[entry.resource] = (resources[entry.resource] || 0) + 1;
    prefixes[entry.resourcePrefix] = (prefixes[entry.resourcePrefix] || 0) + 1;
    if (entry.sourceClass === "package-owned") packageOwnedCount += 1;
    else externalCount += 1;
  }
  return {
    placementCount: records.length,
    packageOwnedCount,
    externalLibraryCount: externalCount,
    uniqueResourceCount: Object.keys(resources).length,
    prefixes: Object.fromEntries(Object.entries(prefixes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    resources: Object.fromEntries(Object.entries(resources).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  };
}

const report = {
  schemaVersion: 1,
  source: {
    package: "KPHX - Phoenix Sky Harbor Intl",
    version: "1.75.1",
    wedFile: path.basename(wedPath),
    authority: "user-supplied earth.wed.xml",
  },
  classCounts: Object.fromEntries(Object.entries(classCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
  counts: {
    runways: runways.length,
    taxiways: taxiways.length,
    linePlacements: lines.length,
    airportSigns: signs.length,
    drapedOrthophotos: drapedOrthophotos.length,
    facadePlacements: facades.length,
    polygonPlacements: polygons.length,
    stringPlacements: strings.length,
    lightFixtures: lightFixtures.length,
    forestPlacements: forests.length,
    roadEdges: roads.length,
  },
  resourceSummaries: {
    lines: resourceSummary(lines),
    drapedOrthophotos: resourceSummary(drapedOrthophotos),
    facades: resourceSummary(facades),
    polygons: resourceSummary(polygons),
    strings: resourceSummary(strings),
    forests: resourceSummary(forests),
    roads: resourceSummary(roads),
  },
  runways,
  taxiways,
  lines,
  signs,
  drapedOrthophotos,
  facades,
  polygons,
  strings,
  lightFixtures,
  forests,
  roads,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  outputPath,
  counts: report.counts,
  runwayNames: runways.map((entry) => entry.name),
  lineResources: report.resourceSummaries.lines.uniqueResourceCount,
  drapedResources: report.resourceSummaries.drapedOrthophotos.uniqueResourceCount,
  facadeResources: report.resourceSummaries.facades.uniqueResourceCount,
  polygonResources: report.resourceSummaries.polygons.uniqueResourceCount,
}, null, 2));
