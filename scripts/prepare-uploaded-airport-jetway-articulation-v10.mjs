import fs from "node:fs";

const AUTHORITY = "user-supplied-airport-jetway-per-gate-telescoping-v10";

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) return source;
  if (!source.includes(oldText)) throw new Error(`Supplied jetway articulation patch is missing ${label}`);
  return source.replace(oldText, newText);
}

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
let fleet = fs.readFileSync(fleetPath, "utf8");
const connectorImport = `} from "./uploadedAirportJetwayTerminalConnector.js";`;
const articulationImport = `${connectorImport}
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
} from "./uploadedAirportJetwayArticulationV10.js";`;
fleet = replaceOnce(fleet, connectorImport, articulationImport, "articulation import anchor");
fleet = fleet.replace(
  "const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;",
  "const HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;",
);

const meshStart = fleet.indexOf("function collectPrototypeMeshes(prototype) {");
const controllerStart = fleet.indexOf("function createController() {");
if (!fleet.includes("function measurePrototypeReach(") && (meshStart < 0 || controllerStart <= meshStart)) {
  throw new Error("Supplied jetway articulation patch cannot locate the static fleet section");
}
if (!fleet.includes("function measurePrototypeReach(")) {
  const replacement = `const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);

function findSourceRootNode(model) {
  return model?.getObjectByName?.("RootNode") || null;
}

function findSourcePartRoot(model, name) {
  const root = findSourceRootNode(model);
  return root?.children?.find((entry) => entry.name === name) || null;
}

function sourcePartNameForEntry(entry) {
  let current = entry;
  while (current?.parent && current.parent.name !== "RootNode") current = current.parent;
  return current?.parent?.name === "RootNode" && SOURCE_PART_NAMES.includes(current.name)
    ? current.name
    : null;
}

function measurePrototypeReach(THREE, prototype) {
  prototype.updateMatrixWorld(true);
  const rotunda = findSourcePartRoot(prototype, "Rotunda");
  const cab = findSourcePartRoot(prototype, "Cab");
  if (!rotunda || !cab) throw new Error("Supplied jetway reach measurement is missing Rotunda or Cab");
  const rotundaBox = new THREE.Box3().setFromObject(rotunda);
  const cabBox = new THREE.Box3().setFromObject(cab);
  const rotundaCenter = rotundaBox.getCenter(new THREE.Vector3());
  const sourceContactDistance = cabBox.max.z - rotundaCenter.z;
  if (!(sourceContactDistance > 10 && sourceContactDistance < 40)) {
    throw new Error(\`Supplied jetway reach is outside the expected range: \${sourceContactDistance}\`);
  }
  const partCenters = Object.fromEntries(SOURCE_PART_NAMES.map((name) => {
    const part = findSourcePartRoot(prototype, name);
    if (!part) throw new Error(\`Supplied jetway reach measurement is missing \${name}\`);
    const center = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    return [name, center.z];
  }));
  return {
    sourceContactDistance,
    rotundaCenterZ: rotundaCenter.z,
    cabContactZ: cabBox.max.z,
    partCenters,
    partOrderValid: partCenters.Rotunda < partCenters.Tunnel_A
      && partCenters.Tunnel_A < partCenters.Tunnel_B
      && partCenters.Tunnel_B < partCenters.Tunnel_C
      && partCenters.Tunnel_C < partCenters.Cab,
  };
}

function applyIndividualArticulation(model, articulation) {
  for (const [name, offset] of Object.entries(articulation.partOffsets)) {
    const part = findSourcePartRoot(model, name);
    if (!part) throw new Error(\`Supplied jetway articulation is missing \${name}\`);
    part.position.z += offset;
    part.userData.uploadedJetwayArticulationOffsetMeters = offset;
    part.userData.uploadedJetwayArticulationAuthority = articulation.authority;
  }
  model.updateMatrixWorld(true);
  model.userData.uploadedJetwayArticulation = articulation;
}

function collectPrototypeMeshes(prototype) {
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    const sourcePartName = sourcePartNameForEntry(entry);
    if (!sourcePartName) throw new Error(\`Supplied jetway mesh \${entry.name || "unnamed"} has no authored source-part ancestor\`);
    meshes.push({
      name: entry.name || \`Primitive_\${meshes.length}\`,
      geometry: entry.geometry,
      material: entry.material,
      localMatrix: entry.matrixWorld.clone(),
      sourcePartName,
    });
  });
  return meshes;
}

function buildStaticInstancedFleet(THREE, prototype, placements, sourceContactDistance) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "UploadedAirportJetwayStaticInstancedBatches";
  const placementMatrix = new THREE.Matrix4();
  const articulationMatrix = new THREE.Matrix4();
  const articulatedLocalMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();
  let maximumContactError = 0;
  const articulationByGate = new Map(staticPlacements.map((placement) => {
    const articulation = computeUploadedJetwayArticulation(placement, sourceContactDistance);
    maximumContactError = Math.max(maximumContactError, Math.abs(articulation.contactError));
    return [placement.gate, articulation];
  }));

  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(
      meshDefinition.geometry,
      meshDefinition.material,
      staticPlacements.length,
    );
    batch.name = \`UploadedAirportJetwayStatic_\${primitiveIndex}_\${meshDefinition.name}\`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.castShadow = false;
    batch.receiveShadow = true;
    staticPlacements.forEach((placement, instanceIndex) => {
      const articulation = articulationByGate.get(placement.gate);
      const partOffset = articulation.partOffsets[meshDefinition.sourcePartName] || 0;
      placementMatrix.makeRotationY(placement.yaw);
      placementMatrix.setPosition(placement.x, 0, placement.z);
      articulationMatrix.makeTranslation(0, 0, partOffset);
      articulatedLocalMatrix.multiplyMatrices(articulationMatrix, meshDefinition.localMatrix);
      finalMatrix.multiplyMatrices(placementMatrix, articulatedLocalMatrix);
      batch.setMatrixAt(instanceIndex, finalMatrix);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    batches.add(batch);
  });

  return {
    batches,
    staticGateCount: staticPlacements.length,
    primitiveBatchCount: prototypeMeshes.length,
    articulatedGateCount: staticPlacements.length,
    maximumContactError,
    articulationAuthority: UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
  };
}

`;
  fleet = `${fleet.slice(0, meshStart)}${replacement}${fleet.slice(controllerStart)}`;
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
        tunnelB: findSourcePartRoot(model, "Tunnel_B"),
        tunnelC: findSourcePartRoot(model, "Tunnel_C"),
        cab: findSourcePartRoot(model, "Cab"),
      };`,
  "A1 controller source-part binding",
);
fleet = replaceOnce(
  fleet,
  `      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const fleet = new THREE.Group();`,
  `      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const reach = measurePrototypeReach(THREE, prototype);
      const fleet = new THREE.Group();`,
  "source reach measurement",
);
fleet = replaceOnce(
  fleet,
  "      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);",
  "      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements, reach.sourceContactDistance);",
  "per-gate static articulation",
);
fleet = replaceOnce(
  fleet,
  `          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          anchor.add(model);`,
  `          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          const articulation = computeUploadedJetwayArticulation(placement, reach.sourceContactDistance);
          applyIndividualArticulation(model, articulation);
          const attachedReach = measurePrototypeReach(THREE, model);
          articulation.actualContactDistance = attachedReach.sourceContactDistance;
          articulation.actualDoorGap = Math.abs(articulation.targetDistance - attachedReach.sourceContactDistance);
          articulation.partCenters = attachedReach.partCenters;
          articulation.partOrderValid = attachedReach.partOrderValid;
          anchor.userData.uploadedJetwayArticulation = articulation;
          anchor.add(model);`,
  "A1 measured articulation",
);
fleet = replaceOnce(
  fleet,
  "      group.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;",
  `      group.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;
      group.userData.uploadedJetwayArticulationAuthority = UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY;
      group.userData.uploadedJetwaySourceContactDistanceMeters = reach.sourceContactDistance;
      group.userData.uploadedJetwayStaticArticulatedGateCount = staticFleet.articulatedGateCount;
      group.userData.uploadedJetwayStaticMaximumContactErrorMeters = staticFleet.maximumContactError;
      const a1Articulation = fleet.getObjectByName("UploadedAirportJetway_A1")?.userData.uploadedJetwayArticulation;
      group.userData.uploadedJetwayA1TargetDoorDistanceMeters = a1Articulation?.targetDistance;
      group.userData.uploadedJetwayA1AttachedExtensionMeters = a1Articulation?.extension;
      group.userData.uploadedJetwayA1PredictedDoorGapMeters = Math.abs(a1Articulation?.contactError ?? Infinity);
      group.userData.uploadedJetwayA1PredictedContactDistanceMeters = a1Articulation?.predictedContactDistance;
      group.userData.uploadedJetwayA1ActualContactDistanceMeters = a1Articulation?.actualContactDistance;
      group.userData.uploadedJetwayA1ActualDoorGapMeters = a1Articulation?.actualDoorGap;
      group.userData.uploadedJetwayA1PartOrderValid = a1Articulation?.partOrderValid === true;
      group.userData.uploadedJetwayA1PartCentersMeters = JSON.stringify(a1Articulation?.partCenters || {});`,
  "articulation telemetry",
);

for (const token of [
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "measurePrototypeReach",
  "applyIndividualArticulation",
  "articulationMatrix.makeTranslation(0, 0, partOffset)",
  "uploadedJetwayA1ActualDoorGapMeters",
  "uploadedJetwayStaticArticulatedGateCount",
]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: supplied jetway articulation is missing ${token}`);
}
if (fleet.includes("AIR_Jetway01_(?!WallCollars)")) {
  throw new Error(`${fleetPath}: legacy wall-collar geometry remains exempt from replacement`);
}
fs.writeFileSync(fleetPath, fleet, "utf8");

const readyPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let ready = fs.readFileSync(readyPath, "utf8");
const guardImport = 'import { enforceExactUploadedJetwayVisualAuthority } from "./uploadedAirportJetwayExactModelGuard.js";';
ready = replaceOnce(
  ready,
  guardImport,
  `${guardImport}
import { UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY } from "./uploadedAirportJetwayArticulationV10.js";`,
  "readiness articulation import",
);
ready = replaceOnce(
  ready,
  '        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);',
  `        const individualConnectorGateCount = Number(group.userData.uploadedJetwayIndividualConnectorGateCount ?? -1);
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
        const articulationDiagnostic = "authority=" + articulationAuthority
          + "; source=" + sourceContactDistance
          + "; static=" + staticArticulatedGateCount + "/" + staticMaximumContactError
          + "; A1 target=" + a1TargetDoorDistance
          + "; extension=" + a1AttachedExtension
          + "; predicted=" + a1PredictedContactDistance + "/" + a1PredictedDoorGap
          + "; actual=" + a1ActualContactDistance + "/" + a1ActualDoorGap
          + "; order=" + a1PartOrderValid`,
  "readiness articulation measurements",
);
ready = replaceOnce(
  ready,
  "          || individualConnectorGateCount !== 1",
  `          || individualConnectorGateCount !== 1
          || articulationAuthority !== UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY
          || !(sourceContactDistance > 20 && sourceContactDistance < 32)
          || staticArticulatedGateCount !== 57
          || staticMaximumContactError > 0.05
          || !(a1TargetDoorDistance > sourceContactDistance)
          || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)
          || a1PredictedDoorGap > 0.05
          || Math.abs(a1PredictedContactDistance - a1TargetDoorDistance) > 0.05
          || Math.abs(a1ActualContactDistance - a1TargetDoorDistance) > 0.05
          || a1ActualDoorGap > 0.05
          || !a1PartOrderValid`,
  "readiness articulation assertions",
);
ready = replaceOnce(
  ready,
  "        ) {\n          reject(new Error(",
  "        ) {\n          console.error(`Uploaded supplied-jetway articulation readiness failed: ${articulationDiagnostic}`);\n          reject(new Error(",
  "readiness articulation diagnostics",
);
for (const token of [
  "UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY",
  "staticArticulatedGateCount !== 57",
  "a1PredictedDoorGap > 0.05",
  "a1ActualDoorGap > 0.05",
  "!a1PartOrderValid",
  "articulationDiagnostic",
  "Uploaded supplied-jetway articulation readiness failed",
]) {
  if (!ready.includes(token)) throw new Error(`${readyPath}: articulation readiness is missing ${token}`);
}
fs.writeFileSync(readyPath, ready, "utf8");

console.log("Prepared the exact supplied jetway articulation: per-gate static telescoping and measured A1 Tunnel B/Tunnel C/Cab extension to the aircraft door with actual geometry-order and door-gap checks.");
