import fs from "node:fs/promises";
import path from "node:path";

const [, , facPath, wedPath, outPath] = process.argv;
if (!facPath || !wedPath || !outPath) {
  throw new Error("Usage: node scripts/compile-xp11-jetway-facade.mjs <fac> <wed-json> <out-json>");
}

const EARTH_RADIUS_METERS = 6378137;
const ANCHOR = Object.freeze({
  latitude: 33.436530675,
  longitude: -111.998921221,
  rampReadyPosition: [0, 0, 6.2],
});
const radians = (value) => value * Math.PI / 180;

function wedToRampReady(latitude, longitude, elevation = 0) {
  const east = radians(longitude - ANCHOR.longitude)
    * EARTH_RADIUS_METERS
    * Math.cos(radians(ANCHOR.latitude));
  const north = radians(latitude - ANCHOR.latitude) * EARTH_RADIUS_METERS;
  return [
    -north + ANCHOR.rampReadyPosition[0],
    elevation + ANCHOR.rampReadyPosition[1],
    -east + ANCHOR.rampReadyPosition[2],
  ];
}

function length2(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}
function normalize(v) {
  const length = Math.hypot(v[0], v[1]);
  if (length < 1e-12) throw new Error("Degenerate facade direction");
  return [v[0] / length, v[1] / length];
}
function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1]; }
function scale(v, amount) { return [v[0] * amount, v[1] * amount]; }
function perpendicularClockwise(v) { return [v[1], -v[0]]; }
function perpendicularCounterClockwise(v) { return [-v[1], v[0]]; }
function closerTo(a, b, x) { return Math.abs(x - a) > Math.abs(x - b); }
function intLimit(value, low, high) {
  return Math.max(low, Math.min(high, Math.trunc(value)));
}

function pickSpelling(spellings, lengthMeters) {
  if (!spellings.length) throw new Error("Facade wall has no spellings");
  const choice = { indices: [], widths: [], total: 0 };
  let seed = 0;

  while (true) {
    if (choice.total + spellings.at(-1).total < lengthMeters) {
      const low = intLimit(spellings.length / 4, 0, spellings.length - 1);
      const high = intLimit(spellings.length * 3 / 4, 0, spellings.length - 1);
      const selected = spellings[Math.trunc((low + high) / 2)];
      choice.indices.push(...selected.indices);
      choice.widths.push(...selected.widths);
      choice.total += selected.total;
      seed += 1;
    } else {
      let best = -1;
      for (let index = spellings.length - 1; index >= 0; index -= 1) {
        if (closerTo(choice.total, choice.total + spellings[index].total, lengthMeters)) {
          if (
            best === -1
            || closerTo(
              choice.total + spellings[best].total,
              choice.total + spellings[index].total,
              lengthMeters,
            )
          ) {
            best = index;
            if (choice.total + spellings[index].total < lengthMeters) break;
          }
        }
      }
      if (best === -1) break;
      choice.indices.push(...spellings[best].indices);
      choice.widths.push(...spellings[best].widths);
      choice.total += spellings[best].total;
      break;
    }
  }

  if (!choice.indices.length) {
    choice.indices.push(...spellings[0].indices);
    choice.widths.push(...spellings[0].widths);
    choice.total = spellings[0].total;
  }
  return choice;
}

function parseFacade(source) {
  const lines = source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const objects = [];
  const templates = new Map();
  const walls = [];
  let isRing = false;
  let currentTemplate = null;
  let currentMesh = null;
  let currentWall = null;

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts[0] === "RING") {
      isRing = Number(parts[1]) !== 0;
      continue;
    }
    if (parts[0] === "OBJ") {
      objects.push(parts.slice(1).join(" "));
      continue;
    }
    if (parts[0] === "SEGMENT" || parts[0] === "SEGMENT_CURVED") {
      currentTemplate = {
        index: Number(parts[1]),
        curved: parts[0] === "SEGMENT_CURVED",
        meshes: [],
        attachments: [],
        bounds: [0, 0, 0],
      };
      templates.set(
        `${currentTemplate.index}:${currentTemplate.curved ? "c" : "s"}`,
        currentTemplate,
      );
      currentMesh = null;
      currentWall = null;
      continue;
    }
    if (parts[0] === "MESH" && currentTemplate) {
      currentMesh = { vertices: [], indices: [] };
      currentTemplate.meshes.push(currentMesh);
      continue;
    }
    if (parts[0] === "VERTEX" && currentMesh) {
      currentMesh.vertices.push({
        position: parts.slice(1, 4).map(Number),
        normal: parts.slice(4, 7).map(Number),
        uv: parts.slice(7, 9).map(Number),
      });
      continue;
    }
    if (parts[0] === "IDX" && currentMesh) {
      currentMesh.indices.push(...parts.slice(1).map(Number));
      continue;
    }
    if (parts[0] === "ATTACH_GRADED" && currentTemplate) {
      const objectIndex = Number(parts[1]);
      currentTemplate.attachments.push({
        objectIndex,
        object: objects[objectIndex],
        x: Number(parts[2]),
        y: Number(parts[3]),
        z: Number(parts[4]),
        yawDegrees: Number(parts[5]),
      });
      continue;
    }
    if (parts[0] === "WALL") {
      currentWall = {
        index: walls.length,
        name: parts.slice(5).join(" "),
        spellings: [],
      };
      walls.push(currentWall);
      currentTemplate = null;
      currentMesh = null;
      continue;
    }
    if (parts[0] === "SPELLING" && currentWall) {
      currentWall.spellings.push({ indices: parts.slice(1).map(Number) });
    }
  }

  for (const template of templates.values()) {
    const points = template.meshes.flatMap((mesh) => mesh.vertices.map((vertex) => vertex.position));
    if (!points.length) throw new Error(`Facade template ${template.index} has no mesh`);
    const min = [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis])));
    const max = [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis])));
    template.bounds = [max[0] - min[0], max[0], max[2] - min[2]];

    // Mirror WED_ResourceMgr.cpp exactly: right-adjust wall templates from -width to 0.
    for (const mesh of template.meshes) {
      for (const vertex of mesh.vertices) vertex.position[2] -= max[2];
    }
  }

  for (const wall of walls) {
    for (const spelling of wall.spellings) {
      spelling.widths = spelling.indices.map(
        (index) => templates.get(`${index}:s`).bounds[2],
      );
      spelling.total = spelling.widths.reduce((sum, width) => sum + width, 0);
    }
    // Mirror WED_ResourceMgr.cpp: spellings are sorted by total width before picking.
    wall.spellings.sort((a, b) => a.total - b.total);
  }

  return { objects, templates, walls, isRing };
}

function segmentIsCurved(a, b) {
  return (
    Math.abs(Number(a.ctrlLatitudeHi ?? 0)) > 1e-14
    || Math.abs(Number(a.ctrlLongitudeHi ?? 0)) > 1e-14
    || Math.abs(Number(b.ctrlLatitudeLo ?? 0)) > 1e-14
    || Math.abs(Number(b.ctrlLongitudeLo ?? 0)) > 1e-14
  );
}

function transformLocal(start, end, x, z) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  const forwardX = dx / length;
  const forwardZ = dz / length;
  const rightX = forwardZ;
  const rightZ = -forwardX;
  return [
    start[0] + rightX * x + forwardX * (-z),
    start[1] + rightZ * x + forwardZ * (-z),
  ];
}

function yawForEdge(start, end) {
  return Math.atan2(-(end[0] - start[0]), -(end[1] - start[1]));
}

function computeMiters(points, wallIndex, isRing) {
  const count = points.length;
  const start = points[wallIndex];
  const end = points[wallIndex + 1] ?? points[0];
  const segmentDirection = normalize([end[0] - start[0], end[1] - start[1]]);
  const perpendicular = perpendicularClockwise(segmentDirection);
  let miter;

  if (wallIndex === 0 && !isRing) {
    miter = perpendicular;
  } else {
    const previousPoint = points[(wallIndex - 1 + count) % count];
    const previousDirection = normalize([
      start[0] - previousPoint[0],
      start[1] - previousPoint[1],
    ]);
    const tangent = normalize(add(previousDirection, segmentDirection));
    miter = perpendicularCounterClockwise(tangent);
    miter = scale(miter, 1 / dot(miter, perpendicular));
  }

  const first = dot(miter, segmentDirection);
  let last = 0;
  if (isRing || wallIndex < count - 2) {
    const nextPoint = points[(wallIndex + 2) % count];
    const nextDirection = normalize([
      nextPoint[0] - end[0],
      nextPoint[1] - end[1],
    ]);
    const tangent = normalize(add(nextDirection, segmentDirection));
    let nextMiter = perpendicularCounterClockwise(tangent);
    nextMiter = scale(nextMiter, 1 / dot(nextMiter, perpendicular));
    last = -dot(nextMiter, segmentDirection);
  }

  return { first, last };
}

const facade = parseFacade(await fs.readFile(facPath, "utf8"));
const wed = JSON.parse(await fs.readFile(wedPath, "utf8"));
const output = {
  authority: "KPHX-1.75.1-WED + XP11 jetway_1_solid.fac + Laminar WED facade spelling/transform semantics",
  laminarReference: "X-Plane/xptools WED_FacadePreview.cpp + WED_ResourceMgr.cpp @ a3725c8f5ed6d9681573496ab0153e550d54cd09",
  sourceFacade: path.basename(facPath),
  facadeResource: "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac",
  facadeObjectCount: facade.objects.length,
  facadeWallCount: facade.walls.length,
  isRing: facade.isRing,
  placements: [],
};

for (const placement of wed.placements.filter(
  (entry) => entry.resource === output.facadeResource,
)) {
  const nodes = placement.rings[0].nodes;
  const points3 = nodes.map((node) => wedToRampReady(
    Number(node.latitude),
    Number(node.longitude),
    0,
  ));
  const points = points3.map((point) => [point[0], point[2]]);
  const wallCount = facade.isRing ? nodes.length : nodes.length - 1;
  const result = {
    wedObjectId: placement.wedObjectId,
    height: Number(placement.height),
    nodeCount: nodes.length,
    wallCount,
    edges: [],
    objectInstances: [],
    meshChunks: [],
    blockedExactCurve: false,
    sourceBezierEdges: [],
    visualCurvePolicy: "Laminar-WED-FacadePreview-endpoint-chord-v1",
  };

  for (let index = 0; index < wallCount; index += 1) {
    const nextIndex = (index + 1) % nodes.length;
    if (segmentIsCurved(nodes[index], nodes[nextIndex])) {
      result.sourceBezierEdges.push({
        edgeIndex: index,
        startNodeWedObjectId: nodes[index].wedObjectId,
        endNodeWedObjectId: nodes[nextIndex].wedObjectId,
        start: {
          latitude: Number(nodes[index].latitude),
          longitude: Number(nodes[index].longitude),
          ctrlLatitudeHi: Number(nodes[index].ctrlLatitudeHi ?? 0),
          ctrlLongitudeHi: Number(nodes[index].ctrlLongitudeHi ?? 0),
        },
        end: {
          latitude: Number(nodes[nextIndex].latitude),
          longitude: Number(nodes[nextIndex].longitude),
          ctrlLatitudeLo: Number(nodes[nextIndex].ctrlLatitudeLo ?? 0),
          ctrlLongitudeLo: Number(nodes[nextIndex].ctrlLongitudeLo ?? 0),
        },
        dsfExportPolicy: "WED_DSFExport-preserves-Bezier-controls",
        wedPreviewPolicy: "WED_PreviewLayer-preview_facade-uses-b.p1-and-final-b.p2",
      });
    }
  }

  for (let wallNumber = 0; wallNumber < wallCount; wallNumber += 1) {
    const start = points[wallNumber];
    const end = points[(wallNumber + 1) % points.length];
    const edgeLength = length2(start, end);
    const wallMatch = /Wall\s+(\d+)/i.exec(nodes[wallNumber].wallType || "");
    if (!wallMatch) throw new Error(`Invalid WED wall type ${nodes[wallNumber].wallType}`);
    const selectedWallIndex = Number(wallMatch[1]) - 1;
    const selectedWall = facade.walls[selectedWallIndex];
    if (!selectedWall) throw new Error(`Facade wall ${selectedWallIndex} is missing`);

    const spelling = pickSpelling(selectedWall.spellings, edgeLength);
    const lengthScale = edgeLength / spelling.total;
    const yawRadians = yawForEdge(start, end);
    const miters = computeMiters(points, wallNumber, facade.isRing);

    result.edges.push({
      edgeIndex: wallNumber,
      start,
      end,
      lengthMeters: edgeLength,
      wallType: nodes[wallNumber].wallType,
      wallIndex: selectedWallIndex,
      wallName: selectedWall.name,
      spelling: [...spelling.indices],
      naturalLengthMeters: spelling.total,
      lengthScale,
      miterFirst: miters.first,
      miterLast: miters.last,
    });

    let cumulativeNaturalLength = 0;
    spelling.indices.forEach((templateIndex, spellingIndex) => {
      const template = facade.templates.get(`${templateIndex}:s`);
      if (!template) throw new Error(`Facade template ${templateIndex} is missing`);

      for (const attachment of template.attachments) {
        const localZ = (-cumulativeNaturalLength + attachment.z) * lengthScale;
        const position2 = transformLocal(start, end, attachment.x, localZ);
        result.objectInstances.push({
          edgeIndex: wallNumber,
          templateIndex,
          objectIndex: attachment.objectIndex,
          object: attachment.object,
          position: [position2[0], attachment.y, position2[1]],
          yawRadians: yawRadians + radians(attachment.yawDegrees),
          sourceLocal: {
            x: attachment.x,
            y: attachment.y,
            z: attachment.z,
          },
          templateOffsetMeters: cumulativeNaturalLength * lengthScale,
        });
      }

      for (const [meshIndex, mesh] of template.meshes.entries()) {
        const vertices = mesh.vertices.map((vertex) => {
          let localTemplateZ = vertex.position[2];
          const localX = vertex.position[0];

          // Mirror the WED preview's first/last wall miter deformation.
          if (spellingIndex === 0) {
            localTemplateZ += miters.first
              * localX
              * (1 + localTemplateZ / template.bounds[2]);
          }
          if (spellingIndex === spelling.indices.length - 1) {
            localTemplateZ += miters.last
              * localX
              * localTemplateZ
              / template.bounds[2];
          }

          const localZ = (-cumulativeNaturalLength + localTemplateZ) * lengthScale;
          const position2 = transformLocal(start, end, localX, localZ);

          const normalX = vertex.normal[0];
          const normalY = vertex.normal[1];
          const normalZ = vertex.normal[2] / lengthScale;
          const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
          const normal2 = transformLocal(
            [0, 0],
            [end[0] - start[0], end[1] - start[1]],
            normalX / normalLength,
            normalZ / normalLength,
          );

          return {
            position: [position2[0], vertex.position[1], position2[1]],
            normal: [normal2[0], normalY / normalLength, normal2[1]],
            uv: vertex.uv,
          };
        });

        result.meshChunks.push({
          edgeIndex: wallNumber,
          templateIndex,
          meshIndex,
          vertices,
          indices: mesh.indices,
        });
      }

      cumulativeNaturalLength += template.bounds[2];
    });
  }

  output.placements.push(result);
}

await fs.writeFile(outPath, `${JSON.stringify(output)}\n`, "utf8");
console.log(JSON.stringify({
  placementCount: output.placements.length,
  readyPlacementCount: output.placements.length,
  blockedCurvePlacements: [],
  placementsWithAuthoredBezier: output.placements
    .filter((entry) => entry.sourceBezierEdges.length)
    .map((entry) => entry.wedObjectId),
  objectInstanceCount: output.placements.reduce(
    (sum, entry) => sum + entry.objectInstances.length,
    0,
  ),
  wallMeshChunkCount: output.placements.reduce(
    (sum, entry) => sum + entry.meshChunks.length,
    0,
  ),
  a1: output.placements.find((entry) => entry.wedObjectId === 104804),
}, null, 2));
