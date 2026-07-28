import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildKphxV181Terminal4, KPHX_V181_PROFILE } from "./kphxV181Terminal4.js";

export const AUTHORED_KPHX_GROUND_PROFILE = Object.freeze({
  source: "TheMainlineCowboy/SkyHarborPhx@7ee8f9b4712f842706f00aa5a307e8861b601620/scenery/KPHX_ADEX.BGL",
  updatedSource: "unmlobo-kphx 1.8.1 / scenery/world/scenery/kphx-airport.bgl",
  anchorGate: "A1",
  anchorParkingIndex: 32,
  anchorHeadingDegrees: 269.975341796875,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east",
  sceneOffset: Object.freeze([0, 0, 6.2]),
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

export async function installAuthoredKphxGround(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required");
  environment.userData.groundSource = "loading-authored-kphx-v181";
  environment.userData.groundCoordinateFrame = AUTHORED_KPHX_GROUND_PROFILE.coordinateFrame;

  const url = `${import.meta.env.BASE_URL}models/kphx-ground/kphx-ground.gltf`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const authored = gltf.scene;
  authored.name = "PHX_KPHX_AuthoredAirportWideGround";
  authored.position.fromArray(AUTHORED_KPHX_GROUND_PROFILE.sceneOffset);
  authored.rotation.y = THREE.MathUtils.degToRad(-AUTHORED_KPHX_GROUND_PROFILE.anchorHeadingDegrees);
  authored.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });

  const terminal4Detail = buildKphxV181Terminal4(THREE);
  environment.add(authored, terminal4Detail);
  hideCalibrationGround(environment);

  environment.userData.groundSource = "authored-kphx-v181";
  environment.userData.authoredGroundUrl = url;
  environment.userData.authoredGround = authored;
  environment.userData.kphxV181Detail = terminal4Detail;
  environment.userData.kphxVersion = KPHX_V181_PROFILE.packageVersion;
  environment.userData.sourceJetwayCount = KPHX_V181_PROFILE.sourceJetwayCount;
  environment.userData.terminal4JetwayCount = terminal4Detail.userData.terminal4JetwayCount;
  environment.userData.terminal4ParkingCount = terminal4Detail.userData.terminal4ParkingCount;
  environment.userData.b15Anchors = terminal4Detail.userData.b15Anchors;
  environment.userData.authoredGroundCounts = {
    taxiwayPoints: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPoints,
    taxiwayPaths: AUTHORED_KPHX_GROUND_PROFILE.taxiwayPaths,
    parkingStands: AUTHORED_KPHX_GROUND_PROFILE.parkingStands,
    apronTriangles: AUTHORED_KPHX_GROUND_PROFILE.apronTriangles,
    pathSurfaces: AUTHORED_KPHX_GROUND_PROFILE.pathSurfaces,
    markingSegments: AUTHORED_KPHX_GROUND_PROFILE.markingSegments,
  };
  return terminal4Detail;
}
