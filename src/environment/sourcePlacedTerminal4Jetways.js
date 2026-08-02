import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";
import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleetReadyV2.js";

export const SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE = Object.freeze({
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  placementSource: "scenery/world/scenery/kphx-airport.bgl",
  sourceLibraryModel: "user-supplied Airport Jetway.zip",
  terminal4JetwayCount: 58,
  coordinateFrame: "A1-local; X=north, Y=up, Z=east; BGL heading clockwise from source north",
  sceneOffset: Object.freeze([0, 0, 6.2]),
  headingConversion: "three-yaw-radians = PI - source-heading-radians",
  detailLevel: "user-supplied-jetway-source-geometry-at-source-bgl-transforms-v3",
});

function sourceHeadingToThreeYaw(THREE, headingDegrees) {
  return Math.PI - THREE.MathUtils.degToRad(Number(headingDegrees));
}

function placementFacesAssignedParking(placement) {
  const toParkingX = placement.parkingX - placement.x;
  const toParkingZ = placement.parkingZ - placement.z;
  const forwardX = Math.sin(placement.yaw);
  const forwardZ = Math.cos(placement.yaw);
  return toParkingX * forwardX + toParkingZ * forwardZ > 0;
}

/**
 * Install only the supplied jetway geometry at the jetway transforms decoded
 * from the supplied KPHX airport package. This module deliberately does not
 * generate collars, walkways, facade panels, stairs, wheels, doors, vents or
 * any substitute jetway geometry.
 */
export function buildSourcePlacedTerminal4Jetways(THREE, terminal, sourceTextures = {}) {
  void terminal;
  const jetways = [...concourseA.jetways, ...concourseB.jetways];
  if (jetways.length !== SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.terminal4JetwayCount) {
    throw new Error(`Expected 58 supplied Terminal 4 jetway placements, received ${jetways.length}`);
  }

  const group = new THREE.Group();
  group.name = "PHX_Terminal4_UserSuppliedJetways_SourcePlaced";
  group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset);

  const placements = jetways.map((jetway) => ({
    gate: jetway.g,
    x: Number(jetway.x),
    z: Number(jetway.z),
    parkingX: Number(jetway.px),
    parkingZ: Number(jetway.pz),
    sourceHeadingDegrees: Number(jetway.h),
    yaw: sourceHeadingToThreeYaw(THREE, jetway.h),
  }));
  const parkingFacingCount = placements.filter(placementFacesAssignedParking).length;
  if (parkingFacingCount !== placements.length) {
    const reversed = placements.filter((placement) => !placementFacesAssignedParking(placement)).map((placement) => placement.gate);
    throw new Error(`Supplied BGL jetway heading conversion points away from assigned parking at: ${reversed.join(", ")}`);
  }

  const controller = installUploadedAirportJetwayFleet(THREE, group, placements, sourceTextures);

  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;
  group.userData.placementSource = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.placementSource;
  group.userData.sourceLibraryModel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceLibraryModel;
  group.userData.headingConversion = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.headingConversion;
  group.userData.parkingFacingJetwayCount = parkingFacingCount;
  group.userData.jetwayCount = placements.length;
  group.userData.terminalConnectedJetwayCount = placements.length;
  group.userData.a1TerminalWallDistance = null;
  group.userData.sourceScaleAuthority = "supplied-model-native-scale-no-runtime-rescaling";
  group.userData.sourceGeometryMode = "user-supplied-jetway-geometry-only";
  group.userData.requiresOriginalSourceMesh = false;
  group.userData.a1JetwayController = controller;
  group.userData.a1JetwayAnimationAuthority = "supplied-node-telescope-axis-only";
  group.userData.initialJetwayState = "source-authored-deployed-state";
  group.userData.requiredPrePushSequence = "retract-supplied-telescoping-nodes";
  group.userData.facadeInfillCount = 0;
  group.userData.lowerFacadeFitCount = 0;
  group.userData.openServiceBayCount = 0;
  group.userData.terminalConnectionAuthority = "source-bgl-placement-no-generated-connector";
  group.userData.detailLevel = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.detailLevel;
  group.userData.coordinateFrame = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.coordinateFrame;
  group.userData.visualAuthority = "user-supplied-airport-jetway-geometry-and-source-bgl-transforms";
  group.userData.usesTerminalBuildingTextures = false;
  group.userData.usesExactRecoveredJetwayTexture = false;
  group.userData.usesExactRecoveredJetwayLightmap = false;
  group.userData.jetwayTextureAuthority = "supplied-material-slots-no-projected-terminal-atlas";
  group.userData.jetwayTextureMappingAuthority = "no-generated-uv-projection";
  group.userData.proceduralBuildingBoxReuse = false;
  group.userData.proceduralJetwayObjectCount = 0;
  group.userData.generatedTerminalConnectorCount = 0;
  group.userData.sourcePlacements = placements;
  group.userData.uploadedJetwayReady = controller.ready;

  return group;
}
