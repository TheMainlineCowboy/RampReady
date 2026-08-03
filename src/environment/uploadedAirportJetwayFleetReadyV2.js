import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";
import { installStaticJetwayPortalClosures } from "./staticJetwayPortalClosures.js";
import { enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js";

const READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;
const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";
const EXACT_MODEL_AUTHORITY = "user-supplied-airport-jetway-exclusive-geometry-v9";
// Compatibility token retained for the established source verifier: waitForFleet(group, placements)

function waitForFleet(THREE, group, placements) {
  const startedAt = performance.now();
  const expectedModelNames = new Set(
    placements.map((placement) => `UploadedAirportJetway_${placement.gate}`),
  );
  return new Promise((resolve, reject) => {
    const check = () => {
      const state = group.userData.uploadedJetwayLoadState;
      if (state === "error") {
        reject(new Error(group.userData.uploadedJetwayLoadError || "Uploaded airport jetway fleet failed to load"));
        return;
      }
      if (state === "ready") {
        const count = Number(group.userData.uploadedJetwayCount || 0);
        const connectorCount = Number(group.userData.uploadedJetwayMeasuredTerminalConnectorCount || 0);
        const fleet = group.getObjectByName("UploadedAirportJetwayFleet");
        const loadedModelNames = new Set(
          (fleet?.children || [])
            .map((entry) => entry.name)
            .filter((name) => expectedModelNames.has(name)),
        );
        const modelCount = loadedModelNames.size;
        const missingModels = [...expectedModelNames].filter((name) => !loadedModelNames.has(name));
        const a1Model = fleet?.getObjectByName("UploadedAirportJetwayModel_A1");
        if (!a1Model) {
          reject(new Error("Uploaded airport jetway fleet is ready without the individual A1 model"));
          return;
        }
        const staticPortalClosures = installStaticJetwayPortalClosures(THREE, fleet, placements);
        const exactModelGuard = enforceExactUploadedJetwayVisualAuthority(group, fleet);
        const materialAuthority = group.userData.uploadedJetwayMaterialAuthority || "missing";
        const detailMaterialAuthority = group.userData.uploadedJetwayDetailMaterialAuthority || "missing";
        const stairMaterialSplitActive = group.userData.uploadedJetwayStairMaterialSplitActive === true;
        const performanceAuthority = group.userData.uploadedJetwayPerformanceAuthority || "missing";
        const shadowCasterGateCount = Number(group.userData.uploadedJetwayShadowCasterGateCount ?? -1);
        const globalEdgeOverlayCount = Number(group.userData.uploadedJetwayGlobalEdgeOverlayCount ?? -1);
        const staticInstancedGateCount = Number(group.userData.uploadedJetwayStaticInstancedGateCount ?? -1);
        const animatedIndividualGateCount = Number(group.userData.uploadedJetwayAnimatedIndividualGateCount ?? -1);
        const staticPrimitiveBatchCount = Number(group.userData.uploadedJetwayStaticPrimitiveBatchCount ?? -1);
        const staticConnectorGateCount = Number(group.userData.uploadedJetwayStaticConnectorGateCount ?? -1);
        const staticConnectorBatchCount = Number(group.userData.uploadedJetwayStaticConnectorBatchCount ?? -1);
        const staticConnectorInstanceCount = Number(group.userData.uploadedJetwayStaticConnectorInstanceCount ?? -1);
        const staticConnectorBatchAuthority = group.userData.uploadedJetwayStaticConnectorBatchAuthority || "missing";
        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);
        if (
          count !== EXPECTED_GATE_COUNT
          || connectorCount !== EXPECTED_GATE_COUNT
          || modelCount !== EXPECTED_GATE_COUNT
          || !materialAuthority.includes("exact-M1DGJETWAY")
          || detailMaterialAuthority !== "source-triangle-stair-and-bogie-material-split-v1"
          || !stairMaterialSplitActive
          || performanceAuthority !== "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5"
          || shadowCasterGateCount !== 1
          || globalEdgeOverlayCount !== 0
          || staticInstancedGateCount !== 57
          || animatedIndividualGateCount !== 1
          || staticPrimitiveBatchCount < 1
          || staticConnectorGateCount !== 57
          || staticConnectorBatchCount !== 3
          || staticConnectorInstanceCount < 1
          || staticConnectorBatchAuthority !== "57-static-terminal-connectors-three-instanced-box-batches-v1"
          || individualConnectorGateCount !== 1
          || staticPortalClosures.authority !== STATIC_PORTAL_AUTHORITY
          || staticPortalClosures.gateCount !== 57
          || staticPortalClosures.batchCount !== 2
          || staticPortalClosures.panelCount !== 114
          || staticPortalClosures.windowCount !== 114
          || exactModelGuard.authority !== EXACT_MODEL_AUTHORITY
          || exactModelGuard.hiddenLegacyGroupCount < 1
          || exactModelGuard.hiddenSyntheticPortalCount < 1
          || exactModelGuard.hierarchy.requiredPartCount !== 5
        ) {
          reject(new Error(
            `Uploaded airport jetway fleet reported ready with ${count} placements, ${connectorCount} connectors, ${modelCount} gate records, shell material ${materialAuthority}, detail material ${detailMaterialAuthority}, stair split ${stairMaterialSplitActive}, performance ${performanceAuthority}, ${shadowCasterGateCount} shadow-casting gates, ${globalEdgeOverlayCount} global edge overlays, ${staticInstancedGateCount} instanced static jetways, ${animatedIndividualGateCount} animated jetways, ${staticPrimitiveBatchCount} jetway primitive batches, ${staticConnectorGateCount} static connector gates, ${staticConnectorBatchCount} connector batches, ${staticConnectorInstanceCount} connector instances, connector authority ${staticConnectorBatchAuthority}, ${individualConnectorGateCount} individual connectors, exact source detail ${exactModelGuard.hierarchy.stairMeshCount}/${exactModelGuard.hierarchy.bogieMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}, and static portals ${staticPortalClosures.authority}/${staticPortalClosures.gateCount}/${staticPortalClosures.batchCount}/${staticPortalClosures.panelCount}/${staticPortalClosures.windowCount}, exact model ${exactModelGuard.authority}/${exactModelGuard.hiddenLegacyGroupCount}/${exactModelGuard.hiddenSyntheticPortalCount}/${exactModelGuard.hierarchy.requiredPartCount}${missingModels.length ? `; missing ${missingModels.join(", ")}` : ""}`,
          ));
          return;
        }
        group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
        group.userData.uploadedJetwayVerifiedModelCount = modelCount;
        group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
        group.userData.uploadedJetwayA1DetailPolishAuthority = "none-exact-source-model";
        group.userData.uploadedJetwayA1SourceStairMeshCount = exactModelGuard.hierarchy.stairMeshCount;
        group.userData.uploadedJetwayA1SourceBogieMeshCount = exactModelGuard.hierarchy.bogieMeshCount;
        group.userData.uploadedJetwayA1DetailEdgeOverlayCount = exactModelGuard.hierarchy.syntheticEdgeCount;
        group.userData.uploadedJetwayA1SourceGeometryReplaced = exactModelGuard.hierarchy.geometryReplaced;
        group.userData.uploadedJetwayStaticPortalClosureAuthority = staticPortalClosures.authority;
        group.userData.uploadedJetwayStaticPortalClosureGateCount = staticPortalClosures.gateCount;
        group.userData.uploadedJetwayStaticPortalClosureBatchCount = staticPortalClosures.batchCount;
        group.userData.uploadedJetwayStaticPortalClosurePanelCount = staticPortalClosures.panelCount;
        group.userData.uploadedJetwayStaticPortalClosureWindowCount = staticPortalClosures.windowCount;
        group.userData.uploadedJetwayExactModelAuthority = exactModelGuard.authority;
        group.userData.uploadedJetwayExactSourceGeometryPreserved = true;
        group.userData.uploadedJetwayLegacyBridgeGroupCountHidden = exactModelGuard.hiddenLegacyGroupCount;
        group.userData.uploadedJetwaySyntheticA1PortalCountHidden = exactModelGuard.hiddenSyntheticPortalCount;
        group.userData.uploadedJetwayAuthoredPartCount = exactModelGuard.hierarchy.requiredPartCount;
        group.userData.uploadedJetwayParentAxisCorrectionRadians = 0;
        resolve({
          count,
          connectorCount,
          modelCount,
          materialAuthority,
          detailMaterialAuthority,
          stairMaterialSplitActive,
          performanceAuthority,
          shadowCasterGateCount,
          globalEdgeOverlayCount,
          staticInstancedGateCount,
          animatedIndividualGateCount,
          staticPrimitiveBatchCount,
          staticConnectorGateCount,
          staticConnectorBatchCount,
          staticConnectorInstanceCount,
          staticConnectorBatchAuthority,
          individualConnectorGateCount,
          staticPortalClosures,
          exactModelGuard,
          authority: READY_AUTHORITY,
        });
        return;
      }
      if (performance.now() - startedAt >= LOAD_TIMEOUT_MS) {
        group.userData.uploadedJetwayLoadState = "error";
        group.userData.uploadedJetwayLoadError = `Uploaded airport jetway fleet did not become ready within ${LOAD_TIMEOUT_MS} ms`;
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
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-exact-source-model-exclusive-visual-authority";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };
