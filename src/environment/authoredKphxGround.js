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
  detailLevel: "terminal4-authored-textured-v3-source-ramp-exact-a1",
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

function configureSurfaceTexture(THREE, texture, name) {
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 16;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadAuthoredSurfaceTextures(THREE) {
  const baseUrl = import.meta.env.BASE_URL;
  const loader = new THREE.TextureLoader();
  const [concrete, serviceRoad, asphalt] = await Promise.all([
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.concrete}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.serviceRoad}`),
    loader.loadAsync(`${baseUrl}${AUTHORED_KPHX_GROUND_PROFILE.surfaceTextures.asphalt}`),
  ]);
  return {
    concrete: configureSurfaceTexture(THREE, concrete, "PHX supplied concrete ramp texture"),
    serviceRoad: configureSurfaceTexture(THREE, serviceRoad, "PHX supplied service-road texture"),
    asphalt: configureSurfaceTexture(THREE, asphalt, "PHX supplied asphalt texture"),
  };
}

function applyAuthoredSurfaceMaterials(THREE, authored, textures) {
  let texturedSurfaceMaterialCount = 0;
  authored.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      if (material.name === "airport-base") {
        material.visible = false;
      } else if (material.name === "concrete") {
        material.visible = true;
        material.map = textures.concrete;
        material.bumpMap = textures.concrete;
        material.bumpScale = 0.012;
        material.color.setHex(0xffffff);
        material.roughness = 0.95;
        material.metalness = 0;
        texturedSurfaceMaterialCount += 1;
      } else if (material.name === "asphalt") {
        material.visible = true;
        material.map = textures.asphalt;
        material.bumpMap = textures.asphalt;
        material.bumpScale = 0.009;
        material.color.setHex(0xffffff);
        material.roughness = 0.98;
        material.metalness = 0;
        texturedSurfaceMaterialCount += 1;
      } else if (material.name === "service-road") {
        material.visible = true;
        material.map = textures.serviceRoad;
        material.bumpMap = textures.serviceRoad;
        material.bumpScale = 0.008;
        material.color.setHex(0xffffff);
        material.roughness = 0.96;
        material.metalness = 0;
        texturedSurfaceMaterialCount += 1;
      }
      material.needsUpdate = true;
    }
  });
  return texturedSurfaceMaterialCount;
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
  const texturedSurfaceMaterialCount = applyAuthoredSurfaceMaterials(THREE, authored, surfaceTextures);

  environment.add(authored);
  hideCalibrationGround(environment);
  const metadata = buildGateMetadata();

  environment.userData.groundSource = "authored-kphx-v181-source-textured";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.authoredGroundSurfaceTextures = surfaceTextures;
  environment.userData.authoredGroundTexturedSurfaceMaterialCount = texturedSurfaceMaterialCount;
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
