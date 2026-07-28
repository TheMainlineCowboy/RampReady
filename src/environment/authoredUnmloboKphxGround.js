import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

const TERMINAL4_PARKINGS = Object.freeze([...concourseA.parkings, ...concourseB.parkings]);
const TERMINAL4_JETWAYS = Object.freeze([...concourseA.jetways, ...concourseB.jetways]);
const B15_GATE_NAMES = new Set(["B15L", "B15M"]);

export const EXACT_UNMLOBO_KPHX_PROFILE = Object.freeze({
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  sourceArchiveSha256: "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc",
  sourceBgl: "unmlobo-kphx/scenery/world/scenery/kphx-airport.bgl",
  sourceBglSha256: "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2",
  packageVersion: "1.8.1",
  anchorGate: "A1",
  anchorParkingIndex: 43,
  anchorLongitude: -111.99876129627228,
  anchorLatitude: 33.436546325683594,
  anchorHeadingDegrees: 270.4908752441406,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east; source geometry is not re-rotated",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  detailLevel: "unmlobo-v181-exact-ground-markings-modern-a1",
  sourceAprons: 927,
  sourcePaintedLines: 1184,
  sourceJetways: 112,
  sourceLibraryObjectPlacements: 364,
  sourceMaterials: 86,
  terminal4JetwayCount: TERMINAL4_JETWAYS.length,
  terminal4ParkingCount: TERMINAL4_PARKINGS.length,
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

function buildGateMetadata() {
  const offsetZ = EXACT_UNMLOBO_KPHX_PROFILE.sceneOffset[2];
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
      coordinateFrame: EXACT_UNMLOBO_KPHX_PROFILE.coordinateFrame,
    },
  };
}

export async function installExactUnmloboKphxGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.groundSource = "loading-unmlobo-kphx-v181-exact";
  environment.userData.groundCoordinateFrame = EXACT_UNMLOBO_KPHX_PROFILE.coordinateFrame;

  const baseUrl = `${import.meta.env.BASE_URL}models/kphx-v181-exact/`;
  const url = `${baseUrl}kphx-v181-exact.gltf`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const authored = gltf.scene;
  authored.name = "PHX_KPHX_Unmlobo_v181_ExactGroundAndMarkings";
  authored.position.fromArray(EXACT_UNMLOBO_KPHX_PROFILE.sceneOffset);
  authored.rotation.y = 0;
  authored.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.depthWrite = true;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    }
  });

  environment.add(authored);
  hideCalibrationGround(environment);
  const metadata = buildGateMetadata();

  environment.userData.groundSource = "unmlobo-kphx-v181-exact";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.kphxVersion = EXACT_UNMLOBO_KPHX_PROFILE.packageVersion;
  environment.userData.kphxDetailLevel = EXACT_UNMLOBO_KPHX_PROFILE.detailLevel;
  environment.userData.sourceJetwayCount = EXACT_UNMLOBO_KPHX_PROFILE.sourceJetways;
  environment.userData.terminal4JetwayCount = EXACT_UNMLOBO_KPHX_PROFILE.terminal4JetwayCount;
  environment.userData.terminal4ParkingCount = EXACT_UNMLOBO_KPHX_PROFILE.terminal4ParkingCount;
  environment.userData.b15Anchors = metadata.b15Anchors;
  environment.userData.trainingCorridor = metadata.trainingCorridor;
  environment.userData.authoredGroundCounts = {
    sourceAprons: EXACT_UNMLOBO_KPHX_PROFILE.sourceAprons,
    sourcePaintedLines: EXACT_UNMLOBO_KPHX_PROFILE.sourcePaintedLines,
    sourceJetways: EXACT_UNMLOBO_KPHX_PROFILE.sourceJetways,
    sourceLibraryObjectPlacements: EXACT_UNMLOBO_KPHX_PROFILE.sourceLibraryObjectPlacements,
    sourceMaterials: EXACT_UNMLOBO_KPHX_PROFILE.sourceMaterials,
  };
  return authored;
}
