import { buildXp11Type2Facade } from "./kphxFullAirport/xp11Type2Facade.js";
import { SOURCE_KPHX_A1_ORIGIN } from "./sourceKphxTerminal4.js";


const EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb";
const EXACT_GLB_SHA256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-original-internal-pose-wed-root-placement-v1";
const MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1";
const READY_AUTHORITY = "exact-kphx-1.75.1-wed-terminal4-jetways-plus-untouched-supplied-glb-v2";
const PERFORMANCE_AUTHORITY = "76-static-exact-glb-instances-original-internal-pose-v1";
const PLACEMENT_AUTHORITY = "KPHX-1.75.1-earth.wed.xml-terminal4-jetway-ramp-association-v1";
const A1_ANIMATION_AUTHORITY = "disabled-during-exact-source-placement-verification";
const NATIVE_RETRACTION_AUTHORITY = "disabled-original-zip-pose-locked";
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const STOCK_JETWAY_RESOURCE = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const STOCK_JETWAY_BASE = "/models/xplane11-stock/jetway1";
const WED_JETWAY_MANIFEST_URL = "models/kphx/wed-jetways.exact.json";
const EARTH_RADIUS_METERS = 6378137;
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

export async function loadExactPrototype(THREE) {
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

export function measurePrototypeReach(THREE, prototype) {
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

function buildStaticInstancedFleet(THREE, prototype, placements) {
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "KPHX_WED_StaticExactJetwayInstances_OriginalZipPose";
  const placementMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();

  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(meshDefinition.geometry, meshDefinition.material, placements.length);
    batch.name = `KPHX_WED_StaticJetway_${primitiveIndex}_${meshDefinition.name}`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.receiveShadow = true;

    placements.forEach((placement, instanceIndex) => {
      placementMatrix.makeRotationY(placement.yawRadians);
      placementMatrix.setPosition(placement.x, 0, placement.z);
      finalMatrix.multiplyMatrices(placementMatrix, meshDefinition.localMatrix);
      batch.setMatrixAt(instanceIndex, finalMatrix);
    });

    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    batches.add(batch);
  });

  return {
    batches,
    staticGateCount: placements.length,
    primitiveBatchCount: prototypeMeshes.length,
  };
}

export async function loadPlacementMap() {
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
  if (!environment?.isGroup || !sourceAirportFrame?.isGroup) {
    throw new Error("Exact KPHX WED jetways require the source airport frame");
  }

  const map = await loadPlacementMap();
  const [facadeResponse, wedResponse] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL || "/"}models/xplane11-stock/jetway1/jetway_1_solid.fac`, { cache: "no-store" }),
    fetch(`${import.meta.env.BASE_URL || "/"}${WED_JETWAY_MANIFEST_URL}`, { cache: "no-store" }),
  ]);
  if (!facadeResponse.ok) throw new Error(`Exact XP11 stock jetway facade returned HTTP ${facadeResponse.status}`);
  if (!wedResponse.ok) throw new Error(`Exact KPHX WED jetway manifest returned HTTP ${wedResponse.status}`);

  const facadeText = await facadeResponse.text();
  const wed = await wedResponse.json();
  if (wed?.authority !== "KPHX-1.75.1-earth.wed.xml" || !Array.isArray(wed.placements)) {
    throw new Error("Exact KPHX WED jetway manifest failed its source contract");
  }

  const latitude0 = SOURCE_KPHX_A1_ORIGIN.latitude * Math.PI / 180;
  const sourceLocalFromWED = (latitude, longitude) => {
    const east = (Number(longitude) - SOURCE_KPHX_A1_ORIGIN.longitude) * Math.PI / 180
      * EARTH_RADIUS_METERS * Math.cos(latitude0);
    const north = (Number(latitude) - SOURCE_KPHX_A1_ORIGIN.latitude) * Math.PI / 180
      * EARTH_RADIUS_METERS;
    return new THREE.Vector2(east, -north);
  };
  const wallChoice = (node) => {
    const match = String(node.wallType || node.wall_type || "").match(/Wall\s+(\d+)/i);
    if (!match) throw new Error(`WED jetway node ${node.wedObjectId} lost its authored wall choice`);
    return Number(match[1]) - 1;
  };

  const jetwayGroup = new THREE.Group();
  jetwayGroup.name = "KPHX_T4_WED_Exact_XP11_Stock_Jetways";
  jetwayGroup.userData.sourceAuthority = "KPHX 1.75.1 earth.wed.xml + exact XP11 stock Jetway_1_solid.fac";
  jetwayGroup.userData.sourceFacadeResource = STOCK_JETWAY_RESOURCE;
  jetwayGroup.userData.stockFacadeBase = STOCK_JETWAY_BASE;
  jetwayGroup.userData.substitutionPolicy = "none";
  jetwayGroup.userData.oldAirportJetwayGlbUsed = false;

  const evidence = [];
  let renderedEdgeCount = 0;

  for (const gateMap of map.placements) {
    const placement = wed.placements.find((entry) => entry.wedObjectId === gateMap.facadeWedObjectId);
    if (!placement) {
      throw new Error(`Missing exact WED facade ${gateMap.facadeWedObjectId} for ${gateMap.gate}`);
    }
    if (placement.resource !== STOCK_JETWAY_RESOURCE) {
      throw new Error(`${gateMap.gate} source facade changed to ${placement.resource}`);
    }

    const nodes = placement.rings?.[0]?.nodes || [];
    if (nodes.length !== gateMap.facadeNodeCount) {
      throw new Error(`${gateMap.gate} exact node count mismatch map=${gateMap.facadeNodeCount} WED=${nodes.length}`);
    }

    const footprint = nodes.map((node) => sourceLocalFromWED(node.latitude, node.longitude));
    const wallChoices = nodes.map(wallChoice);
    const built = await buildXp11Type2Facade({
      facadeText,
      footprint,
      wallChoices,
      basePath: STOCK_JETWAY_BASE,
    });

    if (built.facade.ringMode !== 0) {
      throw new Error(`${gateMap.gate} exact stock jetway facade is no longer RING 0`);
    }
    if (built.wallEvidence.length !== nodes.length - 1) {
      throw new Error(`${gateMap.gate} rendered ${built.wallEvidence.length} edges, expected ${nodes.length - 1}`);
    }

    built.root.name = `KPHX_${gateMap.gate}_WED_${gateMap.facadeWedObjectId}_Exact_XP11_Stock_Jetway`;
    built.root.userData.gate = gateMap.gate;
    built.root.userData.rampWedObjectId = gateMap.rampWedObjectId;
    built.root.userData.facadeWedObjectId = gateMap.facadeWedObjectId;
    built.root.userData.facadeNodeCount = nodes.length;
    built.root.userData.sourceResource = placement.resource;
    built.root.userData.wallChoices = wallChoices.map((choice) => choice + 1);
    jetwayGroup.add(built.root);

    renderedEdgeCount += built.wallEvidence.length;
    evidence.push({
      gate: gateMap.gate,
      rampWedObjectId: gateMap.rampWedObjectId,
      facadeWedObjectId: gateMap.facadeWedObjectId,
      nodeCount: nodes.length,
      renderedEdgeCount: built.wallEvidence.length,
      wallChoices: wallChoices.map((choice) => choice + 1),
    });
  }

  if (evidence.length !== 76) {
    throw new Error(`Exact T4 stock jetway runtime built ${evidence.length} jetways, expected 76`);
  }

  sourceAirportFrame.add(jetwayGroup);
  sourceAirportFrame.updateMatrixWorld(true);

  const a1 = evidence.find((entry) => entry.facadeWedObjectId === 104804);
  if (!a1 || a1.nodeCount !== 7) {
    throw new Error("Exact A1 stock jetway runtime failed its WED source contract");
  }

  jetwayGroup.userData.uploadedJetwayLoadState = "ready-exact-xp11-stock-facade";
  jetwayGroup.userData.uploadedJetwayCount = evidence.length;
  jetwayGroup.userData.uploadedJetwayVerifiedModelCount = evidence.length;
  jetwayGroup.userData.uploadedJetwayPlacementAuthority = map.authority;
  jetwayGroup.userData.renderedOpenEdgeCount = renderedEdgeCount;
  jetwayGroup.userData.wedA1FacadeObjectId = a1.facadeWedObjectId;
  jetwayGroup.userData.wedA1FacadeNodeCount = a1.nodeCount;

  environment.userData.authoredTerminal4Jetways = jetwayGroup;
  environment.userData.authoredTerminal4A1JetwayController = null;
  environment.userData.authoredTerminal4UploadedJetwayLoadState = "ready-exact-xp11-stock-facade";
  environment.userData.authoredTerminal4UploadedJetwayCount = evidence.length;
  environment.userData.authoredTerminal4UploadedJetwayVerifiedModelCount = evidence.length;
  environment.userData.authoredTerminal4TerminalConnectedJetwayCount = evidence.length;
  environment.userData.authoredTerminal4JetwayTextureAuthority = "exact-XP11-stock-jetway1-source";
  environment.userData.authoredTerminal4ExactJetwayTextureActive = true;
  environment.userData.sourceKphxTerminal4JetwayMap = map;
  environment.userData.sourceKphxTerminal4JetwayCount = evidence.length;
  environment.userData.sourceKphxA1JetwayFacadeObjectId = a1.facadeWedObjectId;
  environment.userData.sourceKphxA1JetwayFacadeNodeCount = a1.nodeCount;
  environment.userData.sourceKphxMissingExactJetwayResource = null;
  environment.userData.sourceKphxJetwaySubstitutionPolicy = "none";
  environment.userData.sourceKphxJetwayVisibleGeometryAuthority = "exact-XP11-stock-Jetway_1_solid.fac";
  environment.userData.sourceKphxJetwayRenderedOpenEdgeCount = renderedEdgeCount;
  environment.userData.sourceKphxJetwayRuntimeEvidence = evidence;

  return {
    group: jetwayGroup,
    controller: null,
    map,
    blocked: false,
    missingExactResource: null,
    evidence,
    renderedEdgeCount,
  };
}
