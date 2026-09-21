import { kphxWedToRampReadyPosition } from "./sourceAuthority.js";

const DEFAULT_TOLERANCE_METERS = 0.025;
const MAX_RECURSION = 14;

function worldPoint(latitude, longitude) {
  const [x, , z] = kphxWedToRampReadyPosition(latitude, longitude, 0);
  return { x, z, latitude, longitude };
}

function positionControlPoint(node, suffix) {
  const latitude = Number(node.latitude);
  const longitude = Number(node.longitude);
  const dLat = Number(node[`ctrlLatitude${suffix}`] ?? 0);
  const dLon = Number(node[`ctrlLongitude${suffix}`] ?? 0);
  return worldPoint(latitude + dLat, longitude + dLon);
}

function texturePoint(node) {
  const texture = node?.texture;
  if (!texture) return null;
  const s = Number(texture.s);
  const t = Number(texture.t);
  return Number.isFinite(s) && Number.isFinite(t) ? { s, t } : null;
}

function textureControlPoint(node, suffix) {
  const base = texturePoint(node);
  if (!base) return null;
  const ds = Number(node.texture?.[`sc${suffix === "Hi" ? "_hi" : "_lo"}`] ?? 0);
  const dt = Number(node.texture?.[`tc${suffix === "Hi" ? "_hi" : "_lo"}`] ?? 0);
  return {
    s: base.s + (Number.isFinite(ds) ? ds : 0),
    t: base.t + (Number.isFinite(dt) ? dt : 0),
  };
}

function midpointPosition(a, b) {
  return { x: (a.x + b.x) * 0.5, z: (a.z + b.z) * 0.5 };
}

function midpointTexture(a, b) {
  if (!a || !b) return null;
  return { s: (a.s + b.s) * 0.5, t: (a.t + b.t) * 0.5 };
}

function withTexture(position, texture) {
  return texture ? { x: position.x, z: position.z, s: texture.s, t: texture.t } : { x: position.x, z: position.z };
}

function pointLineDistance(point, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (length2 < 1e-12) return Math.hypot(point.x - a.x, point.z - a.z);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / length2));
  return Math.hypot(point.x - (a.x + t * dx), point.z - (a.z + t * dz));
}

function appendCubicAdaptive(output, positionCurve, textureCurve, tolerance, depth = 0) {
  const [p0, p1, p2, p3] = positionCurve;
  const flatness = Math.max(pointLineDistance(p1, p0, p3), pointLineDistance(p2, p0, p3));
  if (flatness <= tolerance || depth >= MAX_RECURSION) {
    output.push(withTexture(p3, textureCurve?.[3] || null));
    return;
  }

  const p01 = midpointPosition(p0, p1);
  const p12 = midpointPosition(p1, p2);
  const p23 = midpointPosition(p2, p3);
  const p012 = midpointPosition(p01, p12);
  const p123 = midpointPosition(p12, p23);
  const p0123 = midpointPosition(p012, p123);

  let leftTexture = null;
  let rightTexture = null;
  if (textureCurve?.every(Boolean)) {
    const [t0, t1, t2, t3] = textureCurve;
    const t01 = midpointTexture(t0, t1);
    const t12 = midpointTexture(t1, t2);
    const t23 = midpointTexture(t2, t3);
    const t012 = midpointTexture(t01, t12);
    const t123 = midpointTexture(t12, t23);
    const t0123 = midpointTexture(t012, t123);
    leftTexture = [t0, t01, t012, t0123];
    rightTexture = [t0123, t123, t23, t3];
  }

  appendCubicAdaptive(output, [p0, p01, p012, p0123], leftTexture, tolerance, depth + 1);
  appendCubicAdaptive(output, [p0123, p123, p23, p3], rightTexture, tolerance, depth + 1);
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
  preserveTextureCoordinates = true,
} = {}) {
  if (!Array.isArray(nodes) || nodes.length < 2) return [];

  const output = [];
  const firstPosition = worldPoint(Number(nodes[0].latitude), Number(nodes[0].longitude));
  const firstTexture = preserveTextureCoordinates ? texturePoint(nodes[0]) : null;
  output.push(withTexture(firstPosition, firstTexture));

  const segmentCount = closed ? nodes.length : nodes.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const a = nodes[index];
    const b = nodes[(index + 1) % nodes.length];
    const p0 = worldPoint(Number(a.latitude), Number(a.longitude));
    const p3 = worldPoint(Number(b.latitude), Number(b.longitude));
    const t0 = preserveTextureCoordinates ? texturePoint(a) : null;
    const t3 = preserveTextureCoordinates ? texturePoint(b) : null;

    if (!segmentIsCurved(a, b)) {
      output.push(withTexture(p3, t3));
      continue;
    }

    const p1 = positionControlPoint(a, "Hi");
    const p2 = positionControlPoint(b, "Lo");
    const textureCurve = t0 && t3
      ? [t0, textureControlPoint(a, "Hi"), textureControlPoint(b, "Lo"), t3]
      : null;
    appendCubicAdaptive(output, [p0, p1, p2, p3], textureCurve, toleranceMeters);
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
  textureControlInterpretation: "WED texture s/t with sc/tc hi/lo offsets subdivided at the same Bezier parameters as geometry",
});
