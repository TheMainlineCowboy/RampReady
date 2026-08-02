import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_AUTHORITY = "user-supplied-airport-jetway-complete-glb-v2";
const MATERIAL_AUTHORITY = "supplied-embedded-webp-materials-source-uvs-and-tangents";
const PERFORMANCE_AUTHORITY = "57-static-textured-source-instances-plus-1-animated-source-model";
const A1_RETRACTION_AUTHORITY = "supplied-tunnel-node-native-z-axis-retraction";
const SOURCE_FILE = "Airport_Jetway.source-web.glb";
const SOURCE_SHA256 = "6a28f499d6a590f9b4a62e0588dbd0215d130224459757cf5e9775b93aa36f92";
const SOURCE_BYTES = 2413912;
const A1_RETRACTION = Object.freeze({ tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });
const GENERATED_OBJECT_PATTERN = /(?:AIR_Jetway01|Terminal4_(?:LowerFacade|ClosedService|FacadeVent)|FixedWalkway|PortalSeal|TerminalConnector|GeneratedJetway|ProceduralJetway|A1.*Animated.*Jetway)/i;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function sourceAssetUrl() {
  return `${import.meta.env.BASE_URL || "/"}models/airport-jetway/${SOURCE_FILE}`;
}

function objectBySourceName(root, wanted) {
  let found = null;
  root.traverse((entry) => {
    const name = String(entry.name || "").toLowerCase();
    const target = wanted.toLowerCase();
    if (!found && (name === target || name.startsWith(`${target}_`))) found = entry;
  });
  return found;
}

function verifySourceModel(model) {
  const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
  for (const nodeName of requiredNodes) {
    if (!objectBySourceName(model, nodeName)) throw new Error(`Complete supplied jetway GLB is missing ${nodeName}`);
  }

  let meshCount = 0;
  let texturedMeshCount = 0;
  let uvMeshCount = 0;
  let tangentMeshCount = 0;
  const materialNames = new Set();
  model.traverse((entry) => {
    if (!entry.isMesh) return;
    meshCount += 1;
    if (entry.geometry?.getAttribute("uv")) uvMeshCount += 1;
    if (entry.geometry?.getAttribute("tangent")) tangentMeshCount += 1;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      materialNames.add(material.name || "unnamed");
      if (material.map || material.normalMap || material.aoMap || material.emissiveMap || material.metalnessMap || material.roughnessMap) {
        texturedMeshCount += 1;
      }
    }
  });

  if (meshCount < 7) throw new Error(`Complete supplied jetway GLB has only ${meshCount} meshes`);
  if (uvMeshCount !== meshCount) throw new Error(`Complete supplied jetway GLB lost UVs on ${meshCount - uvMeshCount} meshes`);
  if (tangentMeshCount !== meshCount) throw new Error(`Complete supplied jetway GLB lost tangents on ${meshCount - tangentMeshCount} meshes`);
  if (texturedMeshCount < meshCount) throw new Error(`Complete supplied jetway GLB has only ${texturedMeshCount}/${meshCount} textured meshes`);
  if (![...materialNames].some((name) => /jetway/i.test(name)) || ![...materialNames].some((name) => /glass/i.test(name))) {
    throw new Error(`Complete supplied jetway GLB material set is wrong: ${[...materialNames].join(", ")}`);
  }
  return { meshCount, texturedMeshCount, uvMeshCount, tangentMeshCount, materialNames: [...materialNames] };
}

async function loadPrototype(THREE) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(sourceAssetUrl());
  const sourceRoot = gltf.scene.getObjectByName("RootNode");
  if (!sourceRoot) throw new Error("Complete supplied jetway GLB is missing its RootNode hierarchy");

  // The Sketchfab scene wrapper contains only presentation transforms. The
  // authored RootNode is the actual model hierarchy supplied by the user.
  const model = sourceRoot.clone(true);
  model.name = "SuppliedAirportJetway_CompleteSourceModel";
  model.updateMatrixWorld(true);
  const verification = verifySourceModel(model);

  model.traverse((entry) => {
    if (!entry.isMesh) return;
    entry.castShadow = false;
    entry.receiveShadow = true;
    entry.geometry.userData.sourceGeometryAuthority = MODEL_AUTHORITY;
    entry.geometry.userData.sourceUvsPreserved = Boolean(entry.geometry.getAttribute("uv"));
    entry.geometry.userData.sourceTangentsPreserved = Boolean(entry.geometry.getAttribute("tangent"));
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      material.userData.materialAuthority = MATERIAL_AUTHORITY;
      material.userData.sourceMapsPreserved = true;
    }
  });

  const rotunda = objectBySourceName(model, "Rotunda");
  const cab = objectBySourceName(model, "Cab");
  const modelBounds = new THREE.Box3().setFromObject(model);
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabCenter = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const sourceDirection = cabCenter.clone().sub(rotundaCenter);
  sourceDirection.y = 0;
  const rotundaToCabMeters = sourceDirection.length();
  if (rotundaToCabMeters < 0.1) throw new Error("Complete supplied jetway source axis could not be measured");
  sourceDirection.normalize();

  // BGL placements represent the fixed terminal-side pivot. Move the supplied
  // rotunda to that pivot, preserve native model scale, and point the cab along
  // local +Z before applying each package-authored heading.
  model.position.add(new THREE.Vector3(-rotundaCenter.x, -modelBounds.min.y, -rotundaCenter.z));
  const aligned = new THREE.Group();
  aligned.name = "SuppliedAirportJetway_RotundaOrigin_CabForward";
  aligned.rotation.y = -Math.atan2(sourceDirection.x, sourceDirection.z);
  aligned.add(model);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  aligned.userData.sourceFile = SOURCE_FILE;
  aligned.userData.sourceSha256 = SOURCE_SHA256;
  aligned.userData.sourceBytes = SOURCE_BYTES;
  aligned.userData.sourceAxis = [sourceDirection.x, sourceDirection.y, sourceDirection.z];
  aligned.userData.sourceRotundaCenter = rotundaCenter.toArray();
  aligned.userData.sourceCabCenter = cabCenter.toArray();
  aligned.userData.sourceRotundaToCabMeters = rotundaToCabMeters;
  aligned.userData.sourceBoundsMin = modelBounds.min.toArray();
  aligned.userData.sourceBoundsMax = modelBounds.max.toArray();
  aligned.userData.sourceMeshCount = verification.meshCount;
  aligned.userData.sourceTexturedMeshCount = verification.texturedMeshCount;
  aligned.userData.sourceUvMeshCount = verification.uvMeshCount;
  aligned.userData.sourceTangentMeshCount = verification.tangentMeshCount;
  aligned.userData.sourceMaterialNames = verification.materialNames;
  aligned.userData.generatedGeometryCount = 0;
  aligned.userData.generatedUvCount = 0;
  return aligned;
}

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    meshes.push({
      name: entry.name || `Primitive_${meshes.length}`,
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
  batches.name = "SuppliedAirportJetway_StaticTexturedSourceInstances";
  const placementMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();

  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(meshDefinition.geometry, meshDefinition.material, staticPlacements.length);
    batch.name = `SuppliedAirportJetwayStatic_${primitiveIndex}_${meshDefinition.name}`;
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
  let state = "loading-complete-supplied-model";

  const apply = () => {
    if (!visual) return;
    const retract = 1 - deployment;
    const { nodes, base, anchor } = visual;
    if (nodes.tunnelB) nodes.tunnelB.position.z = base.tunnelB.z - retract * A1_RETRACTION.tunnelB;
    if (nodes.tunnelC) nodes.tunnelC.position.z = base.tunnelC.z - retract * A1_RETRACTION.tunnelC;
    if (nodes.cab) {
      nodes.cab.position.z = base.cab.z - retract * A1_RETRACTION.cab;
      nodes.cab.position.y = base.cab.y + retract * A1_RETRACTION.lift;
    }
    anchor.userData.retractionAuthority = A1_RETRACTION_AUTHORITY;
    anchor.userData.retractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;
    state = deployment >= 0.995 ? "source-authored-deployed-state"
      : deployment <= 0.005 ? "source-nodes-retracted"
        : "retracting-supplied-source-nodes";
  };

  return {
    setDeployment(value) {
      deployment = clamp(value, 0, 1);
      apply();
    },
    getDeployment() { return deployment; },
    getState() { return state; },
    bind(anchor, model) {
      const nodes = {
        tunnelB: objectBySourceName(model, "Tunnel_B"),
        tunnelC: objectBySourceName(model, "Tunnel_C"),
        cab: objectBySourceName(model, "Cab"),
      };
      visual = {
        anchor,
        nodes,
        base: {
          tunnelB: nodes.tunnelB?.position.clone() || { z: 0 },
          tunnelC: nodes.tunnelC?.position.clone() || { z: 0 },
          cab: nodes.cab?.position.clone() || { z: 0, y: 0 },
        },
      };
      state = "complete-supplied-model-ready";
      apply();
    },
  };
}

function hideGeneratedObjects(group) {
  let hidden = 0;
  for (const child of group.children) {
    if (child.name === "UploadedAirportJetwayFleet") continue;
    if (!GENERATED_OBJECT_PATTERN.test(child.name || "")) continue;
    child.visible = false;
    child.traverse((entry) => {
      entry.visible = false;
      if (entry.isMesh) entry.castShadow = false;
    });
    hidden += 1;
  }
  return hidden;
}

export function installUploadedAirportJetwayFleet(THREE, group, placements, sourceTextures = {}) {
  void sourceTextures;
  if (!group?.isGroup) throw new Error("Supplied jetway installation requires the Terminal 4 jetway group");
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Supplied jetway installation expected 58 source placements, received ${placements?.length ?? 0}`);
  }

  const controller = createController();
  group.userData.uploadedJetwayLoadState = "loading";
  group.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
  group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  group.userData.uploadedJetwayExpectedCount = placements.length;
  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;
  group.userData.uploadedJetwayA1RetractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;
  group.userData.uploadedJetwaySourceFile = SOURCE_FILE;
  group.userData.uploadedJetwaySourceSha256 = SOURCE_SHA256;
  group.userData.uploadedJetwaySourceBytes = SOURCE_BYTES;

  const ready = loadPrototype(THREE)
    .then((prototype) => {
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      fleet.userData.completeSuppliedSource = true;
      fleet.userData.sourceUvsPreserved = true;
      fleet.userData.sourceMaterialsPreserved = true;
      fleet.userData.generatedConnectorCount = 0;
      fleet.userData.generatedPortalCount = 0;
      fleet.userData.generatedFacadeCount = 0;
      fleet.userData.sourceRotundaToCabMeters = prototype.userData.sourceRotundaToCabMeters;
      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);
      fleet.add(staticFleet.batches);

      let individualModelCount = 0;
      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.position.set(placement.x, 0, placement.z);
        anchor.rotation.y = placement.yaw;
        anchor.userData.gate = placement.gate;
        anchor.userData.sourceHeadingDegrees = placement.sourceHeadingDegrees;
        anchor.userData.renderMode = placement.gate === "A1" ? "individual-complete-source-model" : "static-complete-source-instance-marker";
        if (placement.gate === "A1") {
          const model = prototype.clone(true);
          model.name = "UploadedAirportJetwayModel_A1";
          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          anchor.add(model);
          controller.bind(anchor, model);
          individualModelCount += 1;
        }
        fleet.add(anchor);
      }

      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedObjects(group);
      group.userData.uploadedJetwayLoadState = "ready";
      group.userData.uploadedJetwayCount = placements.length;
      group.userData.uploadedJetwayVerifiedModelCount = placements.length;
      group.userData.uploadedJetwayMeasuredTerminalConnectorCount = 0;
      group.userData.uploadedJetwayGeneratedConnectorCount = 0;
      group.userData.uploadedJetwayGeneratedPortalCount = 0;
      group.userData.uploadedJetwayGeneratedFacadeCount = 0;
      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayMaterialAuthority = MATERIAL_AUTHORITY;
      group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
      group.userData.uploadedJetwayStaticInstancedGateCount = staticFleet.staticGateCount;
      group.userData.uploadedJetwayAnimatedIndividualGateCount = individualModelCount;
      group.userData.uploadedJetwayStaticPrimitiveBatchCount = staticFleet.primitiveBatchCount;
      group.userData.uploadedJetwaySourceMeshCount = prototype.userData.sourceMeshCount;
      group.userData.uploadedJetwaySourceTexturedMeshCount = prototype.userData.sourceTexturedMeshCount;
      group.userData.uploadedJetwaySourceUvMeshCount = prototype.userData.sourceUvMeshCount;
      group.userData.uploadedJetwaySourceTangentMeshCount = prototype.userData.sourceTangentMeshCount;
      group.userData.uploadedJetwaySourceMaterialNames = prototype.userData.sourceMaterialNames.join(",");
      group.userData.uploadedJetwayGlobalEdgeOverlayCount = 0;
      group.userData.sourceGeometryMode = MODEL_AUTHORITY;
      group.userData.visualAuthority = MODEL_AUTHORITY;
      group.userData.requiresOriginalSourceMesh = true;
      group.userData.facadeInfillCount = 0;
      group.userData.lowerFacadeFitCount = 0;
      group.userData.proceduralJetwayStairCount = 0;
      group.userData.proceduralJetwayObjectCount = 0;
      return {
        count: placements.length,
        modelCount: placements.length,
        authority: MODEL_AUTHORITY,
        materialAuthority: MATERIAL_AUTHORITY,
        staticGateCount: staticFleet.staticGateCount,
        individualModelCount,
        primitiveBatchCount: staticFleet.primitiveBatchCount,
        sourceMeshCount: prototype.userData.sourceMeshCount,
      };
    })
    .catch((error) => {
      group.userData.uploadedJetwayLoadState = "error";
      group.userData.uploadedJetwayLoadError = error.message;
      console.error("Complete supplied airport jetway fleet failed to load", error);
      throw error;
    });

  group.userData.uploadedJetwayReady = ready;
  controller.ready = ready;
  return controller;
}

export {
  MODEL_AUTHORITY as UPLOADED_AIRPORT_JETWAY_MODEL_AUTHORITY,
  MATERIAL_AUTHORITY as UPLOADED_AIRPORT_JETWAY_MATERIAL_AUTHORITY,
};
