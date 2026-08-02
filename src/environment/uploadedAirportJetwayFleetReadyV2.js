import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";

const READY_AUTHORITY = "supplied-airport-jetway-source-only-58-gates-v1";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;

function waitForFleet(group, placements) {
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
        const fleet = group.getObjectByName("UploadedAirportJetwayFleet");
        const loadedModelNames = new Set(
          (fleet?.children || []).map((entry) => entry.name).filter((name) => expectedModelNames.has(name)),
        );
        const missingModels = [...expectedModelNames].filter((name) => !loadedModelNames.has(name));
        const count = Number(group.userData.uploadedJetwayCount || 0);
        const modelCount = loadedModelNames.size;
        const generatedConnectorCount = Number(group.userData.uploadedJetwayGeneratedConnectorCount ?? -1);
        const generatedPortalCount = Number(group.userData.uploadedJetwayGeneratedPortalCount ?? -1);
        const generatedFacadeCount = Number(group.userData.uploadedJetwayGeneratedFacadeCount ?? -1);
        const proceduralObjectCount = Number(group.userData.proceduralJetwayObjectCount ?? -1);
        const materialAuthority = group.userData.uploadedJetwayMaterialAuthority || "missing";
        const geometryAuthority = group.userData.uploadedJetwayModelAuthority || "missing";
        const performanceAuthority = group.userData.uploadedJetwayPerformanceAuthority || "missing";
        const staticGateCount = Number(group.userData.uploadedJetwayStaticInstancedGateCount ?? -1);
        const animatedGateCount = Number(group.userData.uploadedJetwayAnimatedIndividualGateCount ?? -1);
        const a1Model = fleet?.getObjectByName("UploadedAirportJetwayModel_A1");

        if (
          count !== EXPECTED_GATE_COUNT
          || modelCount !== EXPECTED_GATE_COUNT
          || missingModels.length
          || !a1Model
          || generatedConnectorCount !== 0
          || generatedPortalCount !== 0
          || generatedFacadeCount !== 0
          || proceduralObjectCount !== 0
          || geometryAuthority !== "user-supplied-airport-jetway-source-geometry-v1"
          || materialAuthority !== "supplied-material-slots-no-projected-terminal-texture"
          || performanceAuthority !== "57-static-source-instances-plus-1-animated-source-model"
          || staticGateCount !== 57
          || animatedGateCount !== 1
        ) {
          reject(new Error(
            `Supplied jetway readiness failed: placements=${count}, models=${modelCount}, missing=${missingModels.join(",") || "none"}, A1=${Boolean(a1Model)}, connectors=${generatedConnectorCount}, portals=${generatedPortalCount}, facades=${generatedFacadeCount}, procedural=${proceduralObjectCount}, geometry=${geometryAuthority}, material=${materialAuthority}, performance=${performanceAuthority}, static=${staticGateCount}, animated=${animatedGateCount}`,
          ));
          return;
        }

        group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
        group.userData.uploadedJetwayVerifiedModelCount = modelCount;
        group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
        resolve({
          count,
          modelCount,
          generatedConnectorCount,
          generatedPortalCount,
          generatedFacadeCount,
          proceduralObjectCount,
          geometryAuthority,
          materialAuthority,
          performanceAuthority,
          staticGateCount,
          animatedGateCount,
          authority: READY_AUTHORITY,
        });
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
  const ready = waitForFleet(group, placements);
  group.userData.uploadedJetwayReady = ready;
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-supplied-source-only-fleet";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };
