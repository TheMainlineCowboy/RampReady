import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";
import { installStaticJetwayPortalClosures } from "./staticJetwayPortalClosures.js";
import { enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js";

const READY_AUTHORITY = "supplied-airport-jetway-complete-58-gates-source-hierarchy-v9";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;
const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";
const EXACT_MODEL_AUTHORITY = "supplied-airport-jetway-source-hierarchy-meshes-uvs-exclusive-v10";
const MATERIAL_AUTHORITY = "supplied-airport-jetway-source-atlas-full-resolution-avif-v4";
const PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v4";

function waitForFleet(THREE, group, placements) {
  const startedAt = performance.now();
  const expectedModelNames = new Set(placements.map((placement) => `UploadedAirportJetway_${placement.gate}`));
  return new Promise((resolve, reject) => {
    const check = () => {
      const state = group.userData.uploadedJetwayLoadState;
      if (state === "error") {
        reject(new Error(group.userData.uploadedJetwayLoadError || "Supplied airport jetway fleet failed to load"));
        return;
      }
      if (state === "ready") {
        try {
          const fleet = group.getObjectByName("UploadedAirportJetwayFleet");
          if (!fleet) throw new Error("Supplied airport jetway fleet reported ready without a fleet group");
          const loadedModelNames = new Set(
            fleet.children.map((entry) => entry.name).filter((name) => expectedModelNames.has(name)),
          );
          const missingModels = [...expectedModelNames].filter((name) => !loadedModelNames.has(name));
          const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
          const a1Model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
          if (!a1Anchor || !a1Model) throw new Error("Supplied airport jetway fleet is missing the individual A1 source model");

          const exactModelGuard = enforceExactUploadedJetwayVisualAuthority(group, fleet);
          const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements);
          const count = Number(group.userData.uploadedJetwayCount || 0);
          const staticInstancedGateCount = Number(group.userData.uploadedJetwayStaticInstancedGateCount ?? -1);
          const animatedIndividualGateCount = Number(group.userData.uploadedJetwayAnimatedIndividualGateCount ?? -1);
          const staticPrimitiveBatchCount = Number(group.userData.uploadedJetwayStaticPrimitiveBatchCount ?? -1);
          const staticConnectorGateCount = Number(group.userData.uploadedJetwayStaticConnectorGateCount ?? -1);
          const staticConnectorBatchCount = Number(group.userData.uploadedJetwayStaticConnectorBatchCount ?? -1);
          const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);
          const materialAuthority = group.userData.uploadedJetwayMaterialAuthority || "missing";
          const performanceAuthority = group.userData.uploadedJetwayPerformanceAuthority || "missing";
          const sourceTriangleCount = Number(group.userData.uploadedJetwaySourceTriangleCount ?? -1);
          const maximumPositionErrorMeters = Number(group.userData.uploadedJetwayMaximumPositionErrorMeters ?? Infinity);
          const maximumUvError = Number(group.userData.uploadedJetwayMaximumUvError ?? Infinity);

          if (
            count !== EXPECTED_GATE_COUNT
            || loadedModelNames.size !== EXPECTED_GATE_COUNT
            || missingModels.length
            || materialAuthority !== MATERIAL_AUTHORITY
            || performanceAuthority !== PERFORMANCE_AUTHORITY
            || sourceTriangleCount !== 31_978
            || maximumPositionErrorMeters > 0.0001
            || maximumUvError > 0.000008
            || staticInstancedGateCount !== 57
            || animatedIndividualGateCount !== 1
            || staticPrimitiveBatchCount !== 7
            || staticConnectorGateCount !== 57
            || staticConnectorBatchCount !== 3
            || individualConnectorGateCount !== 1
            || exactModelGuard.authority !== EXACT_MODEL_AUTHORITY
            || exactModelGuard.hierarchy.requiredPartCount !== 5
            || exactModelGuard.hierarchy.sourceMeshCount !== 7
            || exactModelGuard.hierarchy.uvMeshCount !== 7
            || exactModelGuard.hierarchy.syntheticEdgeCount !== 0
            || exactModelGuard.hierarchy.geometryReplaced !== false
            || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
            || staticPortalClosures.gateCount !== 57
          ) {
            throw new Error(
              `Supplied jetway readiness mismatch: placements=${count}, gateRecords=${loadedModelNames.size}, missing=${missingModels.join(",") || "none"}, materials=${materialAuthority}, performance=${performanceAuthority}, topology=${sourceTriangleCount}/${maximumPositionErrorMeters}/${maximumUvError}, static=${staticInstancedGateCount}, animated=${animatedIndividualGateCount}, meshBatches=${staticPrimitiveBatchCount}, connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${individualConnectorGateCount}, source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`,
            );
          }

          group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
          group.userData.uploadedJetwayVerifiedModelCount = loadedModelNames.size;
          group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
          group.userData.uploadedJetwayA1DetailPolishAuthority = "none-source-model-preserved";
          group.userData.uploadedJetwayA1SourceStairMeshCount = 1;
          group.userData.uploadedJetwayA1SourceBogieMeshCount = 1;
          group.userData.uploadedJetwayA1DetailEdgeOverlayCount = 0;
          group.userData.uploadedJetwayA1SourceGeometryReplaced = false;
          group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
          group.userData.uploadedJetwayStaticPortalClosureGateCount = staticPortalClosures.gateCount;
          group.userData.uploadedJetwayExactModelAuthority = exactModelGuard.authority;
          group.userData.uploadedJetwayExactSourceGeometryPreserved = true;
          group.userData.uploadedJetwayAuthoredPartCount = exactModelGuard.hierarchy.requiredPartCount;
          group.userData.uploadedJetwayOriginalMeshCount = exactModelGuard.hierarchy.sourceMeshCount;
          group.userData.uploadedJetwayOriginalUvMeshCount = exactModelGuard.hierarchy.uvMeshCount;
          group.userData.uploadedJetwaySourceTriangleCount = sourceTriangleCount;
          group.userData.uploadedJetwayMaximumPositionErrorMeters = maximumPositionErrorMeters;
          group.userData.uploadedJetwayMaximumUvError = maximumUvError;
          group.userData.uploadedJetwayParentAxisCorrectionRadians = 0;
          resolve({
            count,
            modelCount: loadedModelNames.size,
            materialAuthority,
            performanceAuthority,
            sourceTriangleCount,
            maximumPositionErrorMeters,
            maximumUvError,
            staticInstancedGateCount,
            animatedIndividualGateCount,
            staticPrimitiveBatchCount,
            exactModelGuard,
            staticPortalClosures,
            authority: READY_AUTHORITY,
          });
        } catch (error) {
          group.userData.uploadedJetwayLoadState = "error";
          group.userData.uploadedJetwayLoadError = error instanceof Error ? error.message : String(error);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        return;
      }
      if (performance.now() - startedAt >= LOAD_TIMEOUT_MS) {
        group.userData.uploadedJetwayLoadState = "error";
        group.userData.uploadedJetwayLoadError = `Supplied airport jetway fleet did not become ready within ${LOAD_TIMEOUT_MS} ms`;
        reject(new Error(group.userData.uploadedJetwayLoadError));
        return;
      }
      setTimeout(check, 16);
    };
    check();
  });
}

export function installUploadedAirportJetwayFleet(THREE, group, placements, sourceTextures = {}) {
  const controller = installUploadedAirportJetwayFleetBase(THREE, group, placements, sourceTextures);
  const ready = waitForFleet(THREE, group, placements);
  group.userData.uploadedJetwayReady = ready;
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-supplied-source-model";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };
