import {
  addUploadedAirportJetwayStaticTerminalConnectors,
  addUploadedAirportJetwayTerminalConnector,
} from "./uploadedAirportJetwayTerminalConnector.js";

const MODEL_AUTHORITY = "supplied-airport-jetway-source-triangles-hierarchy-submillimeter-v4";
const MATERIAL_AUTHORITY = "supplied-airport-jetway-source-atlas-full-resolution-avif-v4";
const PERFORMANCE_AUTHORITY = "57-static-source-mesh-instances-plus-1-animated-a1-v4";
const A1_RETRACTION_AUTHORITY = "source-node-telescoping-without-height-correction-v7";
const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });
const HIDE_REPLACED = /^(?:AIR_Jetway01_(?!WallCollars)|Terminal4_LowerFacadeInfillPanels|Terminal4_ClosedServiceDoors|Terminal4_FacadeVentGrilles)/i;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function sourceRootUrl() {
  return `${import.meta.env.BASE_URL || "/"}models/airport-jetway/source/`;
}

function readSlice(binary, range) {
  const [offset, length] = range;
  return binary.subarray(offset, offset + length);
}

function decodeDeltaVarint(bytes, count) {
  const values = new Uint32Array(count);
  let cursor = 0;
  let previous = 0;
  for (let index = 0; index < count; index += 1) {
    let encoded = 0;
    let shift = 0;
    while (true) {
      if (cursor >= bytes.length || shift > 35) throw new Error("Supplied jetway index stream is truncated");
      const byte = bytes[cursor++];
      encoded |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    const delta = (encoded >>> 1) ^ -(encoded & 1);
    previous += delta;
    if (previous < 0) throw new Error("Supplied jetway index stream decoded a negative vertex index");
    values[index] = previous;
  }
  if (cursor !== bytes.length) throw new Error("Supplied jetway index stream contains trailing bytes");
  return values;
}

function decodeOctNormal(xByte, yByte) {
  let x = Math.max(-1, xByte / 127);
  let y = Math.max(-1, yByte / 127);
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const oldX = x;
    const oldY = y;
    x = (1 - Math.abs(oldY)) * (oldX >= 0 ? 1 : -1);
    y = (1 - Math.abs(oldX)) * (oldY >= 0 ? 1 : -1);
  }
  const inverseLength = 1 / Math.max(1e-12, Math.hypot(x, y, z));
  return [x * inverseLength, y * inverseLength, z * inverseLength];
}

function decodeGeometry(THREE, definition, binary) {
  const count = definition.count;
  const positionBytes = readSlice(binary, definition.positions);
  const normalBytes = readSlice(binary, definition.normalsOct);
  const uvBytes = readSlice(binary, definition.uvs);
  const positionView = new DataView(positionBytes.buffer, positionBytes.byteOffset, positionBytes.byteLength);
  const uvView = new DataView(uvBytes.buffer, uvBytes.byteOffset, uvBytes.byteLength);
  const normalView = new Int8Array(normalBytes.buffer, normalBytes.byteOffset, normalBytes.byteLength);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);

  for (let vertex = 0; vertex < count; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const quantized = positionView.getUint16((vertex * 3 + axis) * 2, true);
      positions[vertex * 3 + axis] = definition.positionMin[axis]
        + (quantized / 65535) * definition.positionSpan[axis];
    }
    normals.set(decodeOctNormal(normalView[vertex * 2], normalView[vertex * 2 + 1]), vertex * 3);
    for (let axis = 0; axis < 2; axis += 1) {
      const quantized = uvView.getUint16((vertex * 2 + axis) * 2, true);
      uvs[vertex * 2 + axis] = definition.uvMin[axis]
        + (quantized / 65535) * definition.uvSpan[axis];
    }
  }

  const decodedIndices = decodeDeltaVarint(readSlice(binary, definition.indicesDeltaVarint), definition.indexCount);
  let maximumIndex = 0;
  for (const value of decodedIndices) maximumIndex = Math.max(maximumIndex, value);
  if (maximumIndex >= count) throw new Error(`${definition.name} decoded index ${maximumIndex} beyond ${count} vertices`);
  const indices = maximumIndex < 65536 ? new Uint16Array(decodedIndices) : decodedIndices;
  const geometry = new THREE.BufferGeometry();
  geometry.name = `${definition.name}_SuppliedSourceGeometry`;
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  const uvAttribute = new THREE.BufferAttribute(uvs, 2);
  geometry.setAttribute("uv", uvAttribute);
  geometry.setAttribute("uv1", uvAttribute.clone());
  geometry.setAttribute("uv2", uvAttribute.clone());
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sourceVertexCount = definition.sourceCount;
  geometry.userData.storedVertexCount = definition.count;
  geometry.userData.sourceTriangleCount = definition.indexCount / 3;
  geometry.userData.maximumPositionErrorMeters = 0.00009584426879882812;
  geometry.userData.maximumUvError = 0.00000762939453125;
  return geometry;
}

async function loadTextures(THREE, descriptor, rootUrl) {
  const loader = new THREE.TextureLoader();
  const images = await Promise.all(descriptor.images.map(async (image) => {
    const texture = await loader.loadAsync(`${rootUrl}${image.uri}`);
    texture.name = image.name;
    texture.flipY = false;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 8;
    texture.colorSpace = /albedo|emissive/i.test(image.name) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    return texture;
  }));
  return descriptor.textures.map((textureDefinition) => {
    const sourceIndex = textureDefinition.extensions?.EXT_texture_avif?.source;
    if (!Number.isInteger(sourceIndex) || !images[sourceIndex]) {
      throw new Error("Supplied jetway texture descriptor has an invalid AVIF source");
    }
    return images[sourceIndex];
  });
}

function createSourceMaterials(THREE, descriptor, textures) {
  return descriptor.materials.map((definition) => {
    const pbr = definition.pbrMetallicRoughness || {};
    const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
    const textureAt = (slot) => Number.isInteger(slot?.index) ? textures[slot.index] : null;
    const common = {
      name: definition.name,
      color: new THREE.Color(baseColor[0], baseColor[1], baseColor[2]),
      opacity: baseColor[3] ?? 1,
      transparent: definition.alphaMode === "BLEND" || (baseColor[3] ?? 1) < 1,
      side: definition.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
      roughness: pbr.roughnessFactor ?? 1,
      metalness: pbr.metallicFactor ?? 1,
      map: textureAt(pbr.baseColorTexture),
      normalMap: textureAt(definition.normalTexture),
      aoMap: textureAt(definition.occlusionTexture),
    };
    const packedMetalRoughness = textureAt(pbr.metallicRoughnessTexture);
    if (packedMetalRoughness) {
      common.metalnessMap = packedMetalRoughness;
      common.roughnessMap = packedMetalRoughness;
    }
    const material = new THREE.MeshStandardMaterial(common);
    const emissiveFactor = definition.emissiveFactor || [0, 0, 0];
    material.emissive.setRGB(...emissiveFactor);
    material.emissiveMap = textureAt(definition.emissiveTexture);
    material.depthWrite = !material.transparent;
    material.userData.materialAuthority = MATERIAL_AUTHORITY;
    return material;
  });
}

function applyNodeTransform(object, definition) {
  if (Array.isArray(definition.matrix) && definition.matrix.length === 16) {
    object.matrix.fromArray(definition.matrix);
    object.matrix.decompose(object.position, object.quaternion, object.scale);
    return;
  }
  if (definition.translation) object.position.fromArray(definition.translation);
  if (definition.rotation) object.quaternion.fromArray(definition.rotation);
  if (definition.scale) object.scale.fromArray(definition.scale);
}

function buildSourceHierarchy(THREE, metadata, geometries, materials) {
  const buildNode = (index) => {
    const definition = metadata.nodes[index];
    const object = definition.mesh == null
      ? new THREE.Group()
      : new THREE.Mesh(geometries[definition.mesh], materials[metadata.meshes[definition.mesh].material]);
    object.name = definition.name || `SuppliedJetwayNode_${index}`;
    if (object.isMesh) {
      object.castShadow = false;
      object.receiveShadow = true;
    }
    applyNodeTransform(object, definition);
    for (const childIndex of definition.children || []) object.add(buildNode(childIndex));
    return object;
  };
  const scene = new THREE.Group();
  scene.name = metadata.scenes?.[metadata.scene || 0]?.name || "Airport_Jetway_SourceScene";
  for (const rootIndex of metadata.scenes?.[metadata.scene || 0]?.nodes || []) scene.add(buildNode(rootIndex));
  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedSourcePrototype";
  scene.position.set(0.651626, 0.23, 15.12);
  aligned.add(scene);
  aligned.updateMatrixWorld(true);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = MATERIAL_AUTHORITY;
  aligned.userData.performanceAuthority = PERFORMANCE_AUTHORITY;
  aligned.userData.sourceTriangleCount = metadata.validation?.triangleCount;
  aligned.userData.maximumPositionErrorMeters = metadata.validation?.maxPositionAbsErrorMeters;
  aligned.userData.maximumUvError = metadata.validation?.maxUvAbsError;
  return aligned;
}

async function loadSourcePrototype(THREE) {
  const rootUrl = sourceRootUrl();
  const [geometryResponse, materialsResponse] = await Promise.all([
    fetch(`${rootUrl}geometry.bin`, { cache: "force-cache" }),
    fetch(`${rootUrl}materials.json`, { cache: "force-cache" }),
  ]);
  if (!geometryResponse.ok) throw new Error(`Supplied jetway geometry failed: ${geometryResponse.status}`);
  if (!materialsResponse.ok) throw new Error(`Supplied jetway materials failed: ${materialsResponse.status}`);
  const payload = new Uint8Array(await geometryResponse.arrayBuffer());
  const metadataLength = new DataView(payload.buffer, payload.byteOffset, 4).getUint32(0, true);
  const metadata = JSON.parse(new TextDecoder().decode(payload.subarray(4, 4 + metadataLength)));
  const binary = payload.subarray(4 + metadataLength);
  const descriptor = await materialsResponse.json();
  if (metadata.version !== 2 || metadata.meshes?.length !== 7 || metadata.validation?.triangleCount !== 31978) {
    throw new Error("Supplied jetway compact source metadata failed its topology contract");
  }
  const textures = await loadTextures(THREE, descriptor, rootUrl);
  const materials = createSourceMaterials(THREE, descriptor, textures);
  const geometries = metadata.meshes.map((definition) => decodeGeometry(THREE, definition, binary));
  const prototype = buildSourceHierarchy(THREE, metadata, geometries, materials);
  const requiredNodes = ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"];
  const requiredMeshes = [
    "Tunnel_C_Jetway_0", "Tunnel_C_Glass_JW_0", "Rotunda_Jetway_0",
    "Cab_Jetway_0", "Cab_Glass_JW_0", "Tunnel_A_Jetway_0", "Tunnel_B_Jetway_0",
  ];
  const missing = [...requiredNodes, ...requiredMeshes].filter((name) => !prototype.getObjectByName(name));
  if (missing.length) throw new Error(`Supplied Airport Jetway hierarchy is missing: ${missing.join(", ")}`);
  return prototype;
}

function collectPrototypeMeshes(prototype) {
  prototype.updateMatrixWorld(true);
  const meshes = [];
  prototype.traverse((entry) => {
    if (!entry.isMesh) return;
    meshes.push({ name: entry.name, geometry: entry.geometry, material: entry.material, localMatrix: entry.matrixWorld.clone() });
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
      group.userData.uploadedJetwaySourceTriangleCount = prototype.userData.sourceTriangleCount;
      group.userData.uploadedJetwayMaximumPositionErrorMeters = prototype.userData.maximumPositionErrorMeters;
      group.userData.uploadedJetwayMaximumUvError = prototype.userData.maximumUvError;
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
