import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";
import { polishUploadedA1JetwayDetail } from "./a1UploadedJetwayDetailPolish.js";

const READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;
const A1_DETAIL_POLISH_AUTHORITY = "a1-original-stair-bogie-readable-metal-and-sharp-edges-v1";

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
        const a1DetailPolish = a1Model.userData.a1SourceDetailPolishAuthority === A1_DETAIL_POLISH_AUTHORITY
          ? {
            authority: A1_DETAIL_POLISH_AUTHORITY,
            stairMeshCount: Number(a1Model.userData.a1SourceStairMeshCount || 0),
            bogieMeshCount: Number(a1Model.userData.a1SourceBogieMeshCount || 0),
            edgeOverlayCount: Number(a1Model.userData.a1SourceDetailEdgeOverlayCount || 0),
            geometryReplaced: a1Model.userData.a1SourceDetailGeometryReplaced === true,
          }
          : polishUploadedA1JetwayDetail(THREE, a1Model);
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
          || a1DetailPolish.authority !== A1_DETAIL_POLISH_AUTHORITY
          || a1DetailPolish.stairMeshCount !== 1
          || a1DetailPolish.bogieMeshCount !== 1
          || a1DetailPolish.edgeOverlayCount !== 2
          || a1DetailPolish.geometryReplaced
        ) {
          reject(new Error(
            `Uploaded airport jetway fleet reported ready with ${count} placements, ${connectorCount} connectors, ${modelCount} gate records, shell material ${materialAuthority}, detail material ${detailMaterialAuthority}, stair split ${stairMaterialSplitActive}, performance ${performanceAuthority}, ${shadowCasterGateCount} shadow-casting gates, ${globalEdgeOverlayCount} global edge overlays, ${staticInstancedGateCount} instanced static jetways, ${animatedIndividualGateCount} animated jetways, ${staticPrimitiveBatchCount} jetway primitive batches, ${staticConnectorGateCount} static connector gates, ${staticConnectorBatchCount} connector batches, ${staticConnectorInstanceCount} connector instances, connector authority ${staticConnectorBatchAuthority}, ${individualConnectorGateCount} individual connectors, and A1 detail ${a1DetailPolish.authority}/${a1DetailPolish.stairMeshCount}/${a1DetailPolish.bogieMeshCount}/${a1DetailPolish.edgeOverlayCount}/${a1DetailPolish.geometryReplaced}${missingModels.length ? `; missing ${missingModels.join(", ")}` : ""}`,
          ));
          return;
        }
        group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
        group.userData.uploadedJetwayVerifiedModelCount = modelCount;
        group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
        group.userData.uploadedJetwayA1DetailPolishAuthority = a1DetailPolish.authority;
        group.userData.uploadedJetwayA1SourceStairMeshCount = a1DetailPolish.stairMeshCount;
        group.userData.uploadedJetwayA1SourceBogieMeshCount = a1DetailPolish.bogieMeshCount;
        group.userData.uploadedJetwayA1DetailEdgeOverlayCount = a1DetailPolish.edgeOverlayCount;
        group.userData.uploadedJetwayA1SourceGeometryReplaced = a1DetailPolish.geometryReplaced;
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
          a1DetailPolish,
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
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-source-detail-material-facade-portal-and-a1-readability";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };
