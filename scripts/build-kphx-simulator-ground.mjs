import fs from "node:fs";
import path from "node:path";

const [inspectionArg = "inspection.json", outputDirArg = "public/models/kphx-ground"] = process.argv.slice(2);
const inspectionPath = path.resolve(inspectionArg);
const outputDir = path.resolve(outputDirArg);
fs.mkdirSync(outputDir, { recursive: true });
const inspection = JSON.parse(fs.readFileSync(inspectionPath, "utf8"));
const airport = inspection.selected;
if (inspection.selectedAirport !== "KPHX") throw new Error(`Expected KPHX, got ${inspection.selectedAirport}`);
if (airport.runways?.length !== 3) throw new Error(`Expected 3 decoded KPHX runways, got ${airport.runways?.length ?? 0}`);

const a1 = airport.parkings.find((parking) => parking.nameCode === 12 && parking.number === 1);
if (!a1) throw new Error("A1 parking anchor is missing");
const EARTH_RADIUS_METERS = 6378137;
const originLatitudeRadians = airport.origin.latitude * Math.PI / 180;
const anchorEast = (a1.longitude - airport.origin.longitude) * Math.PI / 180 * EARTH_RADIUS_METERS * Math.cos(originLatitudeRadians);
const anchorNorth = (a1.latitude - airport.origin.latitude) * Math.PI / 180 * EARTH_RADIUS_METERS;
const toScene = (longitude, latitude) => {
  const east = (longitude - airport.origin.longitude) * Math.PI / 180 * EARTH_RADIUS_METERS * Math.cos(originLatitudeRadians);
  const north = (latitude - airport.origin.latitude) * Math.PI / 180 * EARTH_RADIUS_METERS;
  return [north - anchorNorth, east - anchorEast];
};

const groups = new Map();
const ensureGroup = (name) => {
  if (!groups.has(name)) groups.set(name, { positions: [], normals: [], uvs: [], triangles: 0 });
  return groups.get(name);
};
const addTriangle = (name, a, b, c, y = 0) => {
  const group = ensureGroup(name);
  for (const point of [a, b, c]) {
    group.positions.push(point[0], y, point[1]);
    group.normals.push(0, 1, 0);
    group.uvs.push(point[0] / 32, point[1] / 32);
  }
  group.triangles += 1;
};
const addQuad = (name, a, b, c, d, y = 0) => {
  addTriangle(name, a, b, c, y);
  addTriangle(name, a, c, d, y);
};
const addStrip = (name, a, b, width, y = 0) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (!(length > 0.01) || !(width > 0)) return;
  const nx = -dz / length * width / 2;
  const nz = dx / length * width / 2;
  addQuad(name, [a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz], y);
};
const addDashedStrip = (name, a, b, width, dashLength, gapLength, y = 0) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (!(length > 0.01)) return;
  const ux = dx / length;
  const uz = dz / length;
  for (let cursor = 0; cursor < length; cursor += dashLength + gapLength) {
    const end = Math.min(length, cursor + dashLength);
    addStrip(name, [a[0] + ux * cursor, a[1] + uz * cursor], [a[0] + ux * end, a[1] + uz * end], width, y);
  }
};
const addCircle = (name, center, radius, y = 0, segments = 20) => {
  for (let segment = 0; segment < segments; segment += 1) {
    const angleA = segment / segments * Math.PI * 2;
    const angleB = (segment + 1) / segments * Math.PI * 2;
    addTriangle(name, center, [center[0] + Math.cos(angleA) * radius, center[1] + Math.sin(angleA) * radius], [center[0] + Math.cos(angleB) * radius, center[1] + Math.sin(angleB) * radius], y);
  }
};
const pointAlong = (center, along, across, longitudinal, lateral = 0) => [
  center[0] + along[0] * longitudinal + across[0] * lateral,
  center[1] + along[1] * longitudinal + across[1] * lateral,
];
const addOrientedRect = (name, center, along, across, length, width, y = 0) => {
  const hl = length / 2;
  const hw = width / 2;
  addQuad(name,
    pointAlong(center, along, across, -hl, -hw),
    pointAlong(center, along, across, hl, -hw),
    pointAlong(center, along, across, hl, hw),
    pointAlong(center, along, across, -hl, hw),
    y,
  );
};
const surfaceName = (surface, pathType) => pathType === 6 ? "service-road" : surface === 4 ? "asphalt" : "concrete";

const allCoordinates = [];
for (const point of airport.taxiwayPoints) allCoordinates.push(toScene(point.longitude, point.latitude));
for (const parking of airport.parkings) allCoordinates.push(toScene(parking.longitude, parking.latitude));
for (const apron of airport.aprons) for (const vertex of apron.vertices) allCoordinates.push(toScene(vertex.longitude, vertex.latitude));
for (const runway of airport.runways) allCoordinates.push(toScene(runway.longitude, runway.latitude));
const boundsMin = [Math.min(...allCoordinates.map((point) => point[0])), Math.min(...allCoordinates.map((point) => point[1]))];
const boundsMax = [Math.max(...allCoordinates.map((point) => point[0])), Math.max(...allCoordinates.map((point) => point[1]))];
addQuad("airport-base", [boundsMin[0] - 350, boundsMin[1] - 350], [boundsMax[0] + 350, boundsMin[1] - 350], [boundsMax[0] + 350, boundsMax[1] + 350], [boundsMin[0] - 350, boundsMax[1] + 350], -0.08);

let apronTriangles = 0;
for (const apron of airport.aprons) {
  if (!apron.triangles?.length) continue;
  const points = apron.vertices.map((vertex) => toScene(vertex.longitude, vertex.latitude));
  const materialName = surfaceName(apron.surface, 0);
  for (const triangle of apron.triangles) {
    const [a, b, c] = triangle.map((index) => points[index]);
    if (!a || !b || !c) continue;
    addTriangle(materialName, a, b, c, 0.005);
    apronTriangles += 1;
  }
}

const pointFor = (index) => {
  const point = airport.taxiwayPoints[index];
  return point ? toScene(point.longitude, point.latitude) : null;
};
const parkingFor = (index) => {
  const parking = airport.parkings[index];
  return parking ? toScene(parking.longitude, parking.latitude) : null;
};
const joinRadiusByPoint = new Map();
let pathSurfaces = 0;
let markingSegments = 0;
let edgeMarkingSegments = 0;
let centerlineLightSegments = 0;
const pathDirectionsByPoint = new Map();
const registerDirection = (index, from, to, width) => {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (!(length > 0.01)) return;
  const records = pathDirectionsByPoint.get(index) ?? [];
  records.push({ direction: [dx / length, dz / length], width });
  pathDirectionsByPoint.set(index, records);
};

for (const taxiwayPath of airport.taxiwayPaths) {
  const start = pointFor(taxiwayPath.start);
  const end = taxiwayPath.type === 3 ? parkingFor(taxiwayPath.end) : pointFor(taxiwayPath.end);
  if (!start || !end) continue;
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  if (!(length > 0.01)) continue;
  const ux = dx / length;
  const uz = dz / length;
  const right = [-uz, ux];

  if (taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5 && taxiwayPath.drawSurface !== false) {
    const material = surfaceName(taxiwayPath.surface, taxiwayPath.type);
    addStrip(material, start, end, taxiwayPath.widthMeters, 0.012);
    pathSurfaces += 1;
    joinRadiusByPoint.set(taxiwayPath.start, Math.max(joinRadiusByPoint.get(taxiwayPath.start) ?? 0, taxiwayPath.widthMeters / 2));
    if (taxiwayPath.type !== 3) joinRadiusByPoint.set(taxiwayPath.end, Math.max(joinRadiusByPoint.get(taxiwayPath.end) ?? 0, taxiwayPath.widthMeters / 2));
  }
  registerDirection(taxiwayPath.start, start, end, taxiwayPath.widthMeters);
  if (taxiwayPath.type !== 3) registerDirection(taxiwayPath.end, end, start, taxiwayPath.widthMeters);

  if (taxiwayPath.centerline || taxiwayPath.type === 2 || taxiwayPath.type === 3 || taxiwayPath.type === 6) {
    const materialName = taxiwayPath.type === 2 || taxiwayPath.type === 6 ? "white-marking" : "yellow-marking";
    const width = taxiwayPath.type === 2 ? 0.3 : taxiwayPath.type === 6 ? 0.12 : 0.18;
    if (taxiwayPath.type === 2) addDashedStrip(materialName, start, end, width, 30, 20, 0.045);
    else addStrip(materialName, start, end, width, 0.045);
    markingSegments += 1;
  }
  if (taxiwayPath.centerlineLighted) centerlineLightSegments += 1;

  const offset = Math.max(0.2, taxiwayPath.widthMeters / 2 - 0.28);
  const addEdge = (style, sign) => {
    if (!style) return;
    const a = [start[0] + right[0] * offset * sign, start[1] + right[1] * offset * sign];
    const b = [end[0] + right[0] * offset * sign, end[1] + right[1] * offset * sign];
    if (style === 2) addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.047);
    else addStrip("yellow-marking", a, b, 0.16, 0.047);
    edgeMarkingSegments += 1;
  };
  addEdge(taxiwayPath.leftEdge, 1);
  addEdge(taxiwayPath.rightEdge, -1);
}

let taxiwayJoinCount = 0;
for (const [pointIndex, radius] of joinRadiusByPoint) {
  const center = pointFor(pointIndex);
  if (!center || !(radius > 0.5)) continue;
  const connected = pathDirectionsByPoint.get(pointIndex) ?? [];
  const materialName = connected.some(({ width }) => width >= 35) ? "asphalt" : "concrete";
  addCircle(materialName, center, radius, 0.011, 24);
  taxiwayJoinCount += 1;
}

let holdShortCount = 0;
let ilsHoldShortCount = 0;
for (const point of airport.taxiwayPoints) {
  if (![2, 4].includes(point.type)) continue;
  const center = pointFor(point.index);
  const connected = (pathDirectionsByPoint.get(point.index) ?? []).sort((a, b) => b.width - a.width);
  if (!center || !connected.length) continue;
  let along = connected[0].direction;
  if (point.orientation === 2) along = [-along[0], -along[1]];
  const across = [-along[1], along[0]];
  const width = Math.max(8, connected[0].width * 0.88);
  const lineWidth = 0.22;
  for (const distance of [-0.9, -0.3]) {
    addOrientedRect("yellow-marking", pointAlong(center, along, across, distance), across, along, width, lineWidth, 0.055);
  }
  for (const distance of [0.3, 0.9]) {
    const dashWidth = Math.max(1.2, width / 8);
    for (let lateral = -width / 2 + dashWidth / 2; lateral < width / 2; lateral += dashWidth * 2) {
      addOrientedRect("yellow-marking", pointAlong(center, along, across, distance, lateral), across, along, dashWidth, lineWidth, 0.055);
    }
  }
  if (point.type === 4) ilsHoldShortCount += 1;
  else holdShortCount += 1;
}

const runwayDetails = [];
let runwayMarkingElementCount = 0;
let runwayEdgeLightCount = 0;
let runwayCenterLightCount = 0;
const FLAG = Object.freeze({ EDGES: 1, THRESHOLD: 2, FIXED_DISTANCE: 4, TOUCHDOWN: 8, DASHES: 16, IDENT: 32, PRECISION: 64 });
for (const runway of airport.runways) {
  const center = toScene(runway.longitude, runway.latitude);
  const radians = runway.headingDegrees * Math.PI / 180;
  const along = [Math.cos(radians), Math.sin(radians)];
  const across = [-along[1], along[0]];
  const length = runway.lengthMeters;
  const width = runway.widthMeters;
  addOrientedRect("asphalt", center, along, across, length, width, 0.024);
  const primaryThreshold = pointAlong(center, along, across, -length / 2 + runway.primaryOffsetThresholdMeters);
  const secondaryThreshold = pointAlong(center, along, across, length / 2 - runway.secondaryOffsetThresholdMeters);

  if (runway.markingFlags & FLAG.EDGES) {
    for (const side of [-1, 1]) {
      const lateral = side * (width / 2 - 0.45);
      addStrip("white-marking", pointAlong(center, along, across, -length / 2, lateral), pointAlong(center, along, across, length / 2, lateral), 0.32, 0.061);
      runwayMarkingElementCount += 1;
    }
  }
  if (runway.markingFlags & FLAG.DASHES) {
    addDashedStrip("white-marking", pointAlong(primaryThreshold, along, across, 55), pointAlong(secondaryThreshold, along, across, -55), 0.42, 30, 20, 0.063);
    runwayMarkingElementCount += 1;
  }

  const addEndMarkings = (threshold, direction, ident) => {
    const inward = direction;
    if (runway.markingFlags & FLAG.THRESHOLD) {
      const stripeCount = Math.max(4, Math.min(8, Math.round(width / 6)));
      const available = width - 4;
      const stripeWidth = Math.min(1.8, available / (stripeCount * 1.7));
      const step = available / stripeCount;
      for (let index = 0; index < stripeCount; index += 1) {
        const lateral = -available / 2 + step * (index + 0.5);
        addOrientedRect("white-marking", pointAlong(threshold, inward, across, 7, lateral), inward, across, 14, stripeWidth, 0.066);
        runwayMarkingElementCount += 1;
      }
    }
    if (runway.markingFlags & FLAG.FIXED_DISTANCE) {
      for (const side of [-1, 1]) {
        addOrientedRect("white-marking", pointAlong(threshold, inward, across, 300, side * Math.min(10.5, width * 0.27)), inward, across, 45, 2.8, 0.066);
        runwayMarkingElementCount += 1;
      }
    }
    if (runway.markingFlags & (FLAG.TOUCHDOWN | FLAG.PRECISION)) {
      for (const distance of [150, 450, 600, 750]) {
        const pairs = distance === 150 ? 3 : distance === 450 ? 2 : 1;
        for (let pair = 0; pair < pairs; pair += 1) {
          const lateral = 7.5 + pair * 4;
          for (const side of [-1, 1]) {
            addOrientedRect("white-marking", pointAlong(threshold, inward, across, distance, side * lateral), inward, across, 22, 1.4, 0.066);
            runwayMarkingElementCount += 1;
          }
        }
      }
    }
    return {
      ident,
      x: pointAlong(threshold, inward, across, 52)[0],
      z: pointAlong(threshold, inward, across, 52)[1],
      headingDegrees: Math.atan2(inward[1], inward[0]) * 180 / Math.PI,
    };
  };
  const primaryLabel = addEndMarkings(primaryThreshold, along, runway.primary);
  const secondaryLabel = addEndMarkings(secondaryThreshold, [-along[0], -along[1]], runway.secondary);

  if (runway.edgeLightIntensity > 0) runwayEdgeLightCount += Math.max(2, Math.floor(length / 60) * 2);
  if (runway.centerLightIntensity > 0) runwayCenterLightCount += Math.max(2, Math.floor(length / 30));
  runwayDetails.push({
    ...runway,
    center: { x: center[0], z: center[1] },
    primaryThreshold: { x: primaryThreshold[0], z: primaryThreshold[1] },
    secondaryThreshold: { x: secondaryThreshold[0], z: secondaryThreshold[1] },
    labels: [primaryLabel, secondaryLabel],
  });
}

const materialDefinitions = [
  ["airport-base", [0.37, 0.34, 0.30, 1], 0.96],
  ["concrete", [0.52, 0.53, 0.52, 1], 0.94],
  ["asphalt", [0.20, 0.22, 0.24, 1], 0.96],
  ["service-road", [0.29, 0.30, 0.31, 1], 0.95],
  ["yellow-marking", [1, 0.72, 0, 1], 0.78],
  ["white-marking", [0.97, 0.97, 0.94, 1], 0.80],
];
const chunks = [];
const bufferViews = [];
const accessors = [];
let byteLength = 0;
const align = () => {
  const padding = (4 - byteLength % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); byteLength += padding; }
};
const append = (typedArray, target) => {
  align();
  const buffer = Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  const index = bufferViews.length;
  bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: buffer.length, target });
  chunks.push(buffer);
  byteLength += buffer.length;
  return index;
};
const addAccessor = (bufferView, count, type, min, max) => {
  const index = accessors.length;
  accessors.push({ bufferView, componentType: 5126, count, type, ...(min ? { min } : {}), ...(max ? { max } : {}) });
  return index;
};
const primitives = [];
const materials = [];
for (const [name, color, roughness] of materialDefinitions) {
  const group = groups.get(name);
  if (!group?.positions.length) continue;
  const positions = Float32Array.from(group.positions);
  const normals = Float32Array.from(group.normals);
  const uvs = Float32Array.from(group.uvs);
  const primitiveMin = [Infinity, Infinity, Infinity];
  const primitiveMax = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < group.positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      primitiveMin[axis] = Math.min(primitiveMin[axis], group.positions[index + axis]);
      primitiveMax[axis] = Math.max(primitiveMax[axis], group.positions[index + axis]);
    }
  }
  const attributes = {
    POSITION: addAccessor(append(positions, 34962), positions.length / 3, "VEC3", primitiveMin, primitiveMax),
    NORMAL: addAccessor(append(normals, 34962), normals.length / 3, "VEC3"),
    TEXCOORD_0: addAccessor(append(uvs, 34962), uvs.length / 2, "VEC2"),
  };
  const material = materials.length;
  materials.push({ name, pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: 0, roughnessFactor: roughness }, doubleSided: true });
  primitives.push({ attributes, material, mode: 4, extras: { triangleCount: group.triangles, layer: name } });
}

align();
const binName = "kphx-ground.bin";
fs.writeFileSync(path.join(outputDir, binName), Buffer.concat(chunks, byteLength));
const extras = {
  schemaVersion: 2,
  source: "KPHX_ADEX.BGL",
  airport: "KPHX",
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  detailLevel: "airport-wide-source-runways-taxiways-hold-shorts-v1",
  anchor: { gate: "A1", parkingIndex: a1.index, headingDegrees: a1.headingDegrees, longitude: a1.longitude, latitude: a1.latitude },
  counts: {
    taxiwayPoints: airport.taxiwayPoints.length,
    taxiwayPaths: airport.taxiwayPaths.length,
    taxiwayNames: airport.taxiwayNames.length,
    parkings: airport.parkings.length,
    apronRecords: airport.aprons.length,
    apronTriangles,
    pathSurfaces,
    markingSegments,
    edgeMarkingSegments,
    taxiwayJoinCount,
    holdShortCount,
    ilsHoldShortCount,
    runways: airport.runways.length,
    runwayMarkingElementCount,
    runwayEdgeLightCount,
    runwayCenterLightCount,
    centerlineLightSegments,
  },
  bounds: { min: boundsMin, max: boundsMax, margin: 350 },
  taxiwayNames: airport.taxiwayNames,
  runways: runwayDetails,
};
const gltf = {
  asset: { version: "2.0", generator: "RampReady source-driven KPHX simulator ground builder" },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: "PHX_KPHX_AuthoredGround", mesh: 0 }],
  meshes: [{ name: "PHX_KPHX_AuthoredGroundMesh", primitives }],
  materials,
  buffers: [{ uri: binName, byteLength }],
  bufferViews,
  accessors,
  extras,
};
fs.writeFileSync(path.join(outputDir, "kphx-ground.gltf"), `${JSON.stringify(gltf, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, "ground-manifest.json"), `${JSON.stringify(extras, null, 2)}\n`);
console.log(JSON.stringify({ binBytes: byteLength, primitiveCount: primitives.length, counts: extras.counts, runways: runwayDetails.map(({ primary, secondary, lengthMeters, widthMeters, headingDegrees }) => ({ primary, secondary, lengthMeters, widthMeters, headingDegrees })) }, null, 2));
