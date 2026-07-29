import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

const TERMINAL4_PARKINGS = Object.freeze([...concourseA.parkings, ...concourseB.parkings]);
const TERMINAL4_JETWAYS = Object.freeze([...concourseA.jetways, ...concourseB.jetways]);
const B15_GATE_NAMES = new Set(["B15L", "B15M"]);

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
  detailLevel: "terminal4-authored-textured-v4-source-ramp-exact-a1",
  surfaceMaterialMode: "source-derived-high-frequency-pavement-over-source-aerial",
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

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function averageSourceColor(image, fallback) {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || !image?.width || !image?.height) return fallback;
  context.drawImage(image, 0, 0, image.width, image.height, 0, 0, 48, 48);
  const pixels = context.getImageData(0, 0, 48, 48).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
    if (luminance < 35 || luminance > 235) continue;
    red += pixels[index];
    green += pixels[index + 1];
    blue += pixels[index + 2];
    count += 1;
  }
  if (!count) return fallback;
  return [Math.round(red / count), Math.round(green / count), Math.round(blue / count)];
}

function buildSourceDerivedSurface(THREE, sourceTexture, profile) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error(`PHX ${profile.name} pavement canvas is unavailable`);
  const random = seededNoise(profile.seed);
  const sourceAverage = averageSourceColor(sourceTexture.image, profile.fallback);
  const base = sourceAverage.map((channel, index) => Math.round(channel * profile.sourceWeight + profile.fallback[index] * (1 - profile.sourceWeight)));
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const broad = Math.sin(x * 0.021) * 2.2 + Math.cos(y * 0.017) * 1.8;
      const grain = (random() - 0.5) * profile.grain;
      const speck = random() > 0.994 ? (random() - 0.5) * 42 : 0;
      image.data[index] = Math.max(0, Math.min(255, base[0] + broad + grain + speck));
      image.data[index + 1] = Math.max(0, Math.min(255, base[1] + broad + grain + speck));
      image.data[index + 2] = Math.max(0, Math.min(255, base[2] + broad + grain + speck));
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  context.save();
  context.globalAlpha = 0.34;
  context.strokeStyle = profile.jointColor;
  context.lineWidth = 2;
  if (profile.joints) {
    const spacing = 128;
    for (let coordinate = 0; coordinate <= size; coordinate += spacing) {
      context.beginPath();
      context.moveTo(coordinate + 0.5, 0);
      context.lineTo(coordinate + 0.5, size);
      context.stroke();
      context.beginPath();
      context.moveTo(0, coordinate + 0.5);
      context.lineTo(size, coordinate + 0.5);
      context.stroke();
    }
  }
  context.globalAlpha = profile.stainAlpha;
  for (let stain = 0; stain < profile.stainCount; stain += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 5 + random() * 22;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(34,31,28,0.7)");
    gradient.addColorStop(1, "rgba(34,31,28,0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  if (profile.cracks) {
    context.globalAlpha = 0.22;
    context.strokeStyle = "#35383a";
    context.lineWidth = 1;
    for (let crack = 0; crack < 16; crack += 1) {
      let x = random() * size;
      let y = random() * size;
      context.beginPath();
      context.moveTo(x, y);
      for (let segment = 0; segment < 5; segment += 1) {
        x += (random() - 0.5) * 24;
        y += 8 + random() * 18;
        context.lineTo(x, y);
      }
      context.stroke();
    }
  }
  context.restore();

  const diffuse = new THREE.CanvasTexture(canvas);
  diffuse.name = `PHX source-derived ${profile.name} diffuse`;
  diffuse.colorSpace = THREE.SRGBColorSpace;
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(profile.repeat, profile.repeat);
  diffuse.minFilter = THREE.LinearMipmapLinearFilter;
  diffuse.magFilter = THREE.LinearFilter;
  diffuse.anisotropy = 16;
  diffuse.generateMipmaps = true;
  diffuse.needsUpdate = true;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpContext = bumpCanvas.getContext("2d", { willReadFrequently: true });
  if (!bumpContext) throw new Error(`PHX ${profile.name} bump canvas is unavailable`);
  bumpContext.drawImage(canvas, 0, 0);
  const bumpPixels = bumpContext.getImageData(0, 0, size, size);
  for (let index = 0; index < bumpPixels.data.length; index += 4) {
    const luminance = Math.round(bumpPixels.data[index] * 0.2126 + bumpPixels.data[index + 1] * 0.7152 + bumpPixels.data[index + 2] * 0.0722);
    bumpPixels.data[index] = luminance;
    bumpPixels.data[index + 1] = luminance;
    bumpPixels.data[index + 2] = luminance;
  }
  bumpContext.putImageData(bumpPixels, 0, 0);
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.name = `PHX source-derived ${profile.name} bump`;
  bump.colorSpace = THREE.NoColorSpace;
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.copy(diffuse.repeat);
  bump.minFilter = THREE.LinearMipmapLinearFilter;
  bump.magFilter = THREE.LinearFilter;
  bump.anisotropy = 16;
  bump.generateMipmaps = true;
  bump.needsUpdate = true;
  return { diffuse, bump };
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
  const serviceRoadSource = configureSourceTexture(THREE, serviceRoad, "PHX supplied PARKRAMP1 atlas source");
  const asphaltSource = configureSourceTexture(THREE, asphalt, "PHX supplied RW atlas source");
  return {
    concreteSource,
    serviceRoadSource,
    asphaltSource,
    concrete: buildSourceDerivedSurface(THREE, concreteSource, {
      name: "concrete apron", seed: 0x50485831, fallback: [150, 151, 148], sourceWeight: 0.32,
      grain: 18, repeat: 4, joints: true, jointColor: "#686b6a", stainAlpha: 0.24, stainCount: 18, cracks: true,
    }),
    serviceRoad: buildSourceDerivedSurface(THREE, serviceRoadSource, {
      name: "service road", seed: 0x50485832, fallback: [91, 93, 92], sourceWeight: 0.28,
      grain: 22, repeat: 3, joints: false, jointColor: "#545657", stainAlpha: 0.2, stainCount: 14, cracks: true,
    }),
    asphalt: buildSourceDerivedSurface(THREE, asphaltSource, {
      name: "asphalt", seed: 0x50485833, fallback: [67, 70, 72], sourceWeight: 0.22,
      grain: 28, repeat: 3, joints: false, jointColor: "#444648", stainAlpha: 0.17, stainCount: 12, cracks: true,
    }),
  };
}

function applyAuthoredSurfaceMaterials(THREE, authored, textures) {
  let sourceDetailedSurfaceMaterialCount = 0;
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
        diffuseAuthority: "source-derived-from-uploaded-surface-atlas",
        sourceAtlasPolicy: "derive seamless high-frequency material; never repeat complete airport atlas",
      };

      if (material.name === "airport-base") {
        material.visible = false;
      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.map = textures.concrete.diffuse;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.018;
        material.roughness = 0.94;
        material.metalness = 0;
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "asphalt") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.map = textures.asphalt.diffuse;
        material.bumpMap = textures.asphalt.bump;
        material.bumpScale = 0.025;
        material.roughness = 0.98;
        material.metalness = 0;
        sourceDetailedSurfaceMaterialCount += 1;
      } else if (material.name === "service-road") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.map = textures.serviceRoad.diffuse;
        material.bumpMap = textures.serviceRoad.bump;
        material.bumpScale = 0.02;
        material.roughness = 0.97;
        material.metalness = 0;
        sourceDetailedSurfaceMaterialCount += 1;
      }
      material.needsUpdate = true;
    }
  });
  return sourceDetailedSurfaceMaterialCount;
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
  authored.rotation.y = 0;
  const sourceDetailedSurfaceMaterialCount = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);

  environment.add(authored);
  hideCalibrationGround(environment);
  const metadata = buildGateMetadata();

  environment.userData.groundSource = "authored-kphx-v181-source-textured";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.authoredGroundSurfaceTextures = surfaceTextures;
  environment.userData.authoredGroundTexturedSurfaceMaterialCount = sourceDetailedSurfaceMaterialCount;
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
