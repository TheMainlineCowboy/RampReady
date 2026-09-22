import fs from "node:fs/promises";
import path from "node:path";
import { flattenWedChain } from "../src/environment/kphxFullAirport/wedCurves.js";
import { KPHX_FULL_AIRPORT_SOURCE } from "../src/environment/kphxFullAirport/sourceAuthority.js";

const [, , inputArg, outputArg, radiusArg] = process.argv;
if (!inputArg || !outputArg) {
  throw new Error("Usage: node scripts/filter-kphx-surface-network-near-a1.mjs <input.json> <output.json> [radiusMeters]");
}
const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const radiusMeters = Number(radiusArg || 450);
if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) throw new Error("Invalid radius");

const anchorX = KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[0];
const anchorZ = KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition[2];

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  if (l2 < 1e-12) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, zi = ring[i].z;
    const xj = ring[j].x, zj = ring[j].z;
    const intersects = ((zi > z) !== (zj > z))
      && (x < (xj - xi) * (z - zi) / ((zj - zi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function chainTouchesRadius(points, closed) {
  if (!points.length) return false;
  for (const p of points) {
    if (Math.hypot(p.x - anchorX, p.z - anchorZ) <= radiusMeters) return true;
  }
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (distanceToSegment(anchorX, anchorZ, a.x, a.z, b.x, b.z) <= radiusMeters) return true;
  }
  return closed && pointInRing(anchorX, anchorZ, points);
}

function polygonTouches(entry) {
  const rings = entry.rings || [];
  if (!rings.length) return false;
  return rings.some((ring) => {
    const points = flattenWedChain(ring.nodes || [], { closed: true });
    return chainTouchesRadius(points, true);
  });
}

function lineTouches(entry) {
  const points = flattenWedChain(entry.nodes || [], { closed: entry.closed === true });
  return chainTouchesRadius(points, entry.closed === true);
}

const network = JSON.parse(await fs.readFile(inputPath, "utf8"));
const polygons = (network.polygons || []).filter(polygonTouches);
const drapedOrthophotos = (network.drapedOrthophotos || []).filter(polygonTouches);
const lines = (network.lines || []).filter(lineTouches);

const filtered = {
  ...network,
  scope: {
    type: "a1-radius",
    anchorName: KPHX_FULL_AIRPORT_SOURCE.anchor.name,
    anchorLatitude: KPHX_FULL_AIRPORT_SOURCE.anchor.latitude,
    anchorLongitude: KPHX_FULL_AIRPORT_SOURCE.anchor.longitude,
    anchorRampReadyPosition: KPHX_FULL_AIRPORT_SOURCE.anchor.rampReadyPosition,
    radiusMeters,
    inclusionPolicy: "include if authored WED chain enters/crosses radius or polygon encloses A1",
  },
  counts: {
    ...(network.counts || {}),
    filteredPolygons: polygons.length,
    filteredDrapedOrthophotos: drapedOrthophotos.length,
    filteredLines: lines.length,
  },
  polygons,
  drapedOrthophotos,
  lines,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(filtered, null, 2) + "\n");

const selected = [...polygons, ...drapedOrthophotos, ...lines];
const byPrefix = {};
const resources = {};
for (const entry of selected) {
  const prefix = entry.resourcePrefix || "(none)";
  byPrefix[prefix] = (byPrefix[prefix] || 0) + 1;
  resources[entry.resource] = (resources[entry.resource] || 0) + 1;
}
console.log(JSON.stringify({
  outputPath,
  radiusMeters,
  polygons: polygons.length,
  drapedOrthophotos: drapedOrthophotos.length,
  lines: lines.length,
  placements: selected.length,
  byPrefix,
  uniqueResources: Object.keys(resources).length,
  resources,
}, null, 2));
