import {
  addUploadedAirportJetwayStaticTerminalConnectors,
  addUploadedAirportJetwayTerminalConnector,
} from "./uploadedAirportJetwayTerminalConnector.js";

const MODEL_AUTHORITY = "exact-uploaded-airport-jetway-glb-562e3144-v1";
const MATERIAL_AUTHORITY = "exact-seven-embedded-airport-jetway-textures-v1";
const PERFORMANCE_AUTHORITY = "57-static-exact-glb-instances-plus-1-animated-a1-v1";
const A1_RETRACTION_AUTHORITY = "exact-glb-authored-node-telescoping-a1-v1";
const A1_RETRACTION = Object.freeze({
  rotation: 0.052,
  tunnelB: 0.42,
  tunnelC: 0.78,
  cab: 1.18,
  lift: 0.08,
  totalClearanceMeters: 2.38,
});
const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;
const EXACT_GLB_URL = "models/airport-jetway/Airport_Jetway.glb";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

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
  for (const mesh of meshes) {
    if (!mesh?.isMesh) throw new Error(`Exact Airport_Jetway.glb object ${mesh?.name || "unknown"} is not a mesh`);
    if (!mesh.geometry?.getAttribute("position")) throw new Error(`${mesh.name} lost original positions`);
    if (!mesh.geometry?.getAttribute("normal")) throw new Error(`${mesh.name} lost original normals`);
    if (!mesh.geometry?.getAttribute("uv")) throw new Error(`${mesh.name} lost original UVs`);
  }

  const materials = new Set();
  for (const mesh of meshes) {
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (material?.name) materials.add(material.name);
    }
  }
  if (!materials.has("Jetway") || !materials.has("Glass_JW") || materials.size !== 2) {
    throw new Error(`Exact Airport_Jetway.glb material assignment mismatch: ${[...materials].join(",")}`);
  }

  const triangleCount = countTriangles(root);
  if (triangleCount !== 31_978) {
    throw new Error(`Exact Airport_Jetway.glb triangle count mismatch: ${triangleCount}`);
  }
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

  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_ExactGlbPrototype";
  sourceScene.position.set(0.651626, 0.23, 15.12);
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

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    meshes.push({
      name: entry.name,
      geometry: entry.geometry,
      material: entry.material,
      localMatrix: entry.matrixWorld.clone(),
    });
  });
  if (meshes.length !== 7) throw new Error(`Exact Airport_Jetway.glb expected seven meshes, received ${meshes.length}`);
  return meshes;
}

function buildStaticInstancedFleet(THREE, prototype, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  if (staticPlacements.length !== 57) throw new Error(`Exact jetway fleet expected 57 static gates, received ${staticPlacements.length}`);
  const prototypeMeshes = collectPrototypeMeshes(prototype);
  const batches = new THREE.Group();
  batches.name = "UploadedAirportJetwayStaticExactGlbInstances";
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
  let state = "loading-exact-glb";
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
    state = deployment >= 0.995
      ? "attached-to-aircraft-door"
      : deployment <= 0.005
        ? "parked-clear-of-aircraft"
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
      state = "exact-glb-ready";
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

  const controller = createController();
  group.userData.uploadedJetwayLoadState = "loading";
  group.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
  group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  group.userData.uploadedJetwayExpectedCount = 58;
  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;

  loadExactPrototype(THREE)
    .then((prototype) => {
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);
      fleet.add(staticFleet.batches);
      const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);

      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.userData.renderMode = placement.gate === "A1" ? "individual-animated-exact-glb" : "static-exact-glb-instance-marker";
        if (placement.gate === "A1") {
          anchor.position.set(placement.x, 0, placement.z);
          anchor.rotation.y = placement.yaw;
          const model = prototype.clone(true);
          model.name = "UploadedAirportJetwayModel_A1";
          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          anchor.add(model);
          controller.bind(anchor);
          addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);
        }
        fleet.add(anchor);
      }

      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedJetways(group);
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
