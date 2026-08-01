import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";

const READY_AUTHORITY = "uploaded-airport-jetway-fleet-complete-58-gates-v5-source-textured-optimized";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;

function waitForFleet(group, placements) {
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
        const materialAuthority = group.userData.uploadedJetwayMaterialAuthority || "missing";
        const performanceAuthority = group.userData.uploadedJetwayPerformanceAuthority || "missing";
        const shadowCasterGateCount = Number(group.userData.uploadedJetwayShadowCasterGateCount ?? -1);
        const globalEdgeOverlayCount = Number(group.userData.uploadedJetwayGlobalEdgeOverlayCount ?? -1);
        if (
          count !== EXPECTED_GATE_COUNT
          || connectorCount !== EXPECTED_GATE_COUNT
          || modelCount !== EXPECTED_GATE_COUNT
          || !materialAuthority.includes("exact-M1DGJETWAY")
          || performanceAuthority !== "shared-geometry-single-a1-shadow-caster-no-global-edge-overlays-v3"
          || shadowCasterGateCount !== 1
          || globalEdgeOverlayCount !== 0
        ) {
          reject(new Error(
            `Uploaded airport jetway fleet reported ready with ${count} placements, ${connectorCount} connectors, ${modelCount} models, material ${materialAuthority}, performance ${performanceAuthority}, ${shadowCasterGateCount} shadow-casting gates and ${globalEdgeOverlayCount} global edge overlays${missingModels.length ? `; missing ${missingModels.join(", ")}` : ""}`,
          ));
          return;
        }
        group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
        group.userData.uploadedJetwayVerifiedModelCount = modelCount;
        group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
        resolve({
          count,
          connectorCount,
          modelCount,
          materialAuthority,
          performanceAuthority,
          shadowCasterGateCount,
          globalEdgeOverlayCount,
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
  const ready = waitForFleet(group, placements);
  group.userData.uploadedJetwayReady = ready;
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-complete-58-gate-source-textured-optimized-fleet";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };
