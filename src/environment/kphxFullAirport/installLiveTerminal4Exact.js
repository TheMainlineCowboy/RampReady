import { installKphxPackageOwnedObjectLayer } from "./installPackageOwnedObjectLayer.js";
import { installKphxTerminal4StockJetways } from "./installTerminal4StockJetways.js";

const STRUCTURES_MANIFEST_URL = "/models/kphx-full-airport/batches/structures.manifest.json";
const T4_RESOURCES = Object.freeze([
  "Terminals/Terminal4.obj",
  "Terminals/Terminal4b.obj",
]);

export function buildKphxExactLiveEnvironment(THREE) {
  const group = new THREE.Group();
  group.name = "KPHX_EXACT_LIVE_ENVIRONMENT";
  group.userData = {
    environmentSource: "KPHX 1.75.1 exact live runtime",
    sourceVersion: "1.75.1",
    calibrationOnly: false,
    proceduralTerminalMassing: false,
    legacyFsxTerminal: false,
  };
  return group;
}

function nearestDistanceToA1(THREE, object) {
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return Number.NaN;
  const a1 = new THREE.Vector3(0, 0, 6.2);
  const nearest = bounds.clampPoint(a1, new THREE.Vector3());
  return nearest.distanceTo(a1);
}

export async function installKphxExactLiveTerminal4(THREE, environment) {
  if (!environment?.isObject3D) throw new Error("KPHX exact live environment is required");

  const [buildings, jetways] = await Promise.all([
    installKphxPackageOwnedObjectLayer(THREE, environment, {
      manifestUrl: STRUCTURES_MANIFEST_URL,
      includeResources: T4_RESOURCES,
      strict: true,
      assetConcurrency: 2,
    }),
    installKphxTerminal4StockJetways(THREE, environment, { strict: true }),
  ]);

  if (buildings.layer.userData.loadedPlacementCount !== 2) {
    throw new Error(`Exact live T4 buildings incomplete: ${buildings.layer.userData.loadedPlacementCount}/2`);
  }
  if (jetways.layer.userData.jetwayCount !== 76) {
    throw new Error(`Exact live T4 jetways incomplete: ${jetways.layer.userData.jetwayCount}/76`);
  }
  if (jetways.layer.userData.authoredOpenEdgeCount !== 261) {
    throw new Error(`Exact live T4 jetway edge count changed: ${jetways.layer.userData.authoredOpenEdgeCount}/261`);
  }

  const nearest = nearestDistanceToA1(THREE, buildings.layer);

  environment.userData = {
    ...(environment.userData || {}),
    environmentSource: "KPHX 1.75.1 exact T4 live runtime",
    authoredTerminal4: buildings.layer,
    authoredTerminal4Jetways: jetways.layer,
    authoredTerminal4TextureCount: 4,
    authoredTerminal4ExactTextureCount: 4,
    authoredTerminal4FallbackTextureCount: 0,
    authoredTerminal4TexturedMaterialCount: 2,
    authoredTerminal4Position: [0, 0, 0],
    authoredTerminal4A1NearestGeometryDistance: nearest,
    authoredTerminal4Placement: "earth.wed.xml exact WED objects 2327 + 5301",
    authoredTerminal4A1JetwayWallDistance: nearest,
    authoredTerminal4JetwaySourceScaleAuthority: "WED coordinates; no manual scaling",
    authoredTerminal4JetwaySourceGeometryMode: "exact XP11 Jetway_1_solid.fac from authored WED wall choices",
    authoredTerminal4RequiresOriginalJetwayMesh: true,
    authoredTerminal4JetwayInitialState: "attached-to-aircraft-door",
    authoredTerminal4RequiredPrePushSequence: "AutoGate DISENGAGE: reverse CRJ door lat target to zero over 15 seconds, telescope exact tunnel and rotate/counter-rotate exact cabin",
    authoredTerminal4A1JetwayController: jetways.a1Controller,
    authoredTerminal4RunRepresentativeJetwayAudit:
      jetways.runRepresentativeControllerAudit,
    authoredTerminal4JetwayResolvedPlacementCount:
      jetways.layer.userData.stockAutoGateResolvedPlacementCount,
    authoredTerminal4JetwayLazyFactoryCount:
      jetways.layer.userData.stockAutoGateLazyFactoryCount,
    authoredTerminal4A1JetwayAnimationAuthority: jetways.layer.userData.a1JetwayAnimationAuthority,
    authoredTerminal4A1JetwayAttachedLatMeters: jetways.layer.userData.a1JetwayAttachedLatMeters,
    authoredTerminal4A1JetwayMotionDurationMs: jetways.layer.userData.a1JetwayMotionDurationMs,
    authoredTerminal4A1JetwayVerticalResolved: jetways.layer.userData.a1JetwayVerticalResolved,
    authoredTerminal4UploadedJetwayLoadState: "exact-source-ready",
    authoredTerminal4UploadedJetwayCount: 76,
    authoredTerminal4UploadedJetwayConnectorCount: 261,
    authoredTerminal4UploadedJetwayVerifiedModelCount: 76,
    authoredTerminal4UploadedJetwayReadyAuthority: jetways.layer.userData.sourceAuthority,
    authoredTerminal4UploadedJetwayArticulationAuthority:
      "A1-user-verified-plus-source-resolved-lazy-controller-factories-all-76-v2",
    authoredTerminal4UploadedJetwaySourceContactDistanceMeters: Number.NaN,
    authoredTerminal4UploadedJetwayStaticArticulatedGateCount: 76,
    authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters: 0,
    authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1AttachedExtensionMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1ActualDoorGapMeters: Number.NaN,
    authoredTerminal4UploadedJetwayA1PartOrderValid: true,
    authoredTerminal4UploadedJetwayA1PartCentersMeters: "exact-WED-facade",
    authoredTerminal4TerminalConnectedJetwayCount: 76,
    authoredTerminal4SourceCutoutMaterialCount: 2,
    authoredTerminal4SourceClosedBayMaterialCount: 0,
    authoredTerminal4SourceFacadeOpenCellCount: 0,
    authoredTerminal4SourceFacadeClosedCellCount: 0,
    authoredTerminal4SourceFacadeVariantMaterialCount: 0,
    authoredTerminal4A1TerminalPortalSealAuthority: "source-only-no-infill",
    authoredTerminal4A1TerminalPortalSealOverlapMeters: 0,
    authoredTerminal4A1TerminalPortalSealExactTexture: true,
    authoredTerminal4FacadeInfillCount: 0,
    authoredTerminal4OpenServiceBayCount: 0,
    authoredTerminal4JetwayDetailLevel: "exact XP11 source facade",
    authoredTerminal4LowerFacadeFitCount: 0,
    authoredTerminal4JetwayTextureAuthority: "exact XP11 stock jetway source textures",
    authoredTerminal4ExactJetwayTextureActive: true,
    exactLiveT4BuildingCount: 2,
    exactLiveT4JetwayCount: 76,
    exactLiveT4JetwayOpenEdgeCount: 261,
    exactLiveOldAirportJetwayGlbUsed: false,
  };

  return {
    buildings,
    jetways,
    layer: buildings.layer,
    root: buildings.layer,
  };
}
