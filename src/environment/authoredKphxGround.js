import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

const TERMINAL4_PARKINGS = Object.freeze([...concourseA.parkings, ...concourseB.parkings]);
const TERMINAL4_JETWAYS = Object.freeze([...concourseA.jetways, ...concourseB.jetways]);
const B15_GATE_NAMES = new Set(["B15L", "B15M"]);
const MARKING_MATERIALS = new Set(["yellow-marking", "white-marking"]);

export const AUTHORED_KPHX_GROUND_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@7ee8f9b4712f842706f00aa5a307e8861b601620/scenery/KPHX_ADEX.BGL",
  updatedSource: "unmlobo-kphx 1.8.1 / scenery/world/scenery/kphx-airport.bgl",
  surfaceTextures: Object.freeze({
    concrete: "models/phx-terminal4/textures/PARKRAMPS.png",
    serviceRoad: "models/phx-terminal4/textures/PARKRAMP1.png",
    asphalt: "models/phx-terminal4/textures/RW.png",
  }),
  anchorGate: "A1",
  anchorParkingIndex: 32,
  anchorHeadingDegrees: 269.975341796875,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east; authored A1 heading faces scene -Z",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  packageVersion: "1.8.1",
  detailLevel: "terminal4-authored-textured-v4-source-ramp-exact-a1-nearfield",
  surfaceMaterialMode: "source-aerial-diffuse-with-source-atlas-nearfield-concrete",
  sourceJetwayCount: 112,
  terminal4JetwayCount: TERMINAL4_JETWAYS.length,
  terminal4ParkingCount: TERMINAL4_PARKINGS.length,
  taxiwayPoints: 870,
  taxiwayPaths: 1302,
  parkingStands: 240,
  apronTriangles: 1860,
  pathSurfaces: 958,
  markingSegments: 1208,
});

const CALIBRATION_NAMES = new Set([
  "Terminal4RampSurface", "RampExpansionJointX", "RampExpansionJointZ",
  "CalibrationCenterline", "TrainingStopBar", "ServiceRoadSurface",
  "ServiceRoadDash", "UnassignedGateLeadIn", "RampLightPole", "RampLight",
]);

function hideCalibrationGround(environment) {
  environment.traverse((node) => {
    if (CALIBRATION_NAMES.has(node.name)) node.visible = false;
  });
}

function configureSourceTexture(THREE, texture, name) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function configureNearfieldTexture(THREE, texture, name, colorSpace) {
  texture.name = name;
  texture.colorSpace = colorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  // The ADEX glTF uses one UV repeat per 64 meters. Two repeats makes this
  // source strip a 32-meter tile: roughly 4-meter rows and 5-meter slab bays,
  // matching apron concrete instead of the sidewalk-scale first pass.
  texture.repeat.set(2, 2);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildSourceConcreteNearfieldTextures(THREE, sourceTexture) {
  const image = sourceTexture.image;
  if (!image?.width || !image?.height) throw new Error("PHX supplied concrete source texture did not decode");

  const sourceWidth = Math.min(192, image.width);
  const sourceHeight = Math.min(34, image.height);
  const albedoCanvas = document.createElement("canvas");
  albedoCanvas.width = 256;
  albedoCanvas.height = 256;
  const context = albedoCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("PHX source-detail canvas is unavailable");
  context.imageSmoothingEnabled = true;

  // PARKRAMPS is an atlas. Its upper-left strip is the package's clean authored
  // concrete: real slab edges and fine variation, without the jetway rotundas or
  // black atlas separators. Repeat only that exact strip across the detail tile.
  const rowHeight = 32;
  for (let y = 0; y < albedoCanvas.height; y += rowHeight) {
    context.drawImage(image, 0, 1, sourceWidth, sourceHeight, 0, y, albedoCanvas.width, rowHeight);
  }

  const pixels = context.getImageData(0, 0, albedoCanvas.width, albedoCanvas.height);
  let luminanceTotal = 0;
  const pixelCount = pixels.data.length / 4;
  for (let index = 0; index < pixels.data.length; index += 4) {
    luminanceTotal += pixels.data[index] * 0.2126 + pixels.data[index + 1] * 0.7152 + pixels.data[index + 2] * 0.0722;
  }
  const meanLuminance = luminanceTotal / pixelCount;
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    // Preserve the authored slab pattern while normalizing the atlas crop into a
    // subtle neutral ramp layer that can blend over the georeferenced aerial.
    const detailed = Math.max(62, Math.min(210, 158 + (luminance - meanLuminance) * 1.9));
    pixels.data[index] = Math.min(255, detailed + 5);
    pixels.data[index + 1] = Math.min(255, detailed + 3);
    pixels.data[index + 2] = Math.max(0, detailed - 3);
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = albedoCanvas.width;
  bumpCanvas.height = albedoCanvas.height;
  const bumpContext = bumpCanvas.getContext("2d", { willReadFrequently: true });
  if (!bumpContext) throw new Error("PHX source-bump canvas is unavailable");
  bumpContext.drawImage(albedoCanvas, 0, 0);
  const bumpPixels = bumpContext.getImageData(0, 0, bumpCanvas.width, bumpCanvas.height);
  for (let index = 0; index < bumpPixels.data.length; index += 4) {
    const luminance = bumpPixels.data[index] * 0.2126 + bumpPixels.data[index + 1] * 0.7152 + bumpPixels.data[index + 2] * 0.0722;
    const detailed = Math.max(0, Math.min(255, 128 + (luminance - 158) * 2.35));
    bumpPixels.data[index] = detailed;
    bumpPixels.data[index + 1] = detailed;
    bumpPixels.data[index + 2] = detailed;
    bumpPixels.data[index + 3] = 255;
  }
  bumpContext.putImageData(bumpPixels, 0, 0);

  return {
    albedo: configureNearfieldTexture(
      THREE,
      new THREE.CanvasTexture(albedoCanvas),
      "PHX supplied PARKRAMPS near-field concrete albedo",
      THREE.SRGBColorSpace,
    ),
    bump: configureNearfieldTexture(
      THREE,
      new THREE.CanvasTexture(bumpCanvas),
      "PHX supplied PARKRAMPS near-field concrete bump",
      THREE.NoColorSpace,
    ),
  };
}

async function loadAuthoredSurfaceTextures(THREE) {
  const baseUrl = import.meta.env.BASE_URL;
  const loader = new THREE.TextureLoader();
  const [concrete, serviceRoad, asphalt] = await Promise.all([
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.concrete}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.serviceRoad}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.asphalt}`),
  ]);
  const concreteSource = configureSourceTexture(THREE, concrete, "PHX supplied PARKRAMPS atlas source");
  return {
    concreteSource,
    serviceRoadSource: configureSourceTexture(THREE, serviceRoad, "PHX supplied PARKRAMP1 atlas source"),
    asphaltSource: configureSourceTexture(THREE, asphalt, "PHX supplied RW atlas source"),
    concrete: buildSourceConcreteNearfieldTextures(THREE, concreteSource),
  };
}

function configureAuthoredMarkingMaterial(material, node) {
  const yellow = material.name === "yellow-marking";
  material.visible = true;
  material.map = null;
  material.bumpMap = null;
  material.color.setHex(yellow ? 0xffcf00 : 0xf8f6ed);
  material.transparent = true;
  material.opacity = 1;
  material.depthWrite = false;
  material.depthTest = true;
  material.roughness = 0.72;
  material.metalness = 0;
  material.toneMapped = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -12;
  material.polygonOffsetUnits = -12;
  if (material.emissive?.setHex) {
    material.emissive.setHex(yellow ? 0x392d00 : 0x252522);
    material.emissiveIntensity = 0.22;
  }
  node.renderOrder = Math.max(node.renderOrder || 0, 420);
  material.userData = {
    ...(material.userData || {}),
    markingAuthority: "source-authored-kphx-adex",
    visibilityMode: "high-contrast-nearfield",
  };
}

function applyAuthoredSurfaceMaterials(THREE, authored, textures) {
  let sourceDetailedSurfaceMaterialCount = 0;
  let enhancedMarkingMaterialCount = 0;
  authored.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.side = THREE.DoubleSide;
      material.map = null;
      material.bumpMap = null;
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.userData = {
        ...(material.userData || {}),
        diffuseAuthority: "source-authored-phx-photo",
        sourceAtlasPolicy: "crop-clean-source-concrete-strip-never-repeat-entire-atlas",
      };

      if (material.name === "airport-base") {
        material.visible = false;
      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.transparent = true;
        material.opacity = 0.30;
        material.depthWrite = false;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.022;
        material.roughness = 0.94;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "asphalt") {
        material.visible = true;
        material.color.setHex(0x555a5e);
        material.transparent = true;
        material.opacity = 0.10;
        material.depthWrite = false;
        material.roughness = 0.98;
        material.metalness = 0;
        node.renderOrder = Math.max(node.renderOrder || 0, 20);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "service-road") {
        material.visible = true;
        material.color.setHex(0x777976);
        material.transparent = true;
        material.opacity = 0.13;
        material.depthWrite = false;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.010;
        material.roughness = 0.97;
        material.metalness = 0;
        node.renderOrder = Math.max(node.renderOrder || 0, 35);
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (MARKING_MATERIALS.has(material.name)) {
        configureAuthoredMarkingMaterial(material, node);
        enhancedMarkingMaterialCount += 1;
      }
      material.needsUpdate = true;
    }
  });
  return { sourceDetailedSurfaceMaterialCount, enhancedMarkingMaterialCount };
}

function buildGateMetadata() {
  const offsetZ = AUTHORED_KPHX_GROUND_PROFILE.sceneOffset[2];
  const b15Anchors = TERMINAL4_PARKINGS
    .filter((parking) => B15_GATE_NAMES.has(parking.g))
    .map((parking) => ({
      gate: parking.g,
      x: parking.x,
      z: parking.z + offsetZ,
      headingDegrees: parking.h,
      distanceMeters: Math.hypot(parking.x, parking.z),
    }));
  return {
    b15Anchors,
    trainingCorridor: {
      startGate: "A1",
      endGates: b15Anchors.map((anchor) => anchor.gate),
      distanceMeters: b15Anchors.map((anchor) => anchor.distanceMeters),
      coordinateFrame: AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame,
    },
  };
}

export async function installAuthoredKphxGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.groundSource = "loading-authored-kphx-v181";
  environment.userData.groundCoordinateFrame = AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame;

  const url = `${import.meta.env.BASE_URL}models/kphx-ground/kphx-ground.gltf`;
  const [gltf, surfaceTextures] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    loadAuthoredSurfaceTextures(THREE),
  ]);
  const authored = gltf.scene;
  authored.name = "PHX_KPHX_AuthoredAirportWideGround";
  authored.position.fromArray(AUTHORED_KPHX_GROUND_PROFILE.sceneOffset);
  // The ADEX extractor already emits A1-local X=north/Z=east coordinates and
  // explicitly registers the authored A1 heading to scene -Z. Rotating it a
  // second time was the cause of the wrong gate and wrong aircraft orientation.
  authored.rotation.y = 0;
  const materialState = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);

  environment.add(authored);
  hideCalibrationGround(environment);
  const metadata = buildGateMetadata();

  environment.userData.groundSource = "authored-kphx-v181-source-textured-nearfield";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.authoredGroundSurfaceTextures = surfaceTextures;
  environment.userData.authoredGroundTexturedSurfaceMaterialCount = materialState.sourceDetailedSurfaceMaterialCount;
  environment.userData.authoredGroundEnhancedMarkingMaterialCount = materialState.enhancedMarkingMaterialCount;
  environment.userData.authoredGroundSurfaceMaterialMode = AUTHORED_KPHX_GROUND_PROFILE.surfaceMaterialMode;
  environment.userData.kphxVersion = AUTHORED_KPHX_GROUND_PROFILE.packageVersion;
  environment.userData.kphxDetailLevel = AUTHORED_KPHX_GROUND_PROFILE.detailLevel;
  environment.userData.sourceJetwayCount = AUTHORED_KPHX_GROUND_PROFILE.sourceJetwayCount;
  environment.userData.terminal4JetwayCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4JetwayCount;
  environment.userData.terminal4ParkingCount = AUTHORED_KPHX_GROUND_PROFILE.terminal4ParkingCount;
  environment.userData.b15Anchors = metadata.b15Anchors;
  environment.userData.trainingCorridor = metadata.trainingCorridor;
  environment.userData.authoredGroundCounts = {
    taxiwayPoints: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPoints,
    taxiwayPaths: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPaths,
    parkingStands: AUTHORED_KPHX_GROUND_PROFILE.parkingStands,
    apronTriangles: AUTHORED_KPHX_GROUND_PROFILE.apronTriangles,
    pathSurfaces: AUTHORED_KPHX_GROUND_PROFILE.pathSurfaces,
    markingSegments: AUTHORED_KPHX_GROUND_PROFILE.markingSegments,
  };
  return authored;
}
