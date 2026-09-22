import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const [, , jetwayDirArg, textureDirArg, outputDirArg] = process.argv;
if (!jetwayDirArg || !textureDirArg || !outputDirArg) {
  throw new Error("Usage: node scripts/materialize-xp11-stock-jetway-facade.mjs <jetway-dir> <texture-dir> <output-dir>");
}

const jetwayDir = path.resolve(jetwayDirArg);
const textureDir = path.resolve(textureDirArg);
const outputDir = path.resolve(outputDirArg);
const facPath = path.join(jetwayDir, "jetway_1_solid.fac");
const converterPath = path.resolve("scripts/convert-kphx-obj8-to-gltf.mjs");

const sha256File = async (filePath) => {
  const data = await fsp.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
};

const source = await fsp.readFile(facPath, "utf8");
const objects = [];
const segments = new Map();
const walls = [];
let currentSegment = null;
let currentMesh = null;
let currentWall = null;
let segmentMode = null;

for (const rawLine of source.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const parts = line.split(/\s+/);
  const command = parts[0];

  if (command === "OBJ") {
    objects.push(parts.slice(1).join(" "));
    continue;
  }

  if (command === "SEGMENT" || command === "SEGMENT_CURVED") {
    segmentMode = command === "SEGMENT" ? "regular" : "curved";
    currentMesh = null;
    currentWall = null;
    const index = Number(parts[1]);
    if (segmentMode === "regular") {
      currentSegment = {
        index,
        meshes: [],
        attachments: [],
      };
      segments.set(index, currentSegment);
    } else {
      currentSegment = null;
    }
    continue;
  }

  if (command === "MESH" && currentSegment) {
    currentMesh = {
      group: Number(parts[1]),
      farLod: Number(parts[2]),
      cuts: Number(parts[3]),
      declaredVertexCount: Number(parts[4]),
      declaredIndexCount: Number(parts[5]),
      vertices: [],
      indices: [],
    };
    currentSegment.meshes.push(currentMesh);
    continue;
  }

  if (command === "VERTEX" && currentMesh) {
    currentMesh.vertices.push(parts.slice(1, 9).map(Number));
    continue;
  }

  if (command === "IDX" && currentMesh) {
    currentMesh.indices.push(...parts.slice(1).map(Number));
    continue;
  }

  if (command === "ATTACH_GRADED" && currentSegment) {
    currentSegment.attachments.push({
      objectIndex: Number(parts[1]),
      x: Number(parts[2]),
      y: Number(parts[3]),
      z: Number(parts[4]),
      headingDegrees: Number(parts[5]),
      lod: parts.length >= 8 ? [Number(parts[6]), Number(parts[7])] : null,
    });
    continue;
  }

  if (command === "WALL") {
    currentSegment = null;
    currentMesh = null;
    segmentMode = null;
    currentWall = {
      index: walls.length,
      minWidth: Number(parts[1]),
      maxWidth: Number(parts[2]),
      minHeading: Number(parts[3]),
      maxHeading: Number(parts[4]),
      name: parts.slice(5).join(" "),
      spellings: [],
    };
    walls.push(currentWall);
    continue;
  }

  if (command === "SPELLING" && currentWall) {
    currentWall.spellings.push(parts.slice(1).map(Number));
  }
}

for (const segment of segments.values()) {
  const z = [];
  for (const mesh of segment.meshes) {
    if (mesh.vertices.length !== mesh.declaredVertexCount) {
      throw new Error(`Segment ${segment.index} vertex count mismatch`);
    }
    if (mesh.indices.length !== mesh.declaredIndexCount) {
      throw new Error(`Segment ${segment.index} index count mismatch`);
    }
    for (const vertex of mesh.vertices) z.push(vertex[2]);
  }
  if (!z.length) throw new Error(`Segment ${segment.index} has no regular mesh vertices`);
  segment.nominalLengthMeters = Math.max(...z) - Math.min(...z);
  if (!(segment.nominalLengthMeters > 0)) {
    throw new Error(`Segment ${segment.index} has invalid nominal length`);
  }
}

if (objects.length !== 18) throw new Error(`Expected 18 stock jetway OBJ references, found ${objects.length}`);
if (segments.size !== 24) throw new Error(`Expected 24 regular facade segments, found ${segments.size}`);
if (walls.length !== 9) throw new Error(`Expected 9 facade wall definitions, found ${walls.length}`);

await fsp.rm(outputDir, { recursive: true, force: true });
await fsp.mkdir(path.join(outputDir, "objects"), { recursive: true });

const textureNames = ["jetway_1_ALB.png", "jetway_1_LIT.png", "jetway_1_NML.png"];
const textureRecords = [];
for (const name of textureNames) {
  const sourcePath = path.join(textureDir, name);
  const destPath = path.join(outputDir, name);
  await fsp.copyFile(sourcePath, destPath);
  textureRecords.push({
    name,
    sha256: await sha256File(sourcePath),
  });
}

const objectRecords = [];
for (let index = 0; index < objects.length; index += 1) {
  const sourceName = objects[index];
  const sourcePath = path.join(jetwayDir, sourceName);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing stock facade OBJ: ${sourceName}`);
  const runtimeName = path.basename(sourceName, path.extname(sourceName));
  const objectOutput = path.join(outputDir, "objects");
  execFileSync(process.execPath, [
    converterPath,
    sourcePath,
    objectOutput,
    `--name=${runtimeName}`,
    "--diffuse=../jetway_1_ALB.png",
    "--lit=../jetway_1_LIT.png",
    "--normal=../jetway_1_NML.png",
    "--normal-scale=1",
  ], { stdio: "inherit" });
  objectRecords.push({
    index,
    sourceName,
    runtimeGltf: `objects/${runtimeName}.gltf`,
    sha256: await sha256File(sourcePath),
  });
}

await fsp.copyFile(facPath, path.join(outputDir, "jetway_1_solid.fac"));

const manifest = {
  authority: "Laminar X-Plane 11 stock Jetway_1_solid.fac exact-source materialization v1",
  sourceResource: "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac",
  sourceFacadeFile: "jetway_1_solid.fac",
  sourceFacadeSha256: await sha256File(facPath),
  sourceGeometryPolicy: "FAC spellings/segments/attachments are parsed directly; attached OBJ8 geometry is converted without remesh or decimation",
  wedWallNumberPolicy: "WED labels Wall N are human-readable one-based labels for zero-based FAC wall index N-1",
  spellingFitPolicy: "choose the source spelling with nominal segment length closest to the authored wall edge length; stretch/squish along the wall axis as specified by X-Plane facade rules",
  textures: textureRecords,
  objects: objectRecords,
  segments: [...segments.values()].sort((a, b) => a.index - b.index),
  walls,
};

await fsp.writeFile(
  path.join(outputDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8",
);

console.log(JSON.stringify({
  outputDir,
  sourceFacadeSha256: manifest.sourceFacadeSha256,
  objectCount: objectRecords.length,
  segmentCount: manifest.segments.length,
  wallCount: manifest.walls.length,
  textureCount: textureRecords.length,
}, null, 2));
