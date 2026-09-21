import { kphxWedToRampReadyPosition } from "./sourceAuthority.js";

const DEFAULT_TOLERANCE_METERS = 0.025;
const MAX_RECURSION = 14;

function worldPoint(latitude, longitude) {
  const [x, , z] = kphxWedToRampReadyPosition(latitude, longitude, 0);
  return { x, z, latitude, longitude };
}

function controlPoint(node, suffix) {
  const latitude = Number(node.latitude);
  const longitude = Number(node.longitude);
  const dLat = Number(node[`ctrlLatitude${suffix}`] ?? 0);
  const dLon = Number(node[`ctrlLongitude${suffix}`] ?? 0);
  return worldPoint(latitude + dLat, longitude + dLon);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) * 0.5, z: (a.z + b.z) * 0.5 };
}

function pointLineDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (length2 < 1e-12) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2));
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function appendCubicAdaptive(output, p0, p1, p2, p3, tolerance, depth = 0) {
  const flatness = Math.max(pointLineDistance(p1, p0, p3), pointLineDistance(p2, p0, p3));
  if (flatness <= tolerance || depth >= MAX_RECURSION) {
    output.push({ x: p3.x, z: p3.z });
    return;
  }

  const p01 = midpoint(p0, p1);
  const p12 = midpoint(p1, p2);
  const p23 = midpoint(p2, p3);
  const p012 = midpoint(p01, p12);
  const p123 = midpoint(p12, p23);
  const p0123 = midpoint(p012, p123);

  appendCubicAdaptive(output, p0, p01, p012, p0123, tolerance, depth + 1);
  appendCubicAdaptive(output, p0123, p123, p23, p3, tolerance, depth + 1);
}

function segmentIsCurved(a, b) {
  return (
    Math.abs(Number(a.ctrlLatitudeHi ?? 0)) > 1e-14
    || Math.abs(Number(a.ctrlLongitudeHi ?? 0)) > 1e-14
    || Math.abs(Number(b.ctrlLatitudeLo ?? 0)) > 1e-14
    || Math.abs(Number(b.ctrlLongitudeLo ?? 0)) > 1e-14
  );
}

export function flattenWedChain(nodes, {
  closed = false,
  toleranceMeters = DEFAULT_TOLERANCE_METERS,
} = {}) {
  if (!Array.isArray(nodes) || nodes.length < 2) return [];

  const output = [];
  const first = worldPoint(Number(nodes[0].latitude), Number(nodes[0].longitude));
  output.push({ x: first.x, z: first.z });

  const segmentCount = closed ? nodes.length : nodes.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const a = nodes[index];
    const b = nodes[(index + 1) % nodes.length];
    const p0 = worldPoint(Number(a.latitude), Number(a.longitude));
    const p3 = worldPoint(Number(b.latitude), Number(b.longitude));

    if (!segmentIsCurved(a, b)) {
      output.push({ x: p3.x, z: p3.z });
      continue;
    }

    const p1 = controlPoint(a, "Hi");
    const p2 = controlPoint(b, "Lo");
    appendCubicAdaptive(output, p0, p1, p2, p3, toleranceMeters);
  }

  if (closed && output.length > 1) {
    const a = output[0];
    const b = output.at(-1);
    if (Math.hypot(a.x - b.x, a.z - b.z) <= toleranceMeters * 0.25) output.pop();
  }

  return output;
}

export function wedChainLength(points, closed = false) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let length = 0;
  const count = closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    length += Math.hypot(b.x - a.x, b.z - a.z);
  }
  return length;
}

export const KPHX_WED_CURVE_POLICY = Object.freeze({
  algorithm: "adaptive-cubic-bezier-subdivision",
  toleranceMeters: DEFAULT_TOLERANCE_METERS,
  maximumRecursion: MAX_RECURSION,
  controlInterpretation: "node-hi-handle to next-node-lo-handle",
});
