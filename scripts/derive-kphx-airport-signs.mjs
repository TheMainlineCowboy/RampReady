import fs from "node:fs";
import path from "node:path";

const [inspectionArg] = process.argv.slice(2);
if (!inspectionArg) throw new Error("Usage: node derive-kphx-airport-signs.mjs <inspection.json>");
const inspectionPath = path.resolve(inspectionArg);
const inspection = JSON.parse(fs.readFileSync(inspectionPath, "utf8"));
const airport = inspection.selected;
if (!airport?.taxiwayPoints?.length || !airport?.taxiwayPaths?.length || !airport?.runways?.length) {
  throw new Error("KPHX derived-signage input is missing taxiway points, paths, or runways");
}

const EARTH_METERS_PER_DEGREE = 111_320;
const cleanName = (value) => String(value ?? "").replace(/\0.*$/s, "").trim();
const pointByIndex = new Map(airport.taxiwayPoints.map((point) => [point.index, point]));
const taxiwayNames = airport.taxiwayNames.map(cleanName);

function localMeters(origin, target) {
  const meanLatitude = (origin.latitude + target.latitude) * Math.PI / 360;
  return {
    north: (target.latitude - origin.latitude) * EARTH_METERS_PER_DEGREE,
    east: (target.longitude - origin.longitude) * EARTH_METERS_PER_DEGREE * Math.cos(meanLatitude),
  };
}

function offsetLatLon(origin, northMeters, eastMeters) {
  const latitude = origin.latitude + northMeters / EARTH_METERS_PER_DEGREE;
  const longitude = origin.longitude + eastMeters / (EARTH_METERS_PER_DEGREE * Math.cos(origin.latitude * Math.PI / 180));
  return { latitude, longitude };
}

function normalize(vector) {
  const length = Math.hypot(vector.north, vector.east);
  return length > 0.001
    ? { north: vector.north / length, east: vector.east / length, length }
    : null;
}

function runwayGeometry(runway) {
  const radians = runway.headingDegrees * Math.PI / 180;
  return {
    ...runway,
    along: { north: Math.cos(radians), east: Math.sin(radians) },
    halfLength: runway.lengthMeters / 2,
  };
}
const runwayGeometries = airport.runways.map(runwayGeometry);

function pointToRunwayDistance(point, runway) {
  const delta = localMeters(runway, point);
  const along = delta.north * runway.along.north + delta.east * runway.along.east;
  const clampedAlong = Math.max(-runway.halfLength, Math.min(runway.halfLength, along));
  const nearest = {
    north: runway.along.north * clampedAlong,
    east: runway.along.east * clampedAlong,
  };
  return Math.hypot(delta.north - nearest.north, delta.east - nearest.east);
}

function nearestRunway(point) {
  return runwayGeometries
    .map((runway) => ({ runway, distance: pointToRunwayDistance(point, runway) }))
    .sort((a, b) => a.distance - b.distance)[0];
}

const connectionsByPoint = new Map();
function addConnection(pointIndex, pathRecord, otherPointIndex) {
  const point = pointByIndex.get(pointIndex);
  const other = pointByIndex.get(otherPointIndex);
  if (!point || !other) return;
  const direction = normalize(localMeters(point, other));
  if (!direction) return;
  const connections = connectionsByPoint.get(pointIndex) ?? [];
  connections.push({
    pathIndex: pathRecord.index,
    type: pathRecord.type,
    widthMeters: pathRecord.widthMeters,
    nameIndex: pathRecord.nameIndex,
    name: taxiwayNames[pathRecord.nameIndex] ?? "",
    runwayDesignator: pathRecord.runwayDesignator,
    otherPointIndex,
    direction,
  });
  connectionsByPoint.set(pointIndex, connections);
}
for (const pathRecord of airport.taxiwayPaths) {
  if (pathRecord.type === 3) continue;
  addConnection(pathRecord.start, pathRecord, pathRecord.end);
  addConnection(pathRecord.end, pathRecord, pathRecord.start);
}

const signs = [];
for (const point of airport.taxiwayPoints) {
  if (![2, 4].includes(point.type)) continue;
  const connections = connectionsByPoint.get(point.index) ?? [];
  if (!connections.length) continue;
  const nearest = nearestRunway(point);
  if (!nearest?.runway) continue;

  const connectionEvidence = connections.map((connection) => {
    const otherPoint = pointByIndex.get(connection.otherPointIndex);
    return {
      ...connection,
      otherRunwayDistance: otherPoint ? pointToRunwayDistance(otherPoint, nearest.runway) : -Infinity,
    };
  });
  // The connection whose other endpoint is farther from the runway points back
  // toward approaching taxi traffic and gives the sign its readable face.
  const approach = connectionEvidence
    .sort((a, b) => b.otherRunwayDistance - a.otherRunwayDistance || b.widthMeters - a.widthMeters)[0];
  if (!approach) continue;

  let away = { north: approach.direction.north, east: approach.direction.east };
  if (point.orientation === 2) away = { north: -away.north, east: -away.east };
  const right = { north: -away.east, east: away.north };
  const sideOffset = Math.max(4.5, approach.widthMeters / 2 + 2.2);
  const longitudinalOffset = 2.4;
  const position = offsetLatLon(
    point,
    away.north * longitudinalOffset + right.north * sideOffset,
    away.east * longitudinalOffset + right.east * sideOffset,
  );
  const connectedNames = [...new Set(connectionEvidence.map((connection) => cleanName(connection.name)).filter(Boolean))];
  const taxiwayName = cleanName(approach.name) || connectedNames[0] || "";
  const runwayText = `${nearest.runway.primary}-${nearest.runway.secondary}`;
  const mandatoryText = point.type === 4 ? `ILS ${runwayText}` : runwayText;
  const facingHeadingDegrees = (Math.atan2(away.east, away.north) * 180 / Math.PI + 360) % 360;

  signs.push({
    id: `KPHX-${point.type === 4 ? "ILS" : "HOLD"}-${point.index}`,
    kind: point.type === 4 ? "ils-hold-position" : "runway-hold-position",
    sourcePointIndex: point.index,
    sourcePointType: point.type,
    sourcePointOrientation: point.orientation,
    latitude: position.latitude,
    longitude: position.longitude,
    headingDegrees: facingHeadingDegrees,
    signSide: "right-of-approach",
    panels: [
      { style: "mandatory", text: mandatoryText },
      ...(taxiwayName ? [{ style: "location", text: taxiwayName }] : []),
    ],
    nearestRunway: {
      primary: nearest.runway.primary,
      secondary: nearest.runway.secondary,
      distanceMeters: nearest.distance,
      sourceByteOffset: nearest.runway.sourceByteOffset,
    },
    connectedTaxiwayNames: connectedNames,
    connectedPathIndexes: connectionEvidence.map((connection) => connection.pathIndex),
    approachPathIndex: approach.pathIndex,
    approachTaxiwayName: taxiwayName,
    approachWidthMeters: approach.widthMeters,
    provenance: "derived-from-exact-kphx-taxiway-graph-runway-records-and-hold-short-points",
  });
}

if (!signs.length) throw new Error("KPHX graph-derived signage produced zero signs");
const ids = new Set(signs.map((sign) => sign.id));
if (ids.size !== signs.length) throw new Error("KPHX graph-derived signage contains duplicate ids");
for (const sign of signs) {
  if (!Number.isFinite(sign.latitude) || !Number.isFinite(sign.longitude) || !Number.isFinite(sign.headingDegrees)) {
    throw new Error(`KPHX derived sign ${sign.id} has invalid placement`);
  }
  if (!sign.panels.length || !sign.panels[0].text) throw new Error(`KPHX derived sign ${sign.id} has no mandatory label`);
}

airport.derivedTaxiwaySigns = signs;
inspection.decodedCounts = {
  ...(inspection.decodedCounts ?? {}),
  derivedTaxiwaySigns: signs.length,
  derivedRunwayHoldSigns: signs.filter((sign) => sign.kind === "runway-hold-position").length,
  derivedIlsHoldSigns: signs.filter((sign) => sign.kind === "ils-hold-position").length,
};
inspection.derivedSignage = {
  schemaVersion: 1,
  authority: "exact KPHX taxiway graph, runway records, taxiway names, and hold-short point records",
  positioningPolicy: "right side of source-derived approach path, behind exact hold-short point",
  provenance: "graph-derived-not-embedded-sign-object",
};
fs.writeFileSync(inspectionPath, `${JSON.stringify(inspection, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  derivedSigns: signs.length,
  runwayHoldSigns: signs.filter((sign) => sign.kind === "runway-hold-position").length,
  ilsHoldSigns: signs.filter((sign) => sign.kind === "ils-hold-position").length,
  runwayLabels: [...new Set(signs.map((sign) => sign.nearestRunway.primary + "-" + sign.nearestRunway.secondary))],
  taxiwayNames: [...new Set(signs.flatMap((sign) => sign.connectedTaxiwayNames))].sort(),
}, null, 2));
