import fs from "node:fs";
import path from "node:path";

const manifestPath = "public/models/kphx-photo/photo-manifest.json";
const runtimePath = "src/environment/authoredKphxPhotoGround.js";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const runtime = fs.readFileSync(runtimePath, "utf8");

if (manifest.schemaVersion !== 2) throw new Error(`PHX aerial manifest schema is ${manifest.schemaVersion}, expected 2`);
if (manifest.runtimeTiling?.mode !== "tiled-native-source-resolution-v2") {
  throw new Error(`PHX aerial runtime mode is ${manifest.runtimeTiling?.mode}`);
}
if (manifest.image?.width !== 6400 || manifest.image?.height !== 2304) {
  throw new Error(`PHX source aerial dimensions drifted to ${manifest.image?.width}x${manifest.image?.height}`);
}
if (manifest.runtimeTiling.tileSizePixels !== 1024 || manifest.runtimeTiling.maxTextureDimension > 1024) {
  throw new Error("PHX runtime tiles exceed the WebGL-safe 1024-pixel texture contract");
}
if (!Array.isArray(manifest.tiles) || manifest.tiles.length !== 21 || manifest.runtimeTiling.tileCount !== 21) {
  throw new Error(`PHX runtime tile count is ${manifest.tiles?.length}/${manifest.runtimeTiling?.tileCount}, expected 21`);
}

let totalBytes = 0;
const coveredPixels = new Set();
for (const tile of manifest.tiles) {
  const tilePath = path.join("public/models/kphx-photo", tile.file);
  if (!fs.existsSync(tilePath)) throw new Error(`PHX runtime tile is missing: ${tile.file}`);
  const bytes = fs.statSync(tilePath).size;
  if (bytes !== tile.bytes) throw new Error(`PHX runtime tile size drifted: ${tile.file} ${bytes} != ${tile.bytes}`);
  if (tile.width > 1024 || tile.height > 1024 || tile.width <= 0 || tile.height <= 0) {
    throw new Error(`PHX runtime tile dimensions are invalid: ${tile.file} ${tile.width}x${tile.height}`);
  }
  totalBytes += bytes;
  for (let y = tile.y; y < tile.y + tile.height; y += 256) {
    for (let x = tile.x; x < tile.x + tile.width; x += 256) coveredPixels.add(`${x}:${y}`);
  }
}
if (totalBytes !== manifest.runtimeTiling.totalBytes) {
  throw new Error(`PHX tiled aerial bytes drifted: ${totalBytes} != ${manifest.runtimeTiling.totalBytes}`);
}
if (coveredPixels.size !== 25 * 9) {
  throw new Error(`PHX tiled aerial coverage is incomplete: ${coveredPixels.size} source cells != 225`);
}

for (const token of [
  'textureMode: "tiled-native-source-resolution-v2"',
  "buildTiledPhotoGround",
  "sceneBoundsForTile",
  "manifest.tiles.map",
  "maxRuntimeTextureDimension: 1024",
  "authoredPhotoRuntimeTileCount",
]) {
  if (!runtime.includes(token)) throw new Error(`PHX tiled runtime contract missing ${token}`);
}

console.log(`Verified PHX native-resolution tiled ground: ${manifest.tiles.length} WebGL-safe tiles, ${totalBytes} bytes, full 6400x2304 source coverage.`);
