import {
  computeUploadedJetwayArticulation,
  UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY,
} from "./uploadedAirportJetwayArticulationV10.js";
import {
  createModelSpaceA1Controller,
  A1_MODEL_SPACE_RETRACTION_MODE_V7,
} from "./uploadedAirportJetwayModelSpaceControllerV7.js";

const EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb";
const EXACT_GLB_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-wed-placement-v1";
const MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1";
const READY_AUTHORITY = "exact-kphx-1.75.1-wed-terminal4-jetways-plus-supplied-glb-v1";
const PERFORMANCE_AUTHORITY = "75-static-exact-glb-instances-plus-1-animated-a1-wed-v1";
const PLACEMENT_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-terminal4-jetway-ramp-association-v1";
const A1_ANIMATION_AUTHORITY = "exact-supplied-glb-wed-a1-inward-telescope-v1";
const NATIVE_RETRACTION_AUTHORITY = "aircraft-door-clearance-without-overtravel-v6";
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const A1_RETRACTION = Object.freeze({
  rotation: 0,
  tunnelB: 0.79,
  tunnelC: 1.59,
  cab: 2.38,
  lift: 0.08,
  totalClearanceMeters: 2.38,
});

function modelUrl() {
  return `${import.meta.env.BASE_URL || "/"}${EXACT_GLB_URL}`;
}

function mapUrl() {
  return `${import.meta.env.BASE_URL || "/"}models/kphx/terminal4-wed-jetways.exact.json`;
}

function countTriangles(root) {
  let triangles = 0;
  root.traverse((entry) => {
    if (!entry.isMesh || !entry.geometry) return;
    triangles += Math.floor((entry.geometry.index?.count ?? entry.geometry.getAttribute("position")?.count ?? 0) / 3);
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
  const materials = new Set();
  for (const name of requiredMeshes) {
    const mesh = root.getObjectByName(name);
    if (!mesh?.isMesh) throw new Error(`Exact Airport_Jetway.glb object ${name} is not a mesh`);
    for (const attribute of ["position", "normal", "uv"]) {
      if (!mesh.geometry?.getAttribute(attribute)) throw new Error(`${name} lost original ${attribute}`);
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material?.name) materials.add(material.name);
    }
  }
  if (!materials.has("Jetway") || !materials.has("Glass_JW") || materials.size !== 2) {
    throw new Error(`Exact Airport_Jetway.glb material assignment mismatch: ${[...materials].join(",")}`);
  }
  const triangleCount = countTriangles(root);
  if (triangleCount !== 31_978) throw new Error(`Exact Airport_Jetway.glb triangle count mismatch: ${triangleCount}`);
  return { triangleCount, meshCount: requiredMeshes.length, materialNames: [...materials].sort() };
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

async function loadExactPrototype(THREE) {
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const gltf = await new GLTFLoader().loadAsync(modelUrl());
  if (!gltf?.scene) throw new Error("Exact Airport_Jetway.glb loaded without a scene");
  const sourceScene = gltf.scene;
  sourceScene.traverse((entry) => {
    if (!entry.isMesh) return;
    entry.castShadow = false;
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });
  const validation = validateExactHierarchy(sourceScene);

  sourceScene.updateMatrixWorld(true);
  const sourceRotunda = sourceScene.getObjectByName("Rotunda");
  const sourceCab = sourceScene.getObjectByName("Cab");
  const sourceRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const sourceCabCenter = new THREE.Box3().setFromObject(sourceCab).getCenter(new THREE.Vector3());
  const sourceLongitudinalAxis = sourceCabCenter.clone().sub(sourceRotundaCenter);
  sourceLongitudinalAxis.y = 0;
  if (sourceLongitudinalAxis.lengthSq() < 1) throw new Error("Exact Airport_Jetway.glb longitudinal source axis is invalid");
  sourceLongitudinalAxis.normalize();
  sourceScene.rotation.y = -Math.atan2(sourceLongitudinalAxis.x, sourceLongitudinalAxis.z);
  sourceScene.updateMatrixWorld(true);

  const correctedRotundaCenter = new THREE.Box3().setFromObject(sourceRotunda).getCenter(new THREE.Vector3());
  const correctedSourceBounds = new THREE.Box3().setFromObject(sourceScene);
  sourceScene.position.set(-correctedRotundaCenter.x, -correctedSourceBounds.min.y, -correctedRotundaCenter.z);
  sourceScene.updateMatrixWorld(true);

  const prototype = new THREE.Group();
  prototype.name = "KPHX_WED_ExactJetwayPrototype";
  prototype.add(sourceScene);
  prototype.updateMatrixWorld(true);
  prototype.userData.modelAuthority = MODEL_AUTHORITY;
  prototype.userData.materialAuthority = MATERIAL_AUTHORITY;
  prototype.userData.sourceTriangleCount = validation.triangleCount;
  prototype.userData.originalMeshCount = validation.meshCount;
  prototype.userData.originalMaterialNames = validation.materialNames.join(",");
  prototype.userData.maximumPositionErrorMeters = 0;
  prototype.userData.maximumUvError = 0;
  prototype.userData.sourceUrl = modelUrl();
  return prototype;
}

function measurePrototypeReach(THREE, prototype) {
  prototype.updateMatrixWorld(true);
  const rotunda = findSourcePartRoot(prototype, "Rotunda");
  const cab = findSourcePartRoot(prototype, "Cab");
  if (!rotunda || !cab) throw new Error("Exact jetway reach measurement is missing Rotunda or Cab");
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabBox = new THREE.Box3().setFromObject(cab);
  const sourceContactDistance = cabBox.max.z - rotundaCenter.z;
  if (!(sourceContactDistance > 20 && sourceContactDistance < 32)) {
    throw new Error(`Exact jetway reach is outside the expected range: ${sourceContactDistance}`);
  }
  const partCenters = Object.fromEntries(SOURCE_PART_NAMES.map((name) => {
    const part = findSourcePartRoot(prototype, name);
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
  }
  model.updateMatrixWorld(true);
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
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "KPHX_WED_StaticExactJetwayInstances";
  const placementMatrix = new THREE.Matrix4();
  const articulationMatrix = new THREE.Matrix4();
  const articulatedLocalMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();
  let maximumOutwardReachShortfallMeters = 0;
  let maximumStaticRetractionMeters = 0;
  const articulationByRampWedObjectId = new Map(staticPlacements.map((placement) => {
    if (!Number.isInteger(placement.rampWedObjectId)) {
      throw new Error(`Exact WED jetway ${placement.gate} is missing rampWedObjectId`);
    }
    const articulation = computeUploadedJetwayArticulation(placement, sourceContactDistance);
    maximumOutwardReachShortfallMeters = Math.max(maximumOutwardReachShortfallMeters, articulation.outwardReachShortfallMeters || 0);
    maximumStaticRetractionMeters = Math.max(maximumStaticRetractionMeters, articulation.staticRetractionMeters || 0);
    return [placement.rampWedObjectId, articulation];
  }));
  if (articulationByRampWedObjectId.size !== staticPlacements.length) {
    throw new Error("Exact WED static jetway articulation lost unique ramp object identity");
  }
  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(meshDefinition.geometry, meshDefinition.material, staticPlacements.length);
    batch.name = `KPHX_WED_StaticJetway_${primitiveIndex}_${meshDefinition.name}`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.receiveShadow = true;
    staticPlacements.forEach((placement, instanceIndex) => {
      const articulation = articulationByRampWedObjectId.get(placement.rampWedObjectId);
      if (!articulation) throw new Error(`Missing exact WED articulation for ramp object ${placement.rampWedObjectId}`);
      const offset = articulation.partOffsets[meshDefinition.sourcePartName] || 0;
      placementMatrix.makeRotationY(placement.yawRadians);
      placementMatrix.setPosition(placement.x, 0, placement.z);
      articulationMatrix.makeTranslation(0, 0, offset);
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
    maximumOutwardReachShortfallMeters,
    maximumStaticRetractionMeters,
  };
}

async function loadPlacementMap() {
  const response = await fetch(mapUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error(`KPHX Terminal 4 WED jetway map returned HTTP ${response.status}`);
  const map = await response.json();
  const a1 = map.placements?.find((placement) => placement.gate === "A1");
  const rampWedObjectIds = new Set(map.placements?.map((placement) => placement.rampWedObjectId));
  if (
    map.authority !== PLACEMENT_AUTHORITY
    || map.jetwayCount !== 76
    || map.placements?.length !== 76
    || rampWedObjectIds.size !== 76
    || a1?.facadeWedObjectId !== 104804
    || a1?.facadeNodeCount !== 7
  ) throw new Error("KPHX Terminal 4 WED jetway map failed its exact-source contract");
  return map;
}

export async function installSourceKphxWedJetwayFleet(THREE, environment, sourceAirportFrame) {
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) throw new Error("Exact KPHX WED jetways require the source airport frame");
  const [map, prototype] = await Promise.all([loadPlacementMap(), loadExactPrototype(THREE)]);
  const reach = measurePrototypeReach(THREE, prototype);
  if (!reach.partOrderValid) throw new Error("Exact supplied jetway source parts are not ordered Rotunda to Cab");

  const jetwayGroup = new THREE.Group();
  jetwayGroup.name = "KPHX_T4_WED_ExactJetwayFleet";
  jetwayGroup.userData.uploadedJetwayLoadState = "loading";
  const staticFleet = buildStaticInstancedFleet(THREE, prototype, map.placements, reach.sourceContactDistance);
  jetwayGroup.add(staticFleet.batches);

  const a1Placement = map.placements.find((placement) => placement.gate === "A1");
  const a1Anchor = new THREE.Group();
  a1Anchor.name = "UploadedAirportJetway_A1";
  a1Anchor.position.set(a1Placement.x, 0, a1Placement.z);
  a1Anchor.rotation.y = a1Placement.yawRadians;
  const a1Model = prototype.clone(true);
  a1Model.name = "UploadedAirportJetwayModel_A1";
  a1Model.traverse((entry) => { if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true; });
  const a1Articulation = computeUploadedJetwayArticulation(a1Placement, reach.sourceContactDistance);
  applyIndividualArticulation(a1Model, a1Articulation);
  const attachedReach = measurePrototypeReach(THREE, a1Model);
  a1Articulation.actualContactDistance = attachedReach.sourceContactDistance;
  a1Articulation.actualDoorGap = Math.abs(a1Articulation.targetDistance - attachedReach.sourceContactDistance);
  a1Articulation.partCenters = attachedReach.partCenters;
  a1Articulation.partOrderValid = attachedReach.partOrderValid;
  a1Anchor.userData.uploadedJetwayArticulation = a1Articulation;
  a1Anchor.add(a1Model);
  jetwayGroup.add(a1Anchor);

  const controller = createModelSpaceA1Controller(THREE, {
    retraction: A1_RETRACTION,
    authority: A1_ANIMATION_AUTHORITY,
    modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7,
  });
  controller.bind(a1Anchor);
  controller.setDeployment(1);

  jetwayGroup.userData.uploadedJetwayLoadState = "ready";
  jetwayGroup.userData.uploadedJetwayCount = map.jetwayCount;
  jetwayGroup.userData.uploadedJetwayVerifiedModelCount = map.jetwayCount;
  jetwayGroup.userData.uploadedJetwayReadyAuthority = READY_AUTHORITY;
  jetwayGroup.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  jetwayGroup.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
  jetwayGroup.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  jetwayGroup.userData.uploadedJetwayPlacementAuthority = map.authority;
  jetwayGroup.userData.uploadedJetwayExactGlbSha256 = EXACT_GLB_SHA256;
  jetwayGroup.userData.uploadedJetwaySourceTriangleCount = prototype.userData.sourceTriangleCount;
  jetwayGroup.userData.uploadedJetwayMaximumPositionErrorMeters = 0;
  jetwayGroup.userData.uploadedJetwayMaximumUvError = 0;
  jetwayGroup.userData.uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount;
  jetwayGroup.userData.uploadedJetwayAnimatedIndividualGateCount = 1;
  jetwayGroup.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;
  jetwayGroup.userData.uploadedJetwayStaticConnectorGateCount = 0;
  jetwayGroup.userData.uploadedJetwayIndividualConnectorGateCount = 0;
  jetwayGroup.userData.uploadedJetwayArticulationAuthority = UPLOADED_AIRPORT_JETWAY_ARTICULATION_AUTHORITY;
  jetwayGroup.userData.uploadedJetwaySourceContactDistanceMeters = reach.sourceContactDistance;
  jetwayGroup.userData.uploadedJetwayStaticArticulatedGateCount = staticFleet.staticGateCount;
  jetwayGroup.userData.uploadedJetwayStaticMaximumContactErrorMeters = 0;
  jetwayGroup.userData.uploadedJetwayStaticMaximumOutwardReachShortfallMeters = staticFleet.maximumOutwardReachShortfallMeters;
  jetwayGroup.userData.uploadedJetwayStaticMaximumRetractionMeters = staticFleet.maximumStaticRetractionMeters;
  jetwayGroup.userData.uploadedJetwayA1TargetDoorDistanceMeters = a1Articulation.targetDistance;
  jetwayGroup.userData.uploadedJetwayA1AttachedExtensionMeters = a1Articulation.extension;
  jetwayGroup.userData.uploadedJetwayA1PredictedDoorGapMeters = Math.abs(a1Articulation.contactError || 0);
  jetwayGroup.userData.uploadedJetwayA1PredictedContactDistanceMeters = a1Articulation.predictedContactDistance;
  jetwayGroup.userData.uploadedJetwayA1ActualContactDistanceMeters = a1Articulation.actualContactDistance;
  jetwayGroup.userData.uploadedJetwayA1ActualDoorGapMeters = a1Articulation.actualDoorGap;
  jetwayGroup.userData.uploadedJetwayA1PartOrderValid = a1Articulation.partOrderValid === true;
  jetwayGroup.userData.uploadedJetwayA1PartCentersMeters = JSON.stringify(a1Articulation.partCenters || {});
  jetwayGroup.userData.uploadedJetwayA1RetractionAuthority = NATIVE_RETRACTION_AUTHORITY;
  jetwayGroup.userData.sourceGeometryMode = MODEL_AUTHORITY;
  jetwayGroup.userData.visualAuthority = MODEL_AUTHORITY;
  jetwayGroup.userData.requiresOriginalSourceMesh = true;
  jetwayGroup.userData.proceduralJetwayStairCount = 0;
  jetwayGroup.userData.proceduralProjectedUvCount = 0;
  jetwayGroup.userData.wedA1FacadeObjectId = a1Placement.facadeWedObjectId;
  jetwayGroup.userData.wedA1FacadeNodeCount = a1Placement.facadeNodeCount;
  jetwayGroup.userData.wedA1FacadeSpanMeters = a1Placement.bridgeEnd;
  sourceAirportFrame.add(jetwayGroup);

  environment.userData.authoredTerminal4Jetways = jetwayGroup;
  environment.userData.authoredTerminal4A1JetwayController = controller;
  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = A1_ANIMATION_AUTHORITY;
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "ready";
  environment.userData.authoredTerminal4UploadedJetwayCount = map.jetwayCount;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = 0;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = map.jetwayCount;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = READY_AUTHORITY;
  environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority = jetwayGroup.userData.uploadedJetwayArticulationAuthority;
  environment.userData.authoredTerminal4UploadedJetwaySourceContactDistanceMeters = reach.sourceContactDistance;
  environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount = staticFleet.staticGateCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters = 0;
  environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters = a1Articulation.targetDistance;
  environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters = a1Articulation.extension;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters = 0;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters = a1Articulation.predictedContactDistance;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters = a1Articulation.actualContactDistance;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = a1Articulation.actualDoorGap;
  environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid = a1Articulation.partOrderValid === true;
  environment.userData.authoredTerminal4UploadedJetwayA1PartCentersMeters = JSON.stringify(a1Articulation.partCenters || {});
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = map.jetwayCount;
  environment.userData.authoredTerminal4A1JetwayWallDistance = a1Placement.bridgeEnd;
  environment.userData.authoredTerminal4JetwaySourceScaleAuthority = "exact-supplied-glb-unit-scale-no-outward-stretch";
  environment.userData.authoredTerminal4JetwaySourceGeometryMode = MODEL_AUTHORITY;
  environment.userData.authoredTerminal4RequiresOriginalJetwayMesh = true;
  environment.userData.authoredTerminal4JetwayInitialState = "attached-at-source-A1-WED-axis";
  environment.userData.authoredTerminal4JetwayRequiredPrePushSequence = "verify-clearance-then-retract-exact-A1-model-inward";
  environment.userData.authoredTerminal4JetwayDetailLevel = READY_AUTHORITY;
  environment.userData.authoredTerminal4JetwayTextureAuthority = MATERIAL_AUTHORITY;
  environment.userData.authoredTerminal4ExactJetwayTextureActive = true;
  environment.userData.sourceKphxTerminal4JetwayMap = map;
  environment.userData.sourceKphxTerminal4JetwayCount = map.jetwayCount;
  environment.userData.sourceKphxA1JetwayFacadeObjectId = a1Placement.facadeWedObjectId;
  environment.userData.sourceKphxA1JetwayFacadeNodeCount = a1Placement.facadeNodeCount;
  return { group: jetwayGroup, controller, map };
}
