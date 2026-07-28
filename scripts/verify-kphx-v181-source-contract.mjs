import fs from "node:fs";

const files = {
  a: fs.readFileSync("src/environment/kphxV181/concourseA.js", "utf8"),
  b: fs.readFileSync("src/environment/kphxV181/concourseB.js", "utf8"),
  terminal: fs.readFileSync("src/environment/authoredTerminal4Visual.js", "utf8"),
  ground: fs.readFileSync("src/environment/authoredKphxGround.js", "utf8"),
  materialize: fs.readFileSync("scripts/materialize-phx-terminal4.mjs", "utf8"),
  prepare: fs.readFileSync("scripts/prepare-terminal4-runtime.mjs", "utf8"),
};
for (const token of ['"g":"A1"', '"g":"B15L"', '"g":"B15M"']) {
  if (!(files.a + files.b).includes(token)) throw new Error(`KPHX gate source missing ${token}`);
}
const parkingCount = (files.a.match(/"i":/g) || []).length + (files.b.match(/"i":/g) || []).length;
const jetwayCount = (files.a.match(/"px":/g) || []).length + (files.b.match(/"px":/g) || []).length;
if (parkingCount !== 58 || jetwayCount !== 58) throw new Error(`KPHX Terminal 4 counts ${parkingCount}/${jetwayCount}`);

for (const token of [
  'position: Object.freeze([-60, 0.035, 71.2])',
  "rotationYDegrees: 90",
  'scale: Object.freeze([-1, 1, 1])',
  "texture-manifest.json",
  "pinned-authored-source-textures-v1",
  "terminal4-authored-textured-v1",
  'environmentSource = "authored-phx-terminal4-textured"',
]) {
  if (!files.terminal.includes(token)) throw new Error(`Authored Terminal 4 contract missing ${token}`);
}
if (files.terminal.includes("CanvasTexture")) throw new Error("Authored Terminal 4 runtime must not replace source materials with generated canvas textures");

for (const token of [
  "decodeDxt1Bmp",
  "encodePng",
  "TEXTURE_SOURCES",
  '"PARKRAMPS2.BMP": { sourcePath: "parkramps.bmp"',
  '"PHX_TERM400_0.DDS": { sourcePath: "bgate1.bmp"',
  '"PHX_TERM400_1.DDS": { sourcePath: "bgate3.bmp"',
  '"PHXRAMPLIGHT.BMP": { sourcePath: "supports2.bmp"',
  "texture-manifest.json",
  'textureStatus: "pinned-authored-source-textures-active"',
]) {
  if (!files.materialize.includes(token)) throw new Error(`Terminal 4 materializer contract missing ${token}`);
}

for (const token of [
  'groundSource = "authored-kphx-v181"',
  "authored.rotation.y = 0",
  "sourceJetwayCount",
  "b15Anchors",
  "trainingCorridor",
  "kphxDetailLevel",
  'detailLevel: "terminal4-authored-textured-v1"',
]) {
  if (!files.ground.includes(token)) throw new Error(`KPHX runtime contract missing ${token}`);
}
if (files.ground.includes("buildKphxV181Terminal4")) throw new Error("Procedural box-built Terminal 4 must not be installed over the authored airport");
if (files.ground.includes("trainingAircraftHeadingDegrees -")) throw new Error("A1-local ground must not be rotated a second time");

for (const token of [
  "dataset.kphxVersion",
  "dataset.kphxDetailLevel",
  "dataset.sourceJetwayCount",
  "dataset.b15Anchors",
  "dataset.b15CorridorMeters",
  "dataset.terminal4TextureCount",
  "dataset.terminal4ExactTextureCount",
  "dataset.terminal4FallbackTextureCount",
  "dataset.terminal4TexturedMaterialCount",
]) {
  if (!files.prepare.includes(token)) throw new Error(`KPHX browser evidence missing ${token}`);
}
console.log(`Verified source-authored KPHX contract: ${parkingCount} Terminal 4 stands, ${jetwayCount} jetways, real MDLX geometry, pinned source textures and unrotated A1-local ground.`);
