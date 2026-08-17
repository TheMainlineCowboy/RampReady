import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";
import { installStaticJetwayPortalClosures } from "./staticJetwayPortalClosures.js";
import { enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js";
import { fitUploadedA1JetwayToRenderedCrjDoor } from "./uploadedAirportJetwayA1DoorFitV11.js";
import { UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY } from "./uploadedAirportJetwayArticulationV10.js";
import {
  correctUploadedJetwayInstallation,
  UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY,
  UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY,
  UPLOADED_JETWAY_ASSEMBLY_CONTINUITY_AUTHORITY,
} from "./correctUploadedJetwayInstallationV1.js";

const READY_AUTHORITY = "exact-uploaded-airport-jetway-complete-58-gates-v1";
const FINAL_VISIBLE_FIT_AUTHORITY = "a1-final-visible-fleet-ready-physical-door-fit-v1";
const PHYSICAL_FIT_AUTHORITY = "supplied-a1-full-3d-crj-door-fit-v11";
const EXPECTED_GATE_COUNT = 58;
const LOAD_TIMEOUT_MS = 120_000;
const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";
const EXACT_MODEL_AUTHORITY = "supplied-airport-jetway-source-hierarchy-meshes-uvs-exclusive-v10";
const MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1";
const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";

function waitForFleet(THREE, group, placements, controller) {
  const startedAt = performance.now();
  const expectedModelNames = new Set(placements.map((placement) => `UploadedAirportJetway_${placement.gate}`));
  return new Promise((resolve, reject) => {
    const check = () => {
      const state = group.userData.uploadedJetwayLoadState;
      if (state === "error") {
        reject(new Error(group.userData.uploadedJetwayLoadError || "Exact Airport_Jetway.glb fleet failed to load"));
        return;
      }
      if (state === "ready") {
        try {
          const fleet = group.getObjectByName("UploadedAirportJetwayFleet");
          if (!fleet) throw new Error("Exact Airport_Jetway.glb fleet reported ready without a fleet group");
          const loadedModelNames = new Set(
            fleet.children.map((entry) => entry.name).filter((name) => expectedModelNames.has(name)),
          );
          const missingModels = [...expectedModelNames].filter((name) => !loadedModelNames.has(name));
          const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
          const a1Model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
          if (!a1Anchor || !a1Model) throw new Error("Exact Airport_Jetway.glb fleet is missing the individual A1 model");

          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);
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
          const exactGlbSha256 = group.userData.uploadedJetwayExactGlbSha256 || "missing";
          const articulationAuthority = group.userData.uploadedJetwayArticulationAuthority || "missing";
          const sourceContactDistance = Number(group.userData.uploadedJetwaySourceContactDistanceMeters ?? NaN);
          const staticArticulatedGateCount = Number(group.userData.uploadedJetwayStaticArticulatedGateCount ?? -1);
          const staticMaximumContactError = Number(group.userData.uploadedJetwayStaticMaximumContactErrorMeters ?? Infinity);
          const a1TargetDoorDistance = Number(group.userData.uploadedJetwayA1TargetDoorDistanceMeters ?? NaN);
          const a1AttachedExtension = Number(group.userData.uploadedJetwayA1AttachedExtensionMeters ?? NaN);
          const a1PredictedDoorGap = Number(group.userData.uploadedJetwayA1PredictedDoorGapMeters ?? Infinity);
          const a1PredictedContactDistance = Number(group.userData.uploadedJetwayA1PredictedContactDistanceMeters ?? NaN);
          const a1ActualContactDistance = Number(group.userData.uploadedJetwayA1ActualContactDistanceMeters ?? NaN);
          const a1ActualDoorGap = Number(group.userData.uploadedJetwayA1ActualDoorGapMeters ?? Infinity);
          const a1PartOrderValid = group.userData.uploadedJetwayA1PartOrderValid === true;
          const installationAuthority = group.userData.uploadedJetwayInstallationCorrectionAuthority || "missing";
          const fleetGroundOffset = Number(group.userData.uploadedJetwayFleetGroundOffsetMeters ?? Infinity);
          const bogieTireCorrection = Number(group.userData.uploadedJetwayBogieTireContactCorrectionMeters ?? NaN);
          const a1TerminalConnectionAuthority = group.userData.uploadedJetwayA1TerminalConnectionAuthority || "missing";
          const a1TerminalWallDistance = Number(group.userData.uploadedJetwayA1TerminalWallDistanceMeters ?? NaN);
          const a1TerminalDirection = group.userData.uploadedJetwayA1TerminalConnectionDirection || [];
          const a1PortalAlignmentError = Number(group.userData.uploadedJetwayA1PortalAlignmentErrorRadians ?? Infinity);
          const staticPortalAlignedGateCount = Number(group.userData.uploadedJetwayStaticPortalAlignedGateCount ?? -1);
          const staticPortalAlignmentError = Number(group.userData.uploadedJetwayStaticMaximumPortalAlignmentErrorRadians ?? Infinity);
          const doubleSidedMaterialCount = Number(group.userData.uploadedJetwayDoubleSidedMaterialCount ?? -1);
          const assemblyContinuityAuthority = group.userData.uploadedJetwayA1AssemblyContinuityAuthority || "missing";
          const assemblyPartCount = Number(group.userData.uploadedJetwayA1AssemblyPartCount ?? -1);
          const assemblyTransformError = Number(group.userData.uploadedJetwayA1AssemblyTransformError ?? Infinity);
          const isolatedNodeRotationCount = Number(group.userData.uploadedJetwayA1IsolatedNodeRotationCount ?? -1);
          const connectorVisibleLength = Number(group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters ?? NaN);
          const connectorRibCount = Number(group.userData.uploadedJetwayA1ConnectorRibCount ?? -1);
          const terminalDirectionMagnitude = Math.hypot(
            Number(a1TerminalDirection[0] ?? NaN),
            Number(a1TerminalDirection[1] ?? NaN),
          );

          if (
            count !== EXPECTED_GATE_COUNT
            || loadedModelNames.size !== EXPECTED_GATE_COUNT
            || missingModels.length
            || materialAuthority !== MATERIAL_AUTHORITY
            || performanceAuthority !== PERFORMANCE_AUTHORITY
            || exactGlbSha256 !== "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0"
            || sourceTriangleCount !== 31_978
            || maximumPositionErrorMeters !== 0
            || maximumUvError !== 0
            || staticInstancedGateCount !== 57
            || animatedIndividualGateCount !== 1
            || staticPrimitiveBatchCount !== 7
            || staticConnectorGateCount !== 57
            || staticConnectorBatchCount !== 3
            || individualConnectorGateCount !== 1
            || articulationAuthority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY
            || !(sourceContactDistance > 20 && sourceContactDistance < 32)
            || staticArticulatedGateCount !== 57
            || staticMaximumContactError > 0.05
            || !(a1TargetDoorDistance > 0)
            || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)
            || a1PredictedDoorGap > 0.05
            || Math.abs(a1PredictedContactDistance - a1TargetDoorDistance) > 0.05
            || Math.abs(a1ActualContactDistance - a1TargetDoorDistance) > 0.05
            || a1ActualDoorGap > 0.05
            || !a1PartOrderValid
            || installationAuthority !== UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY
            || Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6
            || !(bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1)
            || a1TerminalConnectionAuthority !== UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY
            || !(a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12)
            || Math.abs(terminalDirectionMagnitude - 1) > 0.01
            || a1PortalAlignmentError > 1e-6
            || staticPortalAlignedGateCount !== 57
            || staticPortalAlignmentError > 1e-6
            || doubleSidedMaterialCount < 2
            || assemblyContinuityAuthority !== UPLOADED_JETWAY_ASSEMBLY_CONTINUITY_AUTHORITY
            || assemblyPartCount !== 5
            || assemblyTransformError > 1e-9
            || isolatedNodeRotationCount !== 0
            || !(connectorVisibleLength > 0.25 && connectorVisibleLength < 12)
            || connectorRibCount < 1
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
              `Exact jetway readiness mismatch: placements=${count}, gateRecords=${loadedModelNames.size}, missing=${missingModels.join(",") || "none"}, sha=${exactGlbSha256}, materials=${materialAuthority}, performance=${performanceAuthority}, topology=${sourceTriangleCount}/${maximumPositionErrorMeters}/${maximumUvError}, static=${staticInstancedGateCount}, animated=${animatedIndividualGateCount}, meshBatches=${staticPrimitiveBatchCount}, connectors=${staticConnectorGateCount}/${staticConnectorBatchCount}/${individualConnectorGateCount}, articulation=${articulationAuthority}/${sourceContactDistance}/${staticArticulatedGateCount}/${staticMaximumContactError}, A1=${a1TargetDoorDistance}/${a1AttachedExtension}/${a1PredictedContactDistance}/${a1PredictedDoorGap}/${a1ActualContactDistance}/${a1ActualDoorGap}/${a1PartOrderValid}, installation=${installationAuthority}/${fleetGroundOffset}/${bogieTireCorrection}/${a1TerminalConnectionAuthority}/${a1TerminalWallDistance}/${a1TerminalDirection.join(",")}/${a1PortalAlignmentError}/${staticPortalAlignedGateCount}/${staticPortalAlignmentError}/${doubleSidedMaterialCount}, chain=${assemblyContinuityAuthority}/${assemblyPartCount}/${assemblyTransformError}/${isolatedNodeRotationCount}, connector=${connectorVisibleLength}/${connectorRibCount}, source=${exactModelGuard.authority}/${exactModelGuard.hierarchy.requiredPartCount}/${exactModelGuard.hierarchy.sourceMeshCount}/${exactModelGuard.hierarchy.uvMeshCount}/${exactModelGuard.hierarchy.syntheticEdgeCount}/${exactModelGuard.hierarchy.geometryReplaced}`,
            );
          }

          const finalVisibleFit = fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements);
          if (!finalVisibleFit || finalVisibleFit.authority !== PHYSICAL_FIT_AUTHORITY) {
            throw new Error(`A1 final visible physical fit returned invalid authority: ${finalVisibleFit?.authority || "missing"}`);
          }
          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {
            throw new Error(`A1 final visible Cab did not reach grounded CRJ door: vertical=${finalVisibleFit.verticalGapMeters}`);
          }
          if (!controller?.bind || !controller?.setDeployment) {
            throw new Error("A1 final visible physical fit cannot rebase the live deployment controller");
          }
          controller.bind(a1Anchor);
          controller.setDeployment(1);
          a1Model.updateWorldMatrix(true, true);
          group.userData.uploadedJetwayA1FinalVisibleFitAuthority = FINAL_VISIBLE_FIT_AUTHORITY;
          group.userData.uploadedJetwayA1FinalPhysicalDoorFitAuthority = finalVisibleFit.authority;
          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;
          group.userData.uploadedJetwayA1FinalPhysicalDoorHorizontalGapMeters = finalVisibleFit.horizontalGapMeters;
          group.userData.uploadedJetwayA1FinalPhysicalDoorVectorGapMeters = finalVisibleFit.vectorGapMeters;
          group.userData.uploadedJetwayA1FinalPhysicalDoorPitchDegrees = finalVisibleFit.pitchDegrees;
          group.userData.uploadedJetwayA1FinalPhysicalDoorStairMinimumHeightMeters = finalVisibleFit.stairGrounding.minimumY;
          group.userData.uploadedJetwayA1FinalPhysicalDoorMechanicalMinimumHeightMeters = finalVisibleFit.mechanicalGrounding.minimumY;

          group.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
          group.userData.uploadedJetwayVerifiedModelCount = loadedModelNames.size;
          group.userData.uploadedJetwayVerifiedGateNames = [...loadedModelNames].sort().join(",");
          group.userData.uploadedJetwayA1DetailPolishAuthority = "none-exact-glb-preserved";
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
            exactGlbSha256,
            materialAuthority,
            performanceAuthority,
            sourceTriangleCount,
            maximumPositionErrorMeters,
            maximumUvError,
            staticInstancedGateCount,
            animatedIndividualGateCount,
            staticPrimitiveBatchCount,
            articulationAuthority,
            sourceContactDistance,
            staticArticulatedGateCount,
            staticMaximumContactError,
            a1TargetDoorDistance,
            a1AttachedExtension,
            a1PredictedDoorGap,
            a1ActualDoorGap,
            installationCorrection,
            finalVisibleFit,
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
        group.userData.uploadedJetwayLoadError = `Exact Airport_Jetway.glb fleet did not become ready within ${LOAD_TIMEOUT_MS} ms`;
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
  const ready = waitForFleet(THREE, group, placements, controller);
  group.userData.uploadedJetwayReady = ready;
  group.userData.uploadedJetwayReadyAuthority = "waiting-for-exact-airport-jetway-glb";
  controller.ready = ready;
  return controller;
}

export { READY_AUTHORITY as UPLOADED_AIRPORT_JETWAY_READY_AUTHORITY };