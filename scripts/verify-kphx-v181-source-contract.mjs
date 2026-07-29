import fs from "node:fs";

const files = {
  a: fs.readFileSync("src/environment/kphxV181/concourseA.js", "utf8"),
  b: fs.readFileSync("src/environment/kphxV181/concourseB.js", "utf8"),
  terminal: fs.readFileSync("src/environment/authoredTerminal4Visual.js", "utf8"),
  jetways: fs.readFileSync("src/environment/sourcePlacedTerminal4Jetways.js", "utf8"),
  ground: fs.readFileSync("src/environment/authoredKphxGround.js", "utf8"),
  photo: fs.readFileSync("src/environment/authoredKphxPhotoGround.js", "utf8"),
  photoExtractor: fs.readFileSync("scripts/extract-phx-photo.cpp", "utf8"),
  photoBuilder: fs.readFileSync("scripts/build-phx-photo-mosaic.py", "utf8"),
  materialize: fs.readFileSync("scripts/materialize-phx-terminal4.mjs", "utf8"),
  materializeLightmaps: fs.readFileSync("scripts/materialize-phx-terminal4-lightmaps.mjs", "utf8"),
  prepare: fs.readFileSync("scripts/prepare-terminal4-runtime.mjs", "utf8"),
};
const photoManifest = JSON.parse(fs.readFileSync("public/models/kphx-photo/photo-manifest.json", "utf8"));
const photoImage = fs.statSync("public/models/kphx-photo/phx-airport-photo.webp");

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
  "parkingIndex: 32",
  "latitude: 33.43653056770563",
  "longitude: -111.99864059686661",
  'position: Object.freeze([-101.59257372668444, 0.035, 70.90086550233441])',
  "rotationYDegrees: 90",
  'scale: Object.freeze([-1, 1, 1])',
  "texture-manifest.json",
  "pinned-authored-source-textures-and-exact-lightmaps-v3",
  "terminal4-authored-textured-lightmapped-v4-source-jetways-exact-a1",
  "nearestHorizontalVertexDistance",
  'environmentSource = "authored-phx-terminal4-textured-source-jetways"',
  "buildSourcePlacedTerminal4Jetways",
  "sourceWrapMode",
  "THREE.RepeatWrapping",
  "texture.anisotropy = 16",
  "manifest.emissiveTextureCount !== 11",
  "material.emissiveMap = emissiveMap",
  "authoredTerminal4LightmappedMaterialCount",
]) {
  if (!files.terminal.includes(token)) throw new Error(`Authored Terminal 4 contract missing ${token}`);
}
if (files.terminal.includes("CanvasTexture")) throw new Error("Authored Terminal 4 runtime must not replace source materials with generated canvas textures");

for (const token of [
  'sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip"',
  'placementSource: "scenery/world/scenery/kphx-airport.bgl"',
  "terminal4JetwayCount: 58",
  "concourseA.jetways",
  "concourseB.jetways",
  "KPHX_SourcePlaced_JetwayRotundas",
  "KPHX_SourcePlaced_JetwayOuterTunnels",
  "KPHX_SourcePlaced_JetwayInnerTunnels",
  "KPHX_SourcePlaced_JetwayCabins",
  "KPHX_SourcePlaced_JetwayBellowsHorizontal",
  "KPHX_SourcePlaced_JetwayWheels",
  "KPHX_SourcePlaced_JetwayServiceSteps",
  "group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)",
  "highDetailRadiusMeters: 180",
]) {
  if (!files.jetways.includes(token)) throw new Error(`Terminal 4 jetway visual contract missing ${token}`);
}
if (files.jetways.includes("CanvasTexture")) throw new Error("Terminal 4 jetways must reuse supplied source textures instead of generated canvas textures");

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
  "EXACT_LIGHTMAP_SOURCES",
  '"BGATE1.BMP": "bgate1_lm.bmp"',
  '"DGATE5.BMP": "dgate5_lm.bmp"',
  '"T4_WALK2.BMP": "t4_walk2_lm.bmp"',
  'emissiveFidelity: "exact"',
  'manifest.emissiveTextureCount = emitted',
  'pinned-exact-source-lightmaps-active-no-invented-missing-maps',
  "missing package dependencies remain unfilled",
]) {
  if (!files.materializeLightmaps.includes(token)) throw new Error(`Terminal 4 exact-lightmap materializer contract missing ${token}`);
}

for (const token of [
  'groundSource = "authored-kphx-v181-source-textured-nearfield"',
  "authored.rotation.y = 0",
  "sourceJetwayCount",
  "b15Anchors",
  "trainingCorridor",
  "kphxDetailLevel",
  'detailLevel: "terminal4-authored-textured-v4-source-ramp-exact-a1-nearfield"',
  'surfaceMaterialMode: "source-aerial-diffuse-with-source-atlas-nearfield-concrete"',
  'concrete: "models/phx-terminal4/textures/PARKRAMPS.png"',
  'serviceRoad: "models/phx-terminal4/textures/PARKRAMP1.png"',
  'asphalt: "models/phx-terminal4/textures/RW.png"',
  "buildSourceConcreteNearfieldTextures",
  "crop-clean-source-concrete-strip-never-repeat-entire-atlas",
  "material.map = textures.concrete.albedo",
  "material.bumpMap = textures.concrete.bump",
  "material.bumpScale = 0.022",
  "configureAuthoredMarkingMaterial",
  'markingAuthority: "source-authored-kphx-adex"',
  'visibilityMode: "high-contrast-nearfield"',
  "authoredGroundEnhancedMarkingMaterialCount",
  "texture.anisotropy = 16",
]) {
  if (!files.ground.includes(token)) throw new Error(`KPHX runtime contract missing ${token}`);
}
if (files.ground.includes("buildKphxV181Terminal4")) throw new Error("Procedural box-built Terminal 4 must not be installed over the authored airport");
if (files.ground.includes("trainingAircraftHeadingDegrees -")) throw new Error("A1-local ground must not be rotated a second time");
if (files.ground.includes("material.opacity = 0.055")) throw new Error("PHX concrete must not regress to the nearly invisible bump-only layer");

for (const token of [
  "phx-airport-photo.webp",
  "photo-manifest.json",
  "full-airport-source-aerial-1.2m-v1",
  'photoGroundSource = "source-authored-phx-photo"',
  'const OPAQUE_ADEX_SURFACES = new Set(["airport-base"])',
  "hideFlatADEXSurfaceColors",
  "source aerial is the diffuse authority",
  "hidden-nonphotographic-bgl-classification-tint",
  "exactA1HiddenProjectedMaterialCount",
  "texture.anisotropy = 16",
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
  '"legacySurfaceState": "source-authored 1.2-meter-class aerial airport imagery covering the full PHX field"',
  '"surfaceState": "source-authored 1.2-meter-class aerial preserved as native-resolution WebGL tiles across the full PHX field"',
  '"mode": "tiled-native-source-resolution-v2"',
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
console.log(`Verified source-authored KPHX contract: ${parkingCount} Terminal 4 stands, ${jetwayCount} source placements, exact original ADEX A1 placement, real MDLX terminal geometry, exact source lightmaps, detailed source-placed jetway visuals, native-resolution tiled full-airport aerial ground, source-authored near-field concrete, enhanced ADEX stand markings, hidden nonphotographic projected-surface tints, and unrotated A1-local ground.`);
