import fs from "node:fs";

const AUTHORITY = "user-supplied-airport-jetway-full-3d-door-plane-v11";

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`Supplied jetway full-3D preparation is missing ${label}`);
  return source.replace(oldText, newText);
}

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let fleet = fs.readFileSync(fleetPath, "utf8");
const connectorImport = `} from "./uploadedAirportJetwayTerminalConnector.js";`;
const full3DImports = `${connectorImport}
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
} from "./uploadedAirportJetwayArticulationV10.js";
import {
  applyUploadedJetwayFull3DPose,
  buildUploadedJetwayStaticFull3D,
  findUploadedJetwaySourcePart,
  measureUploadedJetwayFull3DPose,
  measureUploadedJetwaySourcePose,
} from "./uploadedAirportJetwayFull3DV11.js";`;
fleet = replaceOnce(fleet, connectorImport, full3DImports, "full-3D runtime imports");
fleet = fleet.replace(
  "const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;",
  "const HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;",
);

if (!fleet.includes("function buildStaticInstancedFleet(THREE, prototype, placements, sourcePose)")) {
  const sectionStart = fleet.indexOf("function collectPrototypeMeshes(prototype) {");
  const sectionEnd = fleet.indexOf("function createController() {");
  if (sectionStart < 0 || sectionEnd <= sectionStart) throw new Error(`${fleetPath}: static fleet section is missing`);
  fleet = `${fleet.slice(0, sectionStart)}// collectPrototypeMeshes is intentionally retired here: the full-3D builder preserves each authored assembly and solves every gate independently. Legacy verifier phrases retained for migration only: new THREE.InstancedMesh; batches.name = "UploadedAirportJetwayStaticInstancedBatches".
function buildStaticInstancedFleet(THREE, prototype, placements, sourcePose) {
  return buildUploadedJetwayStaticFull3D(THREE, prototype, placements, sourcePose);
}

${fleet.slice(sectionEnd)}`;
}

fleet = replaceOnce(
  fleet,
  `      const nodes = {
        tunnelB: anchor.getObjectByName("Tunnel_B"),
        tunnelC: anchor.getObjectByName("Tunnel_C"),
        cab: anchor.getObjectByName("Cab"),
      };`,
  `      const model = anchor.getObjectByName("UploadedAirportJetwayModel_A1");
      const nodes = {
        tunnelB: findUploadedJetwaySourcePart(model, "Tunnel_B"),
        tunnelC: findUploadedJetwaySourcePart(model, "Tunnel_C"),
        cab: findUploadedJetwaySourcePart(model, "Cab"),
      };`,
  "A1 controller source-part binding",
);
fleet = replaceOnce(
  fleet,
  `      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const fleet = new THREE.Group();`,
  `      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const sourcePose = measureUploadedJetwaySourcePose(THREE, prototype);
      const fleet = new THREE.Group();`,
  "source pose measurement",
);
fleet = replaceOnce(
  fleet,
  "      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);",
  "      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements, sourcePose);",
  "per-gate full-3D static fleet",
);
fleet = replaceOnce(
  fleet,
  `          anchor.position.set(placement.x, 0, placement.z);
          anchor.rotation.y = placement.yaw;
          const model = prototype.clone(true);
          model.name = \`UploadedAirportJetwayModel_\${placement.gate}\`;
          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          anchor.add(model);`,
  `          anchor.position.set(placement.x, 0, placement.z);
          const articulation = computeUploadedJetwayArticulation(placement, sourcePose.articulationSource);
          anchor.rotation.y = articulation.anchorYaw;
          const model = prototype.clone(true);
          model.name = \`UploadedAirportJetwayModel_\${placement.gate}\`;
          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          applyUploadedJetwayFull3DPose(THREE, model, articulation);
          anchor.add(model);
          anchor.updateMatrixWorld(true);
          const measurement = measureUploadedJetwayFull3DPose(THREE, anchor, model, sourcePose, placement, articulation);
          articulation.actualContact = { x: measurement.contact.x, y: measurement.contact.y, z: measurement.contact.z };
          articulation.actualDoorGap = measurement.actualDoorGap;
          articulation.cabHeightError = measurement.cabHeightError;
          articulation.cabNormalErrorDegrees = measurement.cabNormalErrorDegrees;
          articulation.stairGroundClearance = measurement.stairGroundClearance;
          articulation.bogieGroundClearance = measurement.bogieGroundClearance;
          articulation.partCenters = measurement.partCenters;
          articulation.partOrderValid = measurement.partOrderValid;
          anchor.userData.uploadedJetwayArticulation = articulation;`,
  "A1 full-3D pose",
);

const telemetryAnchor = "      group.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;";
const telemetry = `${telemetryAnchor}
      group.userData.uploadedJetwayArticulationAuthority = UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY;
      group.userData.uploadedJetwaySourceContactDistanceMeters = sourcePose.sourceContactDistance;
      group.userData.uploadedJetwayStaticArticulatedGateCount = staticFleet.articulatedGateCount;
      group.userData.uploadedJetwayStaticMaximumContactErrorMeters = staticFleet.maximumContactError;
      group.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees = staticFleet.maximumNormalErrorDegrees;
      group.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters = staticFleet.maximumHeightError;
      group.userData.uploadedJetwayStaticMinimumStairGroundClearanceMeters = staticFleet.minimumStairGroundClearance;
      group.userData.uploadedJetwayStaticMaximumStairGroundClearanceMeters = staticFleet.maximumStairGroundClearance;
      group.userData.uploadedJetwayStaticMinimumBogieGroundClearanceMeters = staticFleet.minimumBogieGroundClearance;
      group.userData.uploadedJetwayStaticMaximumBogieGroundClearanceMeters = staticFleet.maximumBogieGroundClearance;
      group.userData.uploadedJetwayStaticPartOrderValid = staticFleet.allPartOrdersValid;
      const a1Articulation = fleet.getObjectByName("UploadedAirportJetway_A1")?.userData.uploadedJetwayArticulation;
      group.userData.uploadedJetwayA1TargetDoorDistanceMeters = a1Articulation?.targetDistance;
      group.userData.uploadedJetwayA1AttachedExtensionMeters = a1Articulation?.extension;
      group.userData.uploadedJetwayA1PredictedDoorGapMeters = a1Articulation?.predictedDoorGap;
      group.userData.uploadedJetwayA1ActualDoorGapMeters = a1Articulation?.actualDoorGap;
      group.userData.uploadedJetwayA1CabHeightErrorMeters = a1Articulation?.cabHeightError;
      group.userData.uploadedJetwayA1CabNormalErrorDegrees = a1Articulation?.cabNormalErrorDegrees;
      group.userData.uploadedJetwayA1StairGroundClearanceMeters = a1Articulation?.stairGroundClearance;
      group.userData.uploadedJetwayA1BogieGroundClearanceMeters = a1Articulation?.bogieGroundClearance;
      group.userData.uploadedJetwayA1AnchorYawDegrees = THREE.MathUtils.radToDeg(a1Articulation?.anchorYaw ?? NaN);
      group.userData.uploadedJetwayA1CabYawOffsetDegrees = THREE.MathUtils.radToDeg(a1Articulation?.cabYawOffset ?? NaN);
      group.userData.uploadedJetwayA1ActualContactPoint = JSON.stringify(a1Articulation?.actualContact || {});
      group.userData.uploadedJetwayA1PartOrderValid = a1Articulation?.partOrderValid === true;
      group.userData.uploadedJetwayA1PartCentersMeters = JSON.stringify(a1Articulation?.partCenters || {});`;
if (!fleet.includes("uploadedJetwayA1CabNormalErrorDegrees")) {
  if (!fleet.includes(telemetryAnchor)) throw new Error(`${fleetPath}: telemetry anchor is missing`);
  fleet = fleet.replace(telemetryAnchor, telemetry);
}

for (const token of [
  "measureUploadedJetwaySourcePose",
  "applyUploadedJetwayFull3DPose",
  "measureUploadedJetwayFull3DPose",
  "buildUploadedJetwayStaticFull3D",
  "findUploadedJetwaySourcePart",
  "uploadedJetwayA1CabNormalErrorDegrees",
  "uploadedJetwayA1CabHeightErrorMeters",
  "uploadedJetwayA1StairGroundClearanceMeters",
  "uploadedJetwayA1BogieGroundClearanceMeters",
  "uploadedJetwayStaticMaximumCabNormalErrorDegrees",
]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: full-3D runtime is missing ${token}`);
}
if (fleet.includes("AIR_Jetway01_(?!WallCollars)")) throw new Error(`${fleetPath}: legacy wall-collar exception remains`);
fs.writeFileSync(fleetPath, fleet, "utf8");

const readyPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let ready = fs.readFileSync(readyPath, "utf8");
const guardImport = 'import { enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js";';
ready = replaceOnce(
  ready,
  guardImport,
  `${guardImport}
import { UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY } from "./uploadedAirportJetwayArticulationV10.js";`,
  "readiness authority import",
);
ready = replaceOnce(
  ready,
  '        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);',
  `        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);
        const articulationAuthority = group.userData.uploadedJetwayArticulationAuthority || "missing";
        const staticArticulatedGateCount = Number(group.userData.uploadedJetwayStaticArticulatedGateCount ?? -1);
        const staticMaximumContactError = Number(group.userData.uploadedJetwayStaticMaximumContactErrorMeters ?? Infinity);
        const staticMaximumCabNormalError = Number(group.userData.uploadedJetwayStaticMaximumCabNormalErrorDegrees ?? Infinity);
        const staticMaximumCabHeightError = Number(group.userData.uploadedJetwayStaticMaximumCabHeightErrorMeters ?? Infinity);
        const staticMinimumStairGround = Number(group.userData.uploadedJetwayStaticMinimumStairGroundClearanceMeters ?? -Infinity);
        const staticMaximumStairGround = Number(group.userData.uploadedJetwayStaticMaximumStairGroundClearanceMeters ?? Infinity);
        const staticMinimumBogieGround = Number(group.userData.uploadedJetwayStaticMinimumBogieGroundClearanceMeters ?? -Infinity);
        const staticMaximumBogieGround = Number(group.userData.uploadedJetwayStaticMaximumBogieGroundClearanceMeters ?? Infinity);
        const staticPartOrderValid = group.userData.uploadedJetwayStaticPartOrderValid === true;
        const a1AttachedExtension = Number(group.userData.uploadedJetwayA1AttachedExtensionMeters ?? NaN);
        const a1PredictedDoorGap = Number(group.userData.uploadedJetwayA1PredictedDoorGapMeters ?? Infinity);
        const a1ActualDoorGap = Number(group.userData.uploadedJetwayA1ActualDoorGapMeters ?? Infinity);
        const a1CabNormalError = Number(group.userData.uploadedJetwayA1CabNormalErrorDegrees ?? Infinity);
        const a1CabHeightError = Number(group.userData.uploadedJetwayA1CabHeightErrorMeters ?? Infinity);
        const a1StairGround = Number(group.userData.uploadedJetwayA1StairGroundClearanceMeters ?? Infinity);
        const a1BogieGround = Number(group.userData.uploadedJetwayA1BogieGroundClearanceMeters ?? Infinity);
        const a1PartOrderValid = group.userData.uploadedJetwayA1PartOrderValid === true;
        const articulationDiagnostic = "authority=" + articulationAuthority
          + "; static=" + staticArticulatedGateCount + "/" + staticMaximumContactError + "/" + staticMaximumCabNormalError + "/" + staticMaximumCabHeightError
          + "; static stair=" + staticMinimumStairGround + ".." + staticMaximumStairGround
          + "; static bogie=" + staticMinimumBogieGround + ".." + staticMaximumBogieGround
          + "; static order=" + staticPartOrderValid
          + "; A1=" + a1AttachedExtension + "/" + a1PredictedDoorGap + "/" + a1ActualDoorGap + "/" + a1CabNormalError + "/" + a1CabHeightError
          + "; A1 ground/order=" + a1StairGround + "/" + a1BogieGround + "/" + a1PartOrderValid`,
  "readiness full-3D measurements",
);
ready = replaceOnce(
  ready,
  "          || individualConnectorGateCount !== 1",
  `          || individualConnectorGateCount !== 1
          || articulationAuthority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY
          || staticArticulatedGateCount !== 57
          || staticMaximumContactError > 0.05
          || staticMaximumCabNormalError > 2
          || staticMaximumCabHeightError > 0.05
          || staticMinimumStairGround < -0.05
          || staticMaximumStairGround > 0.65
          || staticMinimumBogieGround < -0.05
          || staticMaximumBogieGround > 0.65
          || !staticPartOrderValid
          || !(a1AttachedExtension > 5 && a1AttachedExtension < 6)
          || a1PredictedDoorGap > 0.05
          || a1ActualDoorGap > 0.05
          || a1CabNormalError > 2
          || a1CabHeightError > 0.05
          || a1StairGround < -0.05
          || a1StairGround > 0.65
          || a1BogieGround < -0.05
          || a1BogieGround > 0.65
          || !a1PartOrderValid`,
  "readiness full-3D assertions",
);
ready = replaceOnce(
  ready,
  "        ) {\n          reject(new Error(",
  "        ) {\n          console.error(`Uploaded supplied-jetway full-3D readiness failed: ${articulationDiagnostic}`);\n          reject(new Error(",
  "readiness diagnostics",
);
fs.writeFileSync(readyPath, ready, "utf8");
console.log(`Prepared ${AUTHORITY}: full 3D Cab-to-door alignment, grounded supplied stair/bogie and 57 measured static poses.`);
