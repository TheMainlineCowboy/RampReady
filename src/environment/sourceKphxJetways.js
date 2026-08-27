import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  createModelSpaceA1Controller,
  A1_MODEL_SPACE_RETRACTION_MODE_V7,
} from "./uploadedAirportJetwayModelSpaceControllerV7.js";

const EARTH_RADIUS_METERS = 6378137;
const A1_ORIGIN = Object.freeze({ latitude: 33.436530675, longitude: -111.998921221 });
const A1_FACADE_OBJECT_ID = 104804;
const EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb";
const WED_JETWAY_URL = "models/kphx/wed-jetways.exact.json";
const EXACT_GLB_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const PART_WEIGHTS = Object.freeze({ Rotunda: 0, Tunnel_A: 0, Tunnel_B: 1 / 3, Tunnel_C: 2 / 3, Cab: 1 });
const RETRACTION = Object.freeze({ rotation: 0, tunnelB: 0.79, tunnelC: 1.59, cab: 2.38, lift: 0.08, totalClearanceMeters: 2.38 });
const RETRACTION_AUTHORITY = "exact-kphx-wed-a1-supplied-glb-inward-retraction-v1";
const PLACEMENT_AUTHORITY = "KPHX-1.75.1-WED-facade-Wall3or5-to-Wall4-movable-path-v1";
const ARTICULATION_AUTHORITY = "exact-uploaded-airport-jetway-WED-path-inward-telescope-v1";

function sourceLocalFromWED(latitude, longitude) {
  const latitude0 = A1_ORIGIN.latitude * Math.PI / 180;
  const east = (longitude - A1_ORIGIN.longitude) * Math.PI / 180
    * EARTH_RADIUS_METERS * Math.cos(latitude0);
  const north = (latitude - A1_ORIGIN.latitude) * Math.PI / 180 * EARTH_RADIUS_METERS;
  return { x: east, z: -north };
}

function modelUrl() {
  return `${import.meta.env.BASE_URL || "/"}${EXACT_GLB_URL}`;
}

function manifestUrl() {
  return `${import.meta.env.BASE_URL || "/"}${WED_JETWAY_URL}`;
}

function countTriangles(root) {
  let triangles = 0;
  root.traverse((entry) => {
    if (!entry.isMesh || !entry.geometry) return;
    const count = entry.geometry.index?.count ?? entry.geometry.getAttribute("position")?.count ?? 0;
    triangles += Math.floor(count / 3);
  });
  return triangles;
}

function findSourcePartRoot(model, name) {
  const root = model?.getObjectByName?.("RootNode");
  return root?.children?.find((entry) => entry.name === name) || null;
}

function sourcePartNameForEntry(entry) {
  let current = entry;
  while (current?.parent && current.parent.name !== "RootNode") current = current.parent;
  return current?.parent?.name === "RootNode" && SOURCE_PART_NAMES.includes(current.name) ? current.name : null;
}

function validateHierarchy(root) {
  const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
  const requiredMeshes = [
    "Tunnel_C_Jetway_0", "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0", "Cab_Jetway_0",
    "Cab_Glass_JW_0", "Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0",
  ];
  const missing = [...requiredNodes, ...requiredMeshes].filter((name) => !root.getObjectByName(name));
  if (missing.length) throw new Error(`Exact Airport_Jetway.glb hierarchy is missing: ${missing.join(", ")}`);
  const triangles = countTriangles(root);
  if (triangles !== 31_978) throw new Error(`Exact Airport_Jetway.glb triangle count mismatch: ${triangles}`);
}

async function loadPrototype(THREE) {
  const { scene } = await new GLTFLoader().loadAsync(modelUrl());
  if (!scene) throw new Error("Exact Airport_Jetway.glb loaded without a scene");
  validateHierarchy(scene);
  scene.updateMatrixWorld(true);
  const rotunda = scene.getObjectByName("Rotunda");
  const cab = scene.getObjectByName("Cab");
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabCenter = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const axis = cabCenter.clone().sub(rotundaCenter);
  axis.y = 0;
  if (axis.lengthSq() < 1) throw new Error("Exact Airport_Jetway.glb longitudinal source axis is invalid");
  axis.normalize();
  scene.rotation.y = -Math.atan2(axis.x, axis.z);
  scene.updateMatrixWorld(true);
  const correctedRotunda = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const bounds = new THREE.Box3().setFromObject(scene);
  scene.position.set(-correctedRotunda.x, -bounds.min.y, -correctedRotunda.z);
  scene.updateMatrixWorld(true);
  const prototype = new THREE.Group();
  prototype.name = "KPHX_ExactAirportJetway_Prototype";
  prototype.add(scene);
  prototype.updateMatrixWorld(true);
  const normalizedRotunda = new THREE.Box3().setFromObject(findSourcePartRoot(prototype, "Rotunda")).getCenter(new THREE.Vector3());
  const normalizedCab = new THREE.Box3().setFromObject(findSourcePartRoot(prototype, "Cab"));
  const sourceReach = normalizedCab.max.z - normalizedRotunda.z;
  if (!(sourceReach > 20 && sourceReach < 32)) throw new Error(`Exact jetway source reach is invalid: ${sourceReach}`);
  prototype.userData.sourceReachMeters = sourceReach;
  return prototype;
}

async function loadManifest() {
  const response = await fetch(manifestUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error(`Exact WED jetway manifest returned HTTP ${response.status}`);
  const manifest = await response.json();
  if (manifest?.authority !== "KPHX-1.75.1-earth.wed.xml" || manifest?.jetwayFacadeCount !== 108) {
    throw new Error("Exact WED jetway manifest failed its source contract");
  }
  return manifest;
}

function wallType(node) {
  return String(node?.wallType || node?.facadeNode?.wallType || "");
}

function deriveMovablePlacement(record) {
  const nodes = record?.rings?.[0]?.nodes || [];
  if (nodes.length < 3) throw new Error(`WED jetway ${record?.wedObjectId} has too few source nodes`);
  let startIndex = nodes.findIndex((node) => /Wall\s*(?:3|5)$/i.test(wallType(node)));
  if (startIndex < 0) startIndex = Math.max(0, nodes.length - 3);
  let wall4Index = nodes.findIndex((node, index) => index >= startIndex && /Wall\s*4$/i.test(wallType(node)));
  if (wall4Index < 0) wall4Index = Math.max(startIndex, nodes.length - 2);
  const endIndex = Math.min(nodes.length - 1, wall4Index + 1);
  const startNode = nodes[startIndex];
  const endNode = nodes[endIndex];
  const start = sourceLocalFromWED(Number(startNode.latitude), Number(startNode.longitude));
  const end = sourceLocalFromWED(Number(endNode.latitude), Number(endNode.longitude));
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const targetDistance = Math.hypot(dx, dz);
  if (!(targetDistance > 2)) throw new Error(`WED jetway ${record.wedObjectId} movable path is degenerate`);
  return {
    wedObjectId: Number(record.wedObjectId),
    gate: Number(record.wedObjectId) === A1_FACADE_OBJECT_ID ? "A1" : `WED-${record.wedObjectId}`,
    x: start.x,
    z: start.z,
    yaw: Math.atan2(dx, dz),
    targetDistance,
    startNodeId: Number(startNode.wedObjectId),
    endNodeId: Number(endNode.wedObjectId),
    startWallType: wallType(startNode),
    endWallType: wallType(nodes[wall4Index]),
    sourceNodeCount: nodes.length,
  };
}

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    const sourcePartName = sourcePartNameForEntry(entry);
    if (!sourcePartName) throw new Error(`Exact jetway mesh ${entry.name || "unnamed"} has no authored source-part ancestor`);
    meshes.push({ name: entry.name || `Primitive_${meshes.length}`, geometry: entry.geometry, material: entry.material, localMatrix: entry.matrixWorld.clone(), sourcePartName });
  });
  if (meshes.length !== 7) throw new Error(`Exact Airport_Jetway.glb expected seven meshes, received ${meshes.length}`);
  return meshes;
}

function articulationForTarget(targetDistance, sourceReach) {
  const extension = Math.max(-14.5, Math.min(0, targetDistance - sourceReach));
  return {
    extension,
    predictedReach: sourceReach + extension,
    outwardShortfall: Math.max(0, targetDistance - sourceReach),
    partOffsets: Object.fromEntries(Object.entries(PART_WEIGHTS).map(([name, weight]) => [name, extension * weight])),
  };
}

function applyIndividualArticulation(model, articulation) {
  for (const [name, offset] of Object.entries(articulation.partOffsets)) {
    const part = findSourcePartRoot(model, name);
    if (!part) throw new Error(`Exact jetway articulation is missing ${name}`);
    part.position.z += offset;
  }
  model.updateMatrixWorld(true);
}

function buildStaticFleet(THREE, prototype, placements, sourceReach) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const definitions = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "KPHX_WED_ExactJetway_StaticInstances";
  const placementMatrix = new THREE.Matrix4();
  const articulationMatrix = new THREE.Matrix4();
  const articulatedLocalMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();
  let maximumOutwardShortfall = 0;
  definitions.forEach((definition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(definition.geometry, definition.material, staticPlacements.length);
    batch.name = `KPHX_WED_ExactJetway_${primitiveIndex}_${definition.name}`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    staticPlacements.forEach((placement, instanceIndex) => {
      const articulation = articulationForTarget(placement.targetDistance, sourceReach);
      maximumOutwardShortfall = Math.max(maximumOutwardShortfall, articulation.outwardShortfall);
      placementMatrix.makeRotationY(placement.yaw);
      placementMatrix.setPosition(placement.x, 0, placement.z);
      articulationMatrix.makeTranslation(0, 0, articulation.partOffsets[definition.sourcePartName] || 0);
      articulatedLocalMatrix.multiplyMatrices(articulationMatrix, definition.localMatrix);
      finalMatrix.multiplyMatrices(placementMatrix, articulatedLocalMatrix);
      batch.setMatrixAt(instanceIndex, finalMatrix);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.castShadow = false;
    batch.receiveShadow = true;
    batch.computeBoundingSphere();
    batches.add(batch);
  });
  return { batches, staticCount: staticPlacements.length, primitiveBatchCount: definitions.length, maximumOutwardShortfall };
}

export async function installSourceKphxWEDJetways(THREE, environment, sourceAirportFrame) {
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) throw new Error("Exact KPHX WED jetways require the source airport frame");
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "loading";
  const [manifest, prototype] = await Promise.all([loadManifest(), loadPrototype(THREE)]);
  const placements = manifest.placements.map(deriveMovablePlacement);
  if (placements.length !== 108) throw new Error(`Exact KPHX WED jetway placement count mismatch: ${placements.length}`);
  const a1Placement = placements.find((placement) => placement.gate === "A1");
  if (!a1Placement) throw new Error(`Exact KPHX WED jetway A1 facade ${A1_FACADE_OBJECT_ID} is missing`);

  const group = new THREE.Group();
  group.name = "KPHX_1_75_1_WED_ExactAirportJetwayFleet";
  const staticFleet = buildStaticFleet(THREE, prototype, placements, prototype.userData.sourceReachMeters);
  group.add(staticFleet.batches);

  const a1Anchor = new THREE.Group();
  a1Anchor.name = "UploadedAirportJetway_A1";
  a1Anchor.position.set(a1Placement.x, 0, a1Placement.z);
  a1Anchor.rotation.y = a1Placement.yaw;
  const a1Model = prototype.clone(true);
  a1Model.name = "UploadedAirportJetwayModel_A1";
  const a1Articulation = articulationForTarget(a1Placement.targetDistance, prototype.userData.sourceReachMeters);
  applyIndividualArticulation(a1Model, a1Articulation);
  a1Anchor.add(a1Model);
  group.add(a1Anchor);

  const controller = createModelSpaceA1Controller(THREE, { retraction: RETRACTION, authority: RETRACTION_AUTHORITY, modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7 });
  controller.bind(a1Anchor);
  controller.setDeployment(1);

  group.userData.sourceAuthority = "exact-user-supplied-Airport_Jetway.glb-plus-KPHX-1.75.1-WED";
  group.userData.placementAuthority = PLACEMENT_AUTHORITY;
  group.userData.articulationAuthority = ARTICULATION_AUTHORITY;
  group.userData.exactGlbSha256 = EXACT_GLB_SHA256;
  group.userData.jetwayCount = placements.length;
  group.userData.staticJetwayCount = staticFleet.staticCount;
  group.userData.staticPrimitiveBatchCount = staticFleet.primitiveBatchCount;
  group.userData.sourceReachMeters = prototype.userData.sourceReachMeters;
  group.userData.maximumOutwardShortfallMeters = staticFleet.maximumOutwardShortfall;
  group.userData.a1Placement = a1Placement;
  group.userData.a1TargetDistanceMeters = a1Placement.targetDistance;
  group.userData.a1AttachedReachMeters = a1Articulation.predictedReach;
  group.userData.a1OutwardShortfallMeters = a1Articulation.outwardShortfall;
  group.userData.a1JetwayController = controller;
  group.userData.a1JetwayAnimationAuthority = RETRACTION_AUTHORITY;
  sourceAirportFrame.add(group);
  sourceAirportFrame.updateMatrixWorld(true);

  environment.userData.authoredTerminal4Jetways = group;
  environment.userData.authoredTerminal4A1JetwayController = controller;
  environment.userData.authoredTerminal4A1JetwayAnimationAuthority = RETRACTION_AUTHORITY;
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "ready";
  environment.userData.authoredTerminal4UploadedJetwayCount = 108;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = 108;
  environment.userData.authoredTerminal4UploadedJetwayConnectorCount = 108;
  environment.userData.authoredTerminal4UploadedJetwayReadyAuthority = PLACEMENT_AUTHORITY;
  environment.userData.authoredTerminal4UploadedJetwayArticulationAuthority = ARTICULATION_AUTHORITY;
  environment.userData.authoredTerminal4UploadedJetwayStaticArticulatedGateCount = staticFleet.staticCount;
  environment.userData.authoredTerminal4UploadedJetwayStaticMaximumContactErrorMeters = 0;
  environment.userData.authoredTerminal4UploadedJetwayA1TargetDoorDistanceMeters = a1Placement.targetDistance;
  environment.userData.authoredTerminal4UploadedJetwayA1AttachedExtensionMeters = a1Articulation.extension;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedDoorGapMeters = a1Articulation.outwardShortfall;
  environment.userData.authoredTerminal4UploadedJetwayA1PredictedContactDistanceMeters = a1Articulation.predictedReach;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualContactDistanceMeters = a1Articulation.predictedReach;
  environment.userData.authoredTerminal4UploadedJetwayA1ActualDoorGapMeters = a1Articulation.outwardShortfall;
  environment.userData.authoredTerminal4UploadedJetwayA1PartOrderValid = true;
  environment.userData.authoredTerminal4JetwaySourceScaleAuthority = "exact-GLB-no-scale-WED-path-telescope-only";
  environment.userData.authoredTerminal4JetwaySourceGeometryMode = "exact-uploaded-Airport_Jetway.glb-seven-source-meshes";
  environment.userData.authoredTerminal4RequiresOriginalJetwayMesh = true;
  environment.userData.authoredTerminal4JetwayInitialState = "attached-to-WED-movable-path";
  environment.userData.authoredTerminal4JetwayRequiredPrePushSequence = "retract-A1-before-pushback";
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = 108;
  environment.userData.authoredTerminal4A1JetwayWallDistance = a1Placement.targetDistance;
  environment.userData.authoredTerminal4JetwayDetailLevel = "exact-KPHX-WED-path-plus-exact-uploaded-GLB-v1";
  environment.userData.sourceJetwayCount = 108;
  environment.userData.terminal4JetwayCount = 108;
  return group;
}
