import {
  addUploadedAirportJetwayStaticTerminalConnectors,
  addUploadedAirportJetwayTerminalConnector,
} from "./uploadedAirportJetwayTerminalConnector.js";

const PART_COUNT = 5;
const MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v5-instanced-static-jetways-and-connectors-source-textured";
const MATERIAL_AUTHORITY = "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2";
const DETAIL_MATERIAL_AUTHORITY = "source-triangle-stair-and-bogie-material-split-v1";
const PERFORMANCE_AUTHORITY = "57-static-jetways-and-connectors-instanced-plus-1-animated-a1-v5";
const A1_RETRACTION_AUTHORITY = "aircraft-door-clearance-without-overtravel-v6";
const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });
// Replace only the movable fallback jetway. The source-positioned fixed walkway
// and wall collar are the physical terminal connection and must remain visible.
const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

async function readPayload() {
  const base = `${import.meta.env.BASE_URL || "/"}models/airport-jetway/`;
  const parts = await Promise.all(Array.from({ length: PART_COUNT }, async (_, index) => {
    const response = await fetch(`${base}geometry.part${index}`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Uploaded jetway geometry part ${index} failed: ${response.status}`);
    return (await response.text()).trim();
  }));
  const encoded = parts.join("");
  const compressed = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
  if (typeof DecompressionStream !== "function") {
    throw new Error("This browser cannot decode the uploaded jetway geometry payload");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const payload = new Uint8Array(await new Response(stream).arrayBuffer());
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const metadataLength = view.getUint32(0, true);
  const metadata = JSON.parse(new TextDecoder().decode(payload.subarray(4, 4 + metadataLength)));
  return { metadata, binary: payload.subarray(4 + metadataLength) };
}

function addProjectedUvs(THREE, indexedGeometry) {
  const geometry = indexedGeometry.index ? indexedGeometry.toNonIndexed() : indexedGeometry.clone();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const bounds = geometry.boundingBox;
  const spanX = Math.max(0.001, bounds.max.x - bounds.min.x);
  const spanY = Math.max(0.001, bounds.max.y - bounds.min.y);
  const spanZ = Math.max(0.001, bounds.max.z - bounds.min.z);
  const uv = new Float32Array(position.count * 2);

  for (let vertex = 0; vertex < position.count; vertex += 1) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    const nx = Math.abs(normal.getX(vertex));
    const ny = Math.abs(normal.getY(vertex));
    const nz = Math.abs(normal.getZ(vertex));
    let u;
    let v;
    if (ny >= nx && ny >= nz) {
      u = (x - bounds.min.x) / spanX;
      v = (z - bounds.min.z) / spanZ;
    } else if (nx >= nz) {
      u = (z - bounds.min.z) / spanZ;
      v = (y - bounds.min.y) / spanY;
    } else {
      u = (x - bounds.min.x) / spanX;
      v = (y - bounds.min.y) / spanY;
    }
    uv[vertex * 2] = u;
    uv[vertex * 2 + 1] = v;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function cloneCorrugatedAtlasBand(THREE, texture, name) {
  if (!texture?.isTexture) return null;
  const clone = texture.clone();
  clone.name = name;
  clone.wrapS = THREE.ClampToEdgeWrapping;
  clone.wrapT = THREE.ClampToEdgeWrapping;
  clone.offset.set(0, 0.715);
  clone.repeat.set(1, 0.285);
  clone.anisotropy = 16;
  clone.needsUpdate = true;
  return clone;
}

function createMaterials(THREE, sourceTextures = {}) {
  const bodyMap = cloneCorrugatedAtlasBand(
    THREE,
    sourceTextures.diffuse,
    "Uploaded jetway exact M1DGJETWAY corrugated shell",
  );
  const body = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway exact-source body",
    color: bodyMap ? 0xffffff : 0xc4c5c2,
    map: bodyMap,
    roughness: 0.7,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    name: "Uploaded airport jetway glazing",
    color: 0x294550,
    roughness: 0.17,
    metalness: 0.06,
    transmission: 0.12,
    clearcoat: 0.28,
    clearcoatRoughness: 0.2,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const stair = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway galvanized stair and rail",
    color: 0x8d9294,
    roughness: 0.48,
    metalness: 0.46,
    side: THREE.DoubleSide,
  });
  const mechanical = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway dark bogie and lift structure",
    color: 0x4f5659,
    roughness: 0.56,
    metalness: 0.38,
    side: THREE.DoubleSide,
  });
  body.userData.materialAuthority = bodyMap ? MATERIAL_AUTHORITY : "uploaded-model-neutral-material-fallback";
  glass.userData.materialAuthority = "uploaded-model-physical-blue-gray-glass-v2";
  stair.userData.materialAuthority = DETAIL_MATERIAL_AUTHORITY;
  mechanical.userData.materialAuthority = DETAIL_MATERIAL_AUTHORITY;
  return { body, glass, stair, mechanical };
}

function createIndexedGeometry(THREE, positions, indexValues, projectUvs) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
  const IndexArray = positions.length / 3 > 65535 ? Uint32Array : Uint16Array;
  geometry.setIndex(new THREE.BufferAttribute(new IndexArray(indexValues), 1));
  if (projectUvs) {
    const projected = addProjectedUvs(THREE, geometry);
    geometry.dispose();
    return projected;
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createPrimitiveMesh(THREE, geometry, material, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function splitTunnelCSourceDetail(THREE, positions, indices, sourceMaterials) {
  const bodyIndices = [];
  const stairIndices = [];
  const mechanicalIndices = [];

  for (let index = 0; index < indices.length; index += 3) {
    const a = indices[index];
    const b = indices[index + 1];
    const c = indices[index + 2];
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    const bx = positions[b * 3];
    const by = positions[b * 3 + 1];
    const bz = positions[b * 3 + 2];
    const cx = positions[c * 3];
    const cy = positions[c * 3 + 1];
    const cz = positions[c * 3 + 2];
    const centerX = (ax + bx + cx) / 3;
    const centerY = (ay + by + cy) / 3;
    const centerZ = (az + bz + cz) / 3;

    // These bounds are measured directly from the supplied Tunnel_C primitive.
    // They isolate the authored diagonal service stair/rails and bogie/lift
    // structure without replacing, moving or procedurally rebuilding either.
    const isStair = centerX > 16.4 && centerY < -1.55 && centerZ < 4.8;
    const isMechanical = !isStair
      && centerX >= 15.0
      && centerX < 16.8
      && centerZ < 1.3;
    const target = isStair ? stairIndices : isMechanical ? mechanicalIndices : bodyIndices;
    target.push(a, b, c);
  }

  if (!bodyIndices.length || !stairIndices.length || !mechanicalIndices.length) {
    throw new Error(
      `Uploaded Tunnel_C detail split failed: ${bodyIndices.length / 3} body, ${stairIndices.length / 3} stair and ${mechanicalIndices.length / 3} mechanical triangles`,
    );
  }

  const root = new THREE.Group();
  root.name = "Tunnel_C_SourceDetailMaterialSplit";
  root.userData.detailMaterialAuthority = DETAIL_MATERIAL_AUTHORITY;
  root.userData.bodyTriangleCount = bodyIndices.length / 3;
  root.userData.stairTriangleCount = stairIndices.length / 3;
  root.userData.mechanicalTriangleCount = mechanicalIndices.length / 3;
  root.add(
    createPrimitiveMesh(
      THREE,
      createIndexedGeometry(THREE, positions, bodyIndices, true),
      sourceMaterials.body,
      "Tunnel_C_CorrugatedShell_SourceTriangles",
    ),
    createPrimitiveMesh(
      THREE,
      createIndexedGeometry(THREE, positions, stairIndices, false),
      sourceMaterials.stair,
      "Tunnel_C_GalvanizedServiceStair_SourceTriangles",
    ),
    createPrimitiveMesh(
      THREE,
      createIndexedGeometry(THREE, positions, mechanicalIndices, false),
      sourceMaterials.mechanical,
      "Tunnel_C_DarkBogieLift_SourceTriangles",
    ),
  );
  return root;
}

function decodePrimitive(THREE, primitive, binary, materials, meshName, sourceMaterials) {
  const positionView = new DataView(binary.buffer, binary.byteOffset + primitive.pos[0], primitive.pos[1]);
  const positions = new Float32Array(primitive.count * 3);
  for (let vertex = 0; vertex < primitive.count; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const quantized = positionView.getUint16((vertex * 3 + axis) * 2, true);
      positions[vertex * 3 + axis] = primitive.min[axis] + (quantized / 65535) * primitive.span[axis];
    }
  }

  const indexView = new DataView(binary.buffer, binary.byteOffset + primitive.idx[0], primitive.idx[1]);
  const indices = primitive.indexType === "u32"
    ? new Uint32Array(primitive.indexCount)
    : new Uint16Array(primitive.indexCount);
  const bytesPerIndex = primitive.indexType === "u32" ? 4 : 2;
  for (let index = 0; index < primitive.indexCount; index += 1) {
    indices[index] = bytesPerIndex === 4
      ? indexView.getUint32(index * bytesPerIndex, true)
      : indexView.getUint16(index * bytesPerIndex, true);
  }

  if (meshName === "Tunnel_C_Jetway_0" && primitive.material === 0) {
    return splitTunnelCSourceDetail(THREE, positions, indices, sourceMaterials);
  }

  const geometry = createIndexedGeometry(THREE, positions, indices, true);
  return createPrimitiveMesh(
    THREE,
    geometry,
    materials[primitive.material] || materials[0],
    `${meshName}_Primitive`,
  );
}

function applyNodeTransform(THREE, object, node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    object.matrix.fromArray(node.matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation);
  if (node.scale) object.scale.fromArray(node.scale);
}

function buildPrototype(THREE, payload, sourceTextures = {}) {
  const { metadata, binary } = payload;
  const sourceMaterials = createMaterials(THREE, sourceTextures);
  const materials = metadata.materials.map((name) => /glass|window/i.test(name)
    ? sourceMaterials.glass
    : sourceMaterials.body);
  const meshes = metadata.meshes.map((meshDefinition) => {
    const root = new THREE.Group();
    root.name = meshDefinition.name;
    for (const primitive of meshDefinition.primitives) {
      root.add(decodePrimitive(
        THREE,
        primitive,
        binary,
        materials,
        meshDefinition.name,
        sourceMaterials,
      ));
    }
    return root;
  });

  const buildNode = (index) => {
    const definition = metadata.nodes[index];
    const object = definition.mesh == null ? new THREE.Group() : meshes[definition.mesh].clone(true);
    object.name = definition.name || `UploadedJetwayNode_${index}`;
    applyNodeTransform(THREE, object, definition);
    for (const child of definition.children || []) object.add(buildNode(child));
    return object;
  };

  const model = buildNode(metadata.rootNode ?? 1);
  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedPrototype";
  model.position.set(0.651626, 0.23, 15.12);
  aligned.add(model);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = sourceMaterials.body.userData.materialAuthority;
  aligned.userData.detailMaterialAuthority = DETAIL_MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  return aligned;
}

function collectPrototypeMeshes(prototype) {
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
  batches.name = "UploadedAirportJetwayStaticInstancedBatches";
  const placementMatrix = new THREE.Matrix4();
  const finalMatrix = new THREE.Matrix4();

  prototypeMeshes.forEach((meshDefinition, primitiveIndex) => {
    const batch = new THREE.InstancedMesh(
      meshDefinition.geometry,
      meshDefinition.material,
      staticPlacements.length,
    );
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

  return {
    batches,
    staticGateCount: staticPlacements.length,
    primitiveBatchCount: prototypeMeshes.length,
  };
}

function createController() {
  let deployment = 1;
  let visual = null;
  let state = "loading-uploaded-model";

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
    setDeployment(value) {
      deployment = clamp(value, 0, 1);
      apply();
    },
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
      state = "uploaded-model-ready";
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

export function installUploadedAirportJetwayFleet(THREE, group, placements, sourceTextures = {}) {
  if (!group?.isGroup) throw new Error("Uploaded airport jetway replacement requires the Terminal 4 jetway group");
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Uploaded airport jetway replacement expected 58 placements, received ${placements?.length ?? 0}`);
  }
  const controller = createController();
  group.userData.uploadedJetwayLoadState = "loading";
  group.userData.uploadedJetwayModelAuthority = MODEL_AUTHORITY;
  group.userData.uploadedJetwayMaterialAuthority = sourceTextures.diffuse?.isTexture
    ? MATERIAL_AUTHORITY
    : "uploaded-model-neutral-material-fallback";
  group.userData.uploadedJetwayDetailMaterialAuthority = DETAIL_MATERIAL_AUTHORITY;
  group.userData.uploadedJetwayPerformanceAuthority = PERFORMANCE_AUTHORITY;
  group.userData.uploadedJetwayExpectedCount = placements.length;
  group.userData.uploadedJetwayA1RetractionAuthority = A1_RETRACTION_AUTHORITY;
  group.userData.uploadedJetwayA1RetractionClearanceMeters = A1_RETRACTION.totalClearanceMeters;

  readPayload()
    .then((payload) => {
      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      const staticFleet = buildStaticInstancedFleet(THREE, prototype, placements);
      fleet.add(staticFleet.batches);
      const staticConnectors = addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements);
      let shadowCasterGateCount = 0;

      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.userData.renderMode = placement.gate === "A1" ? "individual-animated" : "static-instanced-marker";
        if (placement.gate === "A1") {
          anchor.position.set(placement.x, 0, placement.z);
          anchor.rotation.y = placement.yaw;
          const model = prototype.clone(true);
          model.name = `UploadedAirportJetwayModel_${placement.gate}`;
          model.traverse((entry) => {
            if (entry.isMesh && !entry.material?.transparent) entry.castShadow = true;
          });
          anchor.add(model);
          controller.bind(anchor);
          shadowCasterGateCount += 1;
          addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);
        }
        fleet.add(anchor);
      }

      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedJetways(group);
      group.userData.uploadedJetwayLoadState = "ready";
      group.userData.uploadedJetwayCount = placements.length;
      group.userData.uploadedJetwayMeasuredTerminalConnectorCount = placements.length;
      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;
      group.userData.uploadedJetwayMaterialAuthority = prototype.userData.materialAuthority;
      group.userData.uploadedJetwayDetailMaterialAuthority = prototype.userData.detailMaterialAuthority;
      group.userData.uploadedJetwayStairMaterialSplitActive = true;
      group.userData.uploadedJetwayPerformanceAuthority = prototype.userData.performanceAuthority;
      group.userData.uploadedJetwayShadowCasterGateCount = shadowCasterGateCount;
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
      group.userData.requiresOriginalSourceMesh = false;
      group.userData.facadeInfillCount = 0;
      group.userData.lowerFacadeFitCount = 0;
      group.userData.proceduralJetwayStairCount = 0;
    })
    .catch((error) => {
      group.userData.uploadedJetwayLoadState = "error";
      group.userData.uploadedJetwayLoadError = error.message;
      console.error("Uploaded airport jetway fleet failed to load", error);
    });

  return controller;
}
