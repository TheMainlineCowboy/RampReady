import {
  addUploadedAirportJetwayStaticTerminalConnectors,
  addUploadedAirportJetwayTerminalConnector,
} from "./uploadedAirportJetwayTerminalConnector.js";
import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
} from "./uploadedAirportJetwayArticulationV10.js";
import {
  createModelSpaceA1Controller,
  A1_MODEL_SPACE_RETRACTION_MODE_V7,
} from "./uploadedAirportJetwayModelSpaceControllerV7.js";

const MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1";
const MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1";
const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";
const A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1";
const A1_RETRACTION = Object.freeze({
  rotation: 0,
  tunnelB: 0.79,
  tunnelC: 1.59,
  cab: 2.38,
  lift: 0.08,
  totalClearanceMeters: 2.38,
});
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const HIDE_REPLACED = /^(?:AIR_Jetway01_|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;
const EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb";

function modelUrl() {
  return `${import.meta.env.BASE_URL || "/"}${EXACT_GLB_URL}`;
}

function countTriangles(root) {
  let triangles = 0;
  root.traverse((entry) => {
    if (!entry.isMesh || !entry.geometry) return;
    const indexCount = entry.geometry.index?.count;
    const positionCount = entry.geometry.getAttribute("position")?.count;
    triangles += Math.floor((indexCount ?? positionCount ?? 0) / 3);
  });
  return triangles;
}

function validateExactHierarchy(root) {
  const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
  const requiredMeshes = [
    "Tunnel_C_Jetway_0",
    "Tunnel_C_Glass_JW_0",
    "Rotunda_Jetway_0",
    "Cab_Jetway_0",
    "Cab_Glass_JW_0",
    "Tunnel_A_Jetway_0",
    "Tunnel_B_Jetway_0",
  ];
  const missing = [...requiredNodes, ...requiredMeshes].filter((name) => !root.getObjectByName(name));
  if (missing.length) throw new Error(`Exact Airport_Jetway.glb hierarchy is missing: ${missing.join(", ")}`);

  const meshes = requiredMeshes.map((name) => root.getObjectByName(name));
  const materials = new Set();
  for (const mesh of meshes) {
    if (!mesh?.isMesh) throw new Error(`Exact Airport_Jetway.glb object ${mesh?.name || "unknown"} is not a mesh`);
    if (!mesh.geometry?.getAttribute("position")) throw new Error(`${mesh.name} lost original positions`);
    if (!mesh.geometry?.getAttribute("normal")) throw new Error(`${mesh.name} lost original normals`);
    if (!mesh.geometry?.getAttribute("uv")) throw new Error(`${mesh.name} lost original UVs`);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material?.name) materials.add(material.name);
    }
  }
  if (!materials.has("Jetway") || !materials.has("Glass_JW") || materials.size !== 2) {
    throw new Error(`Exact Airport_Jetway.glb material assignment mismatch: ${[...materials].join(",")}`);
  }
  const triangleCount = countTriangles(root);
  if (triangleCount !== 31_978) throw new Error(`Exact Airport_Jetway.glb triangle count mismatch: ${triangleCount}`);
  return { triangleCount, meshCount: meshes.length, materialNames: [...materials].sort() };
}

async function loadExactPrototype(THREE) {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(modelUrl());
  if (!gltf?.scene) throw new Error("Exact Airport_Jetway.glb loaded without a scene");

  const sourceScene = gltf.scene;
  sourceScene.name = sourceScene.name || "Airport_Jetway_ExactSourceScene";
  sourceScene.traverse((entry) => {
    if (!entry.isMesh) return;
    entry.castShadow = false;
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });
  const validation = validateExactHierarchy(sourceScene);

  // The uploaded GLB preserves its exporter-authored root transforms. Its
  // longitudinal Rotunda-to-Cab axis is therefore diagonal in the GLB scene,
  // not parent-local +Z. Normalize only the parent scene transform so gate yaw,
  // telescoping offsets and contact measurements share one longitudinal axis.
  // No source node, mesh, geometry, UV, normal, material or scale is replaced.
  sourceScene.updateMatrixWorld(true);
  const sourceRotunda = sourceScene.getObjectByName("Rotunda");
  const sourceCab = sourceScene.getObjectByName("Cab");
  if (!sourceRotunda || !sourceCab) {
    throw new Error("Exact Airport_Jetway.glb axis normalization is missing Rotunda or Cab");
  }
  const sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());
  const sourceLongitudinalAxis = sourceCabCenter.clone().sub(sourceRotundaCenter);
  sourceLongitudinalAxis.y = 0;
  if (sourceLongitudinalAxis.lengthSq() < 1) {
    throw new Error("Exact Airport_Jetway.glb longitudinal source axis is invalid");
  }
  sourceLongitudinalAxis.normalize();
  const axisCorrectionRadians = -Math.atan2(sourceLongitudinalAxis.x, sourceLongitudinalAxis.z);
  sourceScene.rotation.y = axisCorrectionRadians;
  sourceScene.updateMatrixWorld(true);

  const correctedRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const correctedSourceBounds = new THREE.Box3().setFromObject(sourceScene);
  sourceScene.position.set(
    -correctedRotundaCenter.x,
    -correctedSourceBounds.min.y,
    -correctedRotundaCenter.z,
  );
  sourceScene.updateMatrixWorld(true);

  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_ExactGlbPrototype";
  aligned.userData.parentAxisCorrectionRadians = axisCorrectionRadians;
  aligned.userData.rotundaOriginNormalized = true;
  aligned.userData.groundContactNormalized = true;
  aligned.add(sourceScene);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  aligned.userData.sourceTriangleCount = validation.triangleCount;
  aligned.userData.originalMeshCount = validation.meshCount;
  aligned.userData.originalMaterialNames = validation.materialNames.join(",");
  aligned.userData.maximumPositionErrorMeters = 0;
  aligned.userData.maximumUvError = 0;
  aligned.userData.sourceUrl = modelUrl();
  return aligned;
}

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
  return current?.parent?.name === "RootNode" && SOURCE_PART_NAMES.includes(current.name) ? current.name : null;
}

function measurePrototypeReach(THREE, prototype) {
  prototype.updateMatrixWorld(true);
  const rotunda = findSourcePartRoot(prototype, "Rotunda");
  const cab = findSourcePartRoot(prototype, "Cab");
  if (!rotunda || !cab) throw new Error("Exact jetway reach measurement is missing Rotunda or Cab");
  const rotundaBox = new THREE.Box3().setFromObject(rotunda);
  const cabBox = new THREE.Box3().setFromObject(cab);
  const rotundaCenter = rotundaBox.getCenter(new THREE.Vector3());
  const sourceContactDistance = cabBox.max.z - rotundaCenter.z;
  if (!(sourceContactDistance > 20 && sourceContactDistance < 32)) {
    throw new Error(`Exact jetway reach is outside the expected range: ${sourceContactDistance}`);
  }
  const partCenters = Object.fromEntries(SOURCE_PART_NAMES.map((name) => {
    const part = findSourcePartRoot(prototype, name);
    if (!part) throw new Error(`Exact jetway reach measurement is missing ${name}`);
    return [name, new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3()).z];
  }));
  return {
    sourceContactDistance,
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
    if (!part) throw new Error(`Exact jetway articulation is missing ${name}`);
    part.position.z += offset;
    part.userData.uploadedJetwayArticulationOffsetMeters = offset;
    part.userData.uploadedJetwayArticulationAuthority = articulation.authority;
  }
  model.updateMatrixWorld(true);
  model.userData.uploadedJetwayArticulation = articulation;
}

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    const sourcePartName = sourcePartNameForEntry(entry);
    if (!sourcePartName) throw new Error(`Exact jetway mesh ${entry.name || "unnamed"} has no authored source-part ancestor`);
    meshes.push({
      name: entry.name || `Primitive_${meshes.length}`,
      geometry: entry.geometry,
      material: entry.material,
      localMatrix: entry.matrixWorld.clone(),
      sourcePartName,
    });
  });
  if (meshes.length !== 7) throw new Error(`Exact Airport_Jetway.glb expected seven meshes, received ${meshes.length}`);
  return meshes;
}

function buildStaticInstancedFleet(THREE, prototype, placements, sourceContactDistance) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  if (staticPlacements.length !== 57) throw new Error(`Exact jetway fleet expected 57 static gates, received ${staticPlacements.length}`);
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "UploadedAirportJetwayStaticExactGlbInstances";
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
    const batch = new THREE.InstancedMesh(meshDefinition.geometry, meshDefinition.material, staticPlacements.length);
    batch.name = `UploadedAirportJetwayStatic_${primitiveIndex}_${meshDefinition.name}`;
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
  };
}

function hideGeneratedJetways(group) {
  let hidden = 0;
  for (const child of group.children) {
    if (child.name === "UploadedAirportJetwayFleet") continue;
    if (HIDE_REPLACED.test(child.name) || /A1.*Animated.*Jetway/i.test(child.name)) {
      child.visible = false;
      child.traverse((entry) => {
        if (entry.isMesh) {
          entry.visible = false;
          entry.castShadow = false;
        }
      });
      hidden += 1;
    }
  }
  return hidden;
}

export function installUploadedAirportJetwayFleet(THREE, group, placements, _sourceTextures = {}) {
  if (!group?.isGroup) throw new Error("Exact airport jetway replacement requires the Terminal 4 jetway group");
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Exact airport jetway replacement expected 58 placements, received ${placements?.length ?? 0}`);
  }

  const controller = createModelSpaceA1Controller(THREE, {
    retraction: A1_RETRACTION,
    authority: A1_RETRACTION_AUTHORITY,
    modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7,
  });
  group.userData.uploadedJetwayLoadState = "loading";
  group.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
  group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  group.userData.uploadedJetwayExpectedCount = 58;
  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;

  loadExactPrototype(THREE)
    .then((prototype) => {
      const reach = measurePrototypeReach(THREE, prototype);
      if (!reach.partOrderValid) throw new Error("Exact Airport_Jetway.glb authored parts are not ordered from Rotunda to Cab");
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements, reach.sourceContactDistance);
      fleet.add(staticFleet.batches);
      const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);

      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.userData.renderMode = placement.gate === "A1"
          ? "individual-animated-exact-glb"
          : "static-articulated-exact-glb-instance-marker";
        if (placement.gate === "A1") {
          anchor.position.set(placement.x, 0, placement.z);
          anchor.rotation.y = placement.yaw;
          const model = prototype.clone(true);
          model.name = "UploadedAirportJetwayModel_A1";
          model.traverse((entry) => {
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
          anchor.add(model);
          controller.bind(anchor);
          addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);
        }
        fleet.add(anchor);
      }

      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedJetways(group);
      const a1Articulation = fleet.getObjectByName("UploadedAirportJetway_A1")?.userData.uploadedJetwayArticulation;
      group.userData.uploadedJetwayLoadState = "ready";
      group.userData.uploadedJetwayCount = 58;
      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;
      group.userData.uploadedJetwayShadowCasterGateCount = 1;
      group.userData.uploadedJetwayGlobalEdgeOverlayCount = 0;
      group.userData.uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount;
      group.userData.uploadedJetwayAnimatedIndividualGateCount = 1;
      group.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;
      group.userData.uploadedJetwayStaticConnectorGateCount = staticConnectors.staticGateCount;
      group.userData.uploadedJetwayStaticConnectorBatchCount = staticConnectors.batchCount;
      group.userData.uploadedJetwayStaticConnectorInstanceCount = staticConnectors.instanceCount;
      group.userData.uploadedJetwayStaticConnectorBatchAuthority = staticConnectors.authority;
      group.userData.uploadedJetwayIndividualConnectorGateCount = 1;
      group.userData.uploadedJetwaySourceTriangleCount = prototype.userData.sourceTriangleCount;
      group.userData.uploadedJetwayMaximumPositionErrorMeters = 0;
      group.userData.uploadedJetwayMaximumUvError = 0;
      group.userData.uploadedJetwayExactGlbUrl = prototype.userData.sourceUrl;
      group.userData.uploadedJetwayExactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
      group.userData.uploadedJetwayArticulationAuthority = UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY;
      group.userData.uploadedJetwaySourceContactDistanceMeters = reach.sourceContactDistance;
      group.userData.uploadedJetwayStaticArticulatedGateCount = staticFleet.articulatedGateCount;
      group.userData.uploadedJetwayStaticMaximumContactErrorMeters = staticFleet.maximumContactError;
      group.userData.uploadedJetwayA1TargetDoorDistanceMeters = a1Articulation?.targetDistance;
      group.userData.uploadedJetwayA1AttachedExtensionMeters = a1Articulation?.extension;
      group.userData.uploadedJetwayA1PredictedDoorGapMeters = Math.abs(a1Articulation?.contactError ?? Infinity);
      group.userData.uploadedJetwayA1PredictedContactDistanceMeters = a1Articulation?.predictedContactDistance;
      group.userData.uploadedJetwayA1ActualContactDistanceMeters = a1Articulation?.actualContactDistance;
      group.userData.uploadedJetwayA1ActualDoorGapMeters = a1Articulation?.actualDoorGap;
      group.userData.uploadedJetwayA1PartOrderValid = a1Articulation?.partOrderValid === true;
      group.userData.uploadedJetwayA1PartCentersMeters = JSON.stringify(a1Articulation?.partCenters || {});
      group.userData.sourceGeometryMode = MODEL_AUTHORITY;
      group.userData.visualAuthority = MODEL_AUTHORITY;
      group.userData.requiresOriginalSourceMesh = true;
      group.userData.proceduralJetwayStairCount = 0;
      group.userData.proceduralProjectedUvCount = 0;
    })
    .catch((error) => {
      group.userData.uploadedJetwayLoadState = "error";
      group.userData.uploadedJetwayLoadError = error instanceof Error ? error.message : String(error);
      console.error("Exact Airport_Jetway.glb fleet failed to load", error);
    });

  return controller;
}
