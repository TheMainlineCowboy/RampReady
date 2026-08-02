const PART_COUNT = 5;
const MODEL_AUTHORITY = "user-supplied-airport-jetway-source-geometry-v1";
const MATERIAL_AUTHORITY = "supplied-material-slots-no-projected-terminal-texture";
const PERFORMANCE_AUTHORITY = "57-static-source-instances-plus-1-animated-source-model";
const A1_RETRACTION_AUTHORITY = "supplied-tunnel-node-native-z-axis-retraction";
const A1_RETRACTION = Object.freeze({ tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });
const GENERATED_OBJECT_PATTERN = /(?:AIR_Jetway01|Terminal4_(?:LowerFacade|ClosedService|FacadeVent)|FixedWalkway|PortalSeal|TerminalConnector|GeneratedJetway|ProceduralJetway|A1.*Animated.*Jetway)/i;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

async function readPayload() {
  const base = `${import.meta.env.BASE_URL || "/"}models/airport-jetway/`;
  const parts = await Promise.all(Array.from({ length: PART_COUNT }, async (_, index) => {
    const response = await fetch(`${base}geometry.part${index}`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Supplied jetway geometry part ${index} failed: ${response.status}`);
    return (await response.text()).trim();
  }));
  const encoded = parts.join("");
  const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser cannot decode the supplied jetway geometry payload");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const payload = new Uint8Array(await new Response(stream).arrayBuffer());
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const metadataLength = view.getUint32(0, true);
  const metadata = JSON.parse(new TextDecoder().decode(payload.subarray(4, 4 + metadataLength)));
  return { metadata, binary: payload.subarray(4 + metadataLength) };
}

function sourceMaterialForName(THREE, name = "") {
  const label = String(name);
  if (/glass|window/i.test(label)) {
    const material = new THREE.MeshPhysicalMaterial({
      name: `Supplied jetway material: ${label}`,
      color: 0x243840,
      roughness: 0.2,
      metalness: 0.04,
      transmission: 0.08,
      clearcoat: 0.18,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.userData.materialAuthority = MATERIAL_AUTHORITY;
    return material;
  }
  if (/tire|rubber|wheel/i.test(label)) {
    const material = new THREE.MeshStandardMaterial({
      name: `Supplied jetway material: ${label}`,
      color: 0x17191a,
      roughness: 0.94,
      metalness: 0.01,
      side: THREE.DoubleSide,
    });
    material.userData.materialAuthority = MATERIAL_AUTHORITY;
    return material;
  }
  if (/stair|rail|bogie|lift|metal|frame|support/i.test(label)) {
    const material = new THREE.MeshStandardMaterial({
      name: `Supplied jetway material: ${label}`,
      color: 0x777d80,
      roughness: 0.5,
      metalness: 0.48,
      side: THREE.DoubleSide,
    });
    material.userData.materialAuthority = MATERIAL_AUTHORITY;
    return material;
  }
  const material = new THREE.MeshStandardMaterial({
    name: `Supplied jetway material: ${label || "body"}`,
    color: 0xd0d0cc,
    roughness: 0.72,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  material.userData.materialAuthority = MATERIAL_AUTHORITY;
  return material;
}

function createGeometry(THREE, primitive, binary) {
  const positionView = new DataView(binary.buffer, binary.byteOffset + primitive.pos[0], primitive.pos[1]);
  const positions = new Float32Array(primitive.count * 3);
  for (let vertex = 0; vertex < primitive.count; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const quantized = positionView.getUint16((vertex * 3 + axis) * 2, true);
      positions[vertex * 3 + axis] = primitive.min[axis] + (quantized / 65535) * primitive.span[axis];
    }
  }

  const indexView = new DataView(binary.buffer, binary.byteOffset + primitive.idx[0], primitive.idx[1]);
  const IndexArray = primitive.indexType === "u32" ? Uint32Array : Uint16Array;
  const indices = new IndexArray(primitive.indexCount);
  const bytesPerIndex = primitive.indexType === "u32" ? 4 : 2;
  for (let index = 0; index < primitive.indexCount; index += 1) {
    indices[index] = bytesPerIndex === 4
      ? indexView.getUint32(index * bytesPerIndex, true)
      : indexView.getUint16(index * bytesPerIndex, true);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sourceGeometryAuthority = MODEL_AUTHORITY;
  geometry.userData.generatedUvs = false;
  return geometry;
}

function applyNodeTransform(object, node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    object.matrix.fromArray(node.matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
}

function objectBySourceName(root, wanted) {
  let found = null;
  root.traverse((entry) => {
    if (!found && String(entry.name || "").toLowerCase().startsWith(wanted.toLowerCase())) found = entry;
  });
  return found;
}

function buildPrototype(THREE, payload) {
  const { metadata, binary } = payload;
  const materials = (metadata.materials || []).map((name) => sourceMaterialForName(THREE, name));
  if (!materials.length) materials.push(sourceMaterialForName(THREE, "body"));

  const meshes = metadata.meshes.map((meshDefinition) => {
    const root = new THREE.Group();
    root.name = meshDefinition.name;
    meshDefinition.primitives.forEach((primitive, primitiveIndex) => {
      const mesh = new THREE.Mesh(
        createGeometry(THREE, primitive, binary),
        materials[primitive.material] || materials[0],
      );
      mesh.name = `${meshDefinition.name}_Primitive_${primitiveIndex}`;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      root.add(mesh);
    });
    return root;
  });

  const buildNode = (index) => {
    const definition = metadata.nodes[index];
    const object = definition.mesh == null ? new THREE.Group() : meshes[definition.mesh].clone(true);
    object.name = definition.name || `SuppliedJetwayNode_${index}`;
    applyNodeTransform(object, definition);
    for (const child of definition.children || []) object.add(buildNode(child));
    return object;
  };

  const model = buildNode(metadata.rootNode ?? 1);
  model.name = "SuppliedAirportJetway_SourceModel";
  model.updateMatrixWorld(true);

  const rotunda = objectBySourceName(model, "Rotunda");
  const cab = objectBySourceName(model, "Cab");
  if (!rotunda || !cab) throw new Error("Supplied jetway is missing its Rotunda or Cab source node");

  const modelBounds = new THREE.Box3().setFromObject(model);
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabCenter = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const sourceDirection = cabCenter.clone().sub(rotundaCenter);
  sourceDirection.y = 0;
  const rotundaToCabMeters = sourceDirection.length();
  if (rotundaToCabMeters < 0.1) throw new Error("Supplied jetway source axis could not be measured");
  sourceDirection.normalize();

  model.position.add(new THREE.Vector3(-rotundaCenter.x, -modelBounds.min.y, -rotundaCenter.z));
  const aligned = new THREE.Group();
  aligned.name = "SuppliedAirportJetway_RotundaOrigin_CabForward";
  aligned.rotation.y = -Math.atan2(sourceDirection.x, sourceDirection.z);
  aligned.add(model);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  aligned.userData.sourceAxis = [sourceDirection.x, sourceDirection.y, sourceDirection.z];
  aligned.userData.sourceRotundaCenter = rotundaCenter.toArray();
  aligned.userData.sourceCabCenter = cabCenter.toArray();
  aligned.userData.sourceRotundaToCabMeters = rotundaToCabMeters;
  aligned.userData.sourceBoundsMin = modelBounds.min.toArray();
  aligned.userData.sourceBoundsMax = modelBounds.max.toArray();
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
  batches.name = "SuppliedAirportJetway_StaticSourceInstances";
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
  let state = "loading-supplied-model";

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
      state = "supplied-model-ready";
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

  const ready = readPayload()
    .then((payload) => {
      const prototype = buildPrototype(THREE, payload);
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      fleet.userData.sourceGeometryOnly = true;
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
        anchor.userData.renderMode = placement.gate === "A1" ? "individual-source-model" : "static-source-instance-marker";
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
      group.userData.uploadedJetwayGlobalEdgeOverlayCount = 0;
      group.userData.sourceGeometryMode = MODEL_AUTHORITY;
      group.userData.visualAuthority = MODEL_AUTHORITY;
      group.userData.requiresOriginalSourceMesh = false;
      group.userData.facadeInfillCount = 0;
      group.userData.lowerFacadeFitCount = 0;
      group.userData.proceduralJetwayStairCount = 0;
      group.userData.proceduralJetwayObjectCount = 0;
      return {
        count: placements.length,
        modelCount: placements.length,
        authority: MODEL_AUTHORITY,
        staticGateCount: staticFleet.staticGateCount,
        individualModelCount,
        primitiveBatchCount: staticFleet.primitiveBatchCount,
      };
    })
    .catch((error) => {
      group.userData.uploadedJetwayLoadState = "error";
      group.userData.uploadedJetwayLoadError = error.message;
      console.error("Supplied airport jetway fleet failed to load", error);
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
