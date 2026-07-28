import fs from "node:fs";

const files = {
  a: fs.readFileSync("src/environment/kphxV181/concourseA.js", "utf8"),
  b: fs.readFileSync("src/environment/kphxV181/concourseB.js", "utf8"),
  terminal: fs.readFileSync("src/environment/authoredTerminal4Visual.js", "utf8"),
  ground: fs.readFileSync("src/environment/authoredKphxGround.js", "utf8"),
  exactGround: fs.readFileSync("src/environment/authoredUnmloboKphxGround.js", "utf8"),
  photo: fs.readFileSync("src/environment/authoredKphxPhotoGround.js", "utf8"),
  photoExtractor: fs.readFileSync("scripts/extract-phx-photo.cpp", "utf8"),
  photoBuilder: fs.readFileSync("scripts/build-phx-photo-mosaic.py", "utf8"),
  materialize: fs.readFileSync("scripts/materialize-phx-terminal4.mjs", "utf8"),
  prepare: fs.readFileSync("scripts/prepare-terminal4-runtime.mjs", "utf8"),
  package: fs.readFileSync("package.json", "utf8"),
  browserTest: fs.readFileSync("tests/browser/kphx-ground-runtime.spec.js", "utf8"),
};
const photoManifest = JSON.parse(fs.readFileSync("public/models/kphx-photo/photo-manifest.json", "utf8"));
const photoImage = fs.statSync("public/models/kphx-photo/phx-airport-photo.webp");

for (const forbiddenPath of [
  "src/environment/kphxSimulatorDetail.js",
  "scripts/inject-kphx-simulator-detail.mjs",
]) {
  if (fs.existsSync(forbiddenPath)) throw new Error(`Generated KPHX replacement must not exist: ${forbiddenPath}`);
}
for (const forbiddenToken of [
  "inject-kphx-simulator-detail.mjs",
  "buildKphxSimulatorDetail",
  "simulator-detail-a1-v1",
  "a1FineDetailMeshes",
]) {
  if ((files.package + files.prepare).includes(forbiddenToken)) {
    throw new Error(`Procedural KPHX detail path remains active: ${forbiddenToken}`);
  }
}
if (!files.browserTest.includes("simulatorDetailSource: null") || !files.browserTest.includes("fineDetailMeshes: null")) {
  throw new Error("Browser verification must explicitly reject the generated KPHX detail overlay");
}

for (const token of ['"g":"A1"', '"g":"B15L"', '"g":"B15M"']) {
  if (!(files.a + files.b).includes(token)) throw new Error(`KPHX gate source missing ${token}`);
}
const parkingCount = (files.a.match(/"i":/g) || []).length + (files.b.match(/"i":/g) || []).length;
const jetwayCount = (files.a.match(/"px":/g) || []).length + (files.b.match(/"px":/g) || []).length;
if (parkingCount !== 58 || jetwayCount !== 58) throw new Error(`KPHX Terminal 4 counts ${parkingCount}/${jetwayCount}`);

for (const token of [
  'modelGuid: "{7f197eb0-33ea-419f-9658-a29c9046d87f}"',
  "recordOffset: 146014",
  "latitude: 33.435617946088314",
  "longitude: -111.99794411659241",
  "legacySourceA1",
  "parkingIndex: 32",
  "latitude: 33.43653056770563",
  "longitude: -111.99864059686661",
  "modernSourceA1",
  "parkingIndex: 43",
  "latitude: 33.436546325683594",
  "longitude: -111.99876129627228",
  "headingDegrees: 270.4908752441406",
  "north: -1.7541700827164473",
  "east: 11.212459754837063",
  'position: Object.freeze([-103.34674380940088, 0.035, 82.11332525717148])',
  "rotationYDegrees: 90",
  'scale: Object.freeze([-1, 1, 1])',
  "texture-manifest.json",
  "pinned-authored-source-textures-v1",
  "terminal4-authored-textured-v3-modern-a1",
  "nearestHorizontalVertexDistance",
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
  'detailLevel: "terminal4-authored-textured-v2-exact-a1"',
]) {
  if (!files.ground.includes(token)) throw new Error(`Current KPHX ground contract missing ${token}`);
}
if (files.ground.includes("buildKphxV181Terminal4")) throw new Error("Procedural box-built Terminal 4 must not be installed over the authored airport");
if (files.ground.includes("trainingAircraftHeadingDegrees -")) throw new Error("A1-local ground must not be rotated a second time");

for (const token of [
  'sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip"',
  'sourceArchiveSha256: "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc"',
  'sourceBglSha256: "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2"',
  'anchorParkingIndex: 43',
  'anchorLongitude: -111.99876129627228',
  'anchorLatitude: 33.436546325683594',
  'anchorHeadingDegrees: 270.4908752441406',
  'detailLevel: "unmlobo-v181-exact-ground-markings-modern-a1"',
  'sourceAprons: 927',
  'sourcePaintedLines: 1184',
  'sourceJetways: 112',
  'sourceLibraryObjectPlacements: 364',
  'sourceMaterials: 86',
  'models/kphx-v181-exact/',
  'authored.rotation.y = 0',
  'groundSource = "unmlobo-kphx-v181-exact"',
]) {
  if (!files.exactGround.includes(token)) throw new Error(`Exact unmlobo ground loader missing ${token}`);
}
if (files.exactGround.includes("BoxGeometry") || files.exactGround.includes("PlaneGeometry")) {
  throw new Error("Exact unmlobo ground loader must not generate substitute geometry");
}

for (const token of [
  "phx-airport-photo.webp",
  "photo-manifest.json",
  "full-airport-source-aerial-1.2m-v1",
  'photoGroundSource = "source-authored-phx-photo"',
  "OPAQUE_ADEX_SURFACES",
  "hideFlatADEXSurfaceColors",
  "6400",
  "2304",
  "199",
]) {
  if (!files.photo.includes(token)) throw new Error(`PHX source-aerial runtime contract missing ${token}`);
}
for (const token of ["DecompressPtc", "DecompressDelta", "DecompressBitPack", "bounds.level != 17", "decoded != 199"]) {
  if (!files.photoExtractor.includes(token)) throw new Error(`PHX source-aerial extractor contract missing ${token}`);
}
for (const token of [
  'EXPECTED["tile_count"]',
  '"width": 6_400',
  '"height": 2_304',
  'mosaic.save(image_path, "WEBP", quality=88',
  '"surfaceState": "source-authored 1.2-meter-class aerial airport imagery covering the full PHX field"',
]) {
  if (!files.photoBuilder.includes(token)) throw new Error(`PHX source-aerial builder contract missing ${token}`);
}
if (photoManifest.sourcePath !== "scenery/PHXPhoto.bgl") throw new Error("PHX aerial manifest source is wrong");
if (photoManifest.tileCount !== 199 || photoManifest.qmidLevel !== 17) throw new Error("PHX aerial tile contract drifted");
if (photoManifest.image?.width !== 6400 || photoManifest.image?.height !== 2304) throw new Error("PHX aerial dimensions drifted");
if (photoManifest.image?.bytes !== 2_698_886 || photoImage.size !== 2_698_886) throw new Error("PHX aerial browser asset size drifted");
if (photoManifest.sceneBounds?.north < 950 || photoManifest.sceneBounds?.south > -1790) throw new Error("PHX aerial north/south coverage drifted");
if (photoManifest.sceneBounds?.west > -3700 || photoManifest.sceneBounds?.east < 4800) throw new Error("PHX aerial east/west coverage drifted");

for (const token of [
  "dataset.kphxVersion",
  "dataset.kphxDetailLevel",
  "dataset.photoGroundSource",
  "dataset.photoDetailLevel",
  "dataset.photoTileCount",
  "dataset.photoWidth",
  "dataset.photoHeight",
  "dataset.photoBytes",
  "dataset.hiddenAdexSurfaceMaterials",
  "dataset.sourceJetwayCount",
  "dataset.b15Anchors",
  "dataset.b15CorridorMeters",
  "dataset.terminal4TextureCount",
  "dataset.terminal4ExactTextureCount",
  "dataset.terminal4FallbackTextureCount",
  "dataset.terminal4TexturedMaterialCount",
  "dataset.terminal4Position",
  "dataset.terminal4A1NearestGeometryMeters",
  "dataset.terminal4Placement",
]) {
  if (!files.prepare.includes(token)) throw new Error(`KPHX browser evidence missing ${token}`);
}
console.log(`Verified source-only KPHX contract: ${parkingCount} Terminal 4 stands, ${jetwayCount} source jetway placements, modern A1 registration, real MDLX geometry, exact unmlobo ground-loader identity, pinned source textures, 199-tile full-airport aerial and no generated airport overlay.`);
