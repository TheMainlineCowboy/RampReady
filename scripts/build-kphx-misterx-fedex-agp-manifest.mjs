import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const sourcePath = process.argv[2]
  || "assets/kphx-source/dependencies/MisterX_Library_2.0c/MisterX_Library/Vehicles/Trucks/Truck_Fedex.agp";
const authorityPath = process.argv[3]
  || "reports/kphx-full-misterx-agp-authority.json";
const outputPath = process.argv[4]
  || "public/models/kphx-full-airport/batches/full-misterx-fedex-truck-agp.manifest.json";

const source = fs.readFileSync(sourcePath, "utf8");
const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8"));

const lines = source
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*/, "").trim())
  .filter(Boolean);

let textureScale = null;
let textureWidthMeters = null;
let tile = null;
let rotationQuarterTurns = 0;
let anchorPixel = null;
const objects = [];
const children = [];

for (const line of lines) {
  const parts = line.split(/\s+/);
  const command = parts[0];

  if (command === "TEXTURE_SCALE") {
    textureScale = [Number(parts[1]), Number(parts[2])];
  } else if (command === "TEXTURE_WIDTH") {
    textureWidthMeters = Number(parts[1]);
  } else if (command === "OBJECT") {
    objects.push(parts.slice(1).join(" "));
  } else if (command === "TILE") {
    tile = parts.slice(1, 5).map(Number);
  } else if (command === "ROTATION") {
    rotationQuarterTurns = Number(parts[1]);
  } else if (command === "ANCHOR_PT") {
    anchorPixel = [Number(parts[1]), Number(parts[2])];
  } else if (command === "OBJ_DRAPED") {
    children.push({
      pixel: [Number(parts[1]), Number(parts[2])],
      headingOffsetDegrees: Number(parts[3]),
      objectIndex: Number(parts[4]),
    });
  }
}

if (!textureScale || textureScale.length !== 2 || textureScale.some((value) => !Number.isFinite(value) || value <= 0)) {
  throw new Error("Truck_Fedex.agp TEXTURE_SCALE is missing or invalid");
}
if (!Number.isFinite(textureWidthMeters) || textureWidthMeters <= 0) {
  throw new Error("Truck_Fedex.agp TEXTURE_WIDTH is missing or invalid");
}
if (!tile || tile.length !== 4 || tile.some((value) => !Number.isFinite(value))) {
  throw new Error("Truck_Fedex.agp TILE is missing or invalid");
}
if (rotationQuarterTurns !== 0) {
  throw new Error(`Truck_Fedex.agp ROTATION changed: expected 0, got ${rotationQuarterTurns}`);
}
if (objects.length !== 2 || children.length !== 2) {
  throw new Error(`Truck_Fedex.agp child contract changed: objects=${objects.length}, children=${children.length}`);
}
if (authority.resource !== "MisterX_Library/Vehicles/Trucks/Truck_Fedex.agp") {
  throw new Error(`Unexpected AGP authority resource: ${authority.resource}`);
}
if (authority.placementCount !== 17 || authority.placements?.length !== 17) {
  throw new Error(`FedEx AGP WED placement contract changed: ${authority.placementCount}/${authority.placements?.length}`);
}

const [left, bottom, right, top] = tile;
const resolvedAnchorPixel = anchorPixel || [
  (left + right) / 2,
  (bottom + top) / 2,
];
const metersPerPixel = textureWidthMeters / textureScale[0];

const assetUrlByObject = {
  "Trailer_Fedex.obj": "/models/kphx-full-airport/external/MisterX_Library/Vehicles/Trucks/Trailer_Fedex/Trailer_Fedex.gltf",
  "Peterbilt_359_White.obj": "/models/kphx-full-airport/external/MisterX_Library/Vehicles/Trucks/Peterbilt_359_White/Peterbilt_359_White.gltf",
};

const runtimeChildren = children.map((child) => {
  const object = objects[child.objectIndex];
  if (!object) throw new Error(`AGP OBJ_DRAPED references missing object index ${child.objectIndex}`);
  const assetUrl = assetUrlByObject[object];
  if (!assetUrl) throw new Error(`No exact runtime asset mapping for AGP child ${object}`);

  const xMeters = (child.pixel[0] - resolvedAnchorPixel[0]) * metersPerPixel;
  const zMeters = (child.pixel[1] - resolvedAnchorPixel[1]) * metersPerPixel;

  return {
    objectIndex: child.objectIndex,
    sourceObject: object,
    sourceResource: `MisterX_Library/Vehicles/Trucks/${object}`,
    assetUrl,
    pixel: child.pixel,
    xPlaneLocalOffsetMeters: [xMeters, 0, zMeters],
    headingOffsetDegrees: child.headingOffsetDegrees,
    draped: true,
  };
});

if (runtimeChildren.some((child) => child.headingOffsetDegrees !== 0)) {
  throw new Error("Truck_Fedex.agp authored child heading contract changed");
}

const payload = {
  schemaVersion: 1,
  authority: "KPHX 1.75.1 WED placement + exact MisterX_Library 2.0c Truck_Fedex.agp",
  source: {
    airportPackage: "KPHX - Phoenix Sky Harbor Intl",
    airportVersion: "1.75.1",
    dependency: "MisterX_Library",
    dependencyVersion: "2.0c",
    agpPath: sourcePath.replaceAll("\\", "/"),
    agpSha256: crypto.createHash("sha256").update(fs.readFileSync(sourcePath)).digest("hex"),
    placementAuthority: authorityPath.replaceAll("\\", "/"),
  },
  resource: authority.resource,
  placementCount: authority.placementCount,
  tile: {
    textureScalePixels: textureScale,
    textureWidthMeters,
    metersPerPixel,
    boundsPixels: tile,
    rotationQuarterTurns,
    anchorPixel: resolvedAnchorPixel,
    anchorPolicy: anchorPixel ? "explicit ANCHOR_PT" : "tile center (AGP default)",
    hideTiles: lines.includes("HIDE_TILES"),
  },
  children: runtimeChildren,
  placements: authority.placements,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n");

console.log(JSON.stringify({
  outputPath,
  placementCount: payload.placementCount,
  childCount: payload.children.length,
  metersPerPixel,
  children: payload.children.map((child) => ({
    sourceObject: child.sourceObject,
    xPlaneLocalOffsetMeters: child.xPlaneLocalOffsetMeters,
    headingOffsetDegrees: child.headingOffsetDegrees,
  })),
}, null, 2));
