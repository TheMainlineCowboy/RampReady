import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  addUploadedAirportJetwayStaticTerminalConnectors,
  addUploadedAirportJetwayTerminalConnector,
} from "./uploadedAirportJetwayTerminalConnector.js";

const MODEL_AUTHORITY = "supplied-airport-jetway-gltf-source-hierarchy-uvs-v3";
const MATERIAL_AUTHORITY = "supplied-airport-jetway-clean-full-resolution-texture-set-v3";
const PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v3";
const A1_RETRACTION_AUTHORITY = "source-node-telescoping-without-height-correction-v7";
const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });
const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function sourceModelUrl() {
  return `${import.meta.env.BASE_URL || "/"}models/airport-jetway/source/Airport_Jetway.gltf`;
}

function prepareSourceScene(THREE, scene) {
  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedSourcePrototype";
  scene.name = scene.name || "Airport_Jetway_SourceScene";
  scene.position.set(0.651626, 0.23, 15.12);
  scene.traverse((entry) => {
    if (!entry.isMesh) return;
    const geometry = entry.geometry;
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    if (!geometry.getAttribute("tangent") && geometry.index && geometry.getAttribute("uv") && geometry.getAttribute("normal")) {
      try { geometry.computeTangents(); } catch { /* Source remains valid without a tangent attribute. */ }
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    entry.castShadow = false;
    entry.receiveShadow = true;
    if (entry.material) {
      const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
      for (const material of materials) {
        material.userData = material.userData || {};
        material.userData.materialAuthority = MATERIAL_AUTHORITY;
        if (material.transparent) {
          material.depthWrite = false;
          material.side = THREE.DoubleSide;
        }
      }
    }
  });
  aligned.add(scene);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  return aligned;
}

async function loadSourcePrototype(THREE) {
  const gltf = await new GLTFLoader().loadAsync(sourceModelUrl());
  if (!gltf?.scene) throw new Error("Supplied Airport Jetway glTF did not contain a scene");
  const prototype = prepareSourceScene(THREE, gltf.scene);
  const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
  const missing = requiredNodes.filter((name) => !prototype.getObjectByName(name));
  if (missing.length) throw new Error(`Supplied Airport Jetway hierarchy is missing: ${missing.join(", ")}`);
  let meshCount = 0;
  let uvMeshCount = 0;
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    meshCount += 1;
    if (entry.geometry?.getAttribute("uv")) uvMeshCount += 1;
  });
  if (meshCount !== 7 || uvMeshCount !== 7) {
    throw new Error(`Supplied Airport Jetway expected 7 UV-mapped meshes, received ${meshCount} meshes and ${uvMeshCount} UV meshes`);
  }
  return prototype;
}

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    meshes.push({
      name: entry.name || `SourcePrimitive_${meshes.length}`,
      geometry: entry.geometry,
      material: entry.material,
      localMatrix: entry.matrixWorld.clone(),
    });
  });
  return meshes;
}

function buildStaticInstancedFleet(THREE, prototype, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "UploadedAirportJetwayStaticSourceInstances";
  const placementMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();

  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(meshDefinition.geometry, meshDefinition.material, staticPlacements.length);
    batch.name = `UploadedAirportJetwayStatic_${primitiveIndex}_${meshDefinition.name}`;
    batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    batch.castShadow = false;
    batch.receiveShadow = true;
    staticPlacements.forEach((placement, instanceIndex) => {
      placementMatrix.makeRotationY(placement.yaw);
      placementMatrix.setPosition(placement.x, 0, placement.z);
      finalMatrix.multiplyMatrices(placementMatrix, meshDefinition.localMatrix);
      batch.setMatrixAt(instanceIndex, finalMatrix);
    });
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    batches.add(batch);
  });

  return { batches, staticGateCount: staticPlacements.length, primitiveBatchCount: prototypeMeshes.length };
}

function createController() {
  let deployment = 1;
  let visual = null;
  let state = "loading-supplied-model";
  const apply = () => {
    if (!visual) return;
    const retract = 1 - deployment;
    const { anchor, nodes, base } = visual;
    anchor.rotation.y = base.yaw - retract * A1_RETRACTION.rotation;
    if (nodes.tunnelB) nodes.tunnelB.position.z = base.tunnelB.z - retract * A1_RETRACTION.tunnelB;
    if (nodes.tunnelC) nodes.tunnelC.position.z = base.tunnelC.z - retract * A1_RETRACTION.tunnelC;
    if (nodes.cab) {
      nodes.cab.position.z = base.cab.z - retract * A1_RETRACTION.cab;
      nodes.cab.position.y = base.cab.y + retract * A1_RETRACTION.lift;
    }
    anchor.userData.retractionAuthority = A1_RETRACTION_AUTHORITY;
    anchor.userData.retractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;
    state = deployment >= 0.995 ? "attached-to-aircraft-door"
      : deployment <= 0.005 ? "parked-clear-of-aircraft"
        : "retracting-from-aircraft";
  };
  return {
    setDeployment(value) { deployment = clamp(value, 0, 1); apply(); },
    getDeployment() { return deployment; },
    getState() { return state; },
    bind(anchor) {
      const nodes = {
        tunnelB: anchor.getObjectByName("Tunnel_B"),
        tunnelC: anchor.getObjectByName("Tunnel_C"),
        cab: anchor.getObjectByName("Cab"),
      };
      visual = {
        anchor,
        nodes,
        base: {
          yaw: anchor.rotation.y,
          tunnelB: nodes.tunnelB?.position.clone() || { z: 0 },
          tunnelC: nodes.tunnelC?.position.clone() || { z: 0 },
          cab: nodes.cab?.position.clone() || { y: 0, z: 0 },
        },
      };
      state = "supplied-model-ready";
      apply();
    },
  };
}

function hideGeneratedJetways(group) {
  let hidden = 0;
  for (const child of group.children) {
    if (child.name === "UploadedAirportJetwayFleet") continue;
    if (HIDE_REPLACED.test(child.name) || /A1.*Animated.*Jetway/i.test(child.name)) {
      child.visible = false;
      child.traverse((entry) => {
        if (entry.isMesh) { entry.visible = false; entry.castShadow = false; }
      });
      hidden += 1;
    }
  }
  return hidden;
}

export function installUploadedAirportJetwayFleet(THREE, group, placements, _sourceTextures = {}) {
  if (!group?.isGroup) throw new Error("Supplied airport jetway replacement requires the Terminal 4 jetway group");
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Supplied airport jetway replacement expected 58 placements, received ${placements?.length ?? 0}`);
  }
  const controller = createController();
  group.userData.uploadedJetwayLoadState = "loading";
  group.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
  group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  group.userData.uploadedJetwayExpectedCount = placements.length;
  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;

  loadSourcePrototype(THREE)
    .then((prototype) => {
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);
      fleet.add(staticFleet.batches);
      const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);

      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.userData.renderMode = placement.gate === "A1" ? "individual-animated" : "static-instanced-marker";
        if (placement.gate === "A1") {
          anchor.position.set(placement.x, 0, placement.z);
          anchor.rotation.y = placement.yaw;
          const model = prototype.clone(true);
          model.name = "UploadedAirportJetwayModel_A1";
          model.traverse((entry) => { if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true; });
          anchor.add(model);
          controller.bind(anchor);
          addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);
        }
        fleet.add(anchor);
      }

      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedJetways(group);
      group.userData.uploadedJetwayLoadState = "ready";
      group.userData.uploadedJetwayCount = placements.length;
      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;
      group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
      group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
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
      group.userData.sourceGeometryMode = MODEL_AUTHORITY;
      group.userData.visualAuthority = MODEL_AUTHORITY;
      group.userData.requiresOriginalSourceMesh = true;
      group.userData.proceduralJetwayStairCount = 0;
      group.userData.proceduralProjectedUvCount = 0;
    })
    .catch((error) => {
      group.userData.uploadedJetwayLoadState = "error";
      group.userData.uploadedJetwayLoadError = error.message;
      console.error("Supplied airport jetway fleet failed to load", error);
    });

  return controller;
}
