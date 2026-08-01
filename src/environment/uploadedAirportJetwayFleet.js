import { addUploadedAirportJetwayTerminalConnector } from "./uploadedAirportJetwayTerminalConnector.js";

const PART_COUNT = 5;
const MODEL_AUTHORITY = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured";
const MATERIAL_AUTHORITY = "exact-M1DGJETWAY-corrugated-band-projected-onto-user-model-v2";
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
  // The exact M1DGJETWAY atlas stores the long corrugated tunnel skin in the
  // bottom 28.5 percent. Project only that authored band across the uploaded
  // model instead of stretching the complete door/bellows atlas over it.
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
  body.userData.materialAuthority = bodyMap ? MATERIAL_AUTHORITY : "uploaded-model-neutral-material-fallback";
  glass.userData.materialAuthority = "uploaded-model-physical-blue-gray-glass-v2";
  return { body, glass };
}

function decodePrimitive(THREE, primitive, binary, materials) {
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

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  indexed.setIndex(new THREE.BufferAttribute(indices, 1));
  const geometry = addProjectedUvs(THREE, indexed);
  indexed.dispose();
  const mesh = new THREE.Mesh(geometry, materials[primitive.material] || materials[0]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
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

function addStructuralEdges(THREE, model) {
  const edgeMaterial = new THREE.LineBasicMaterial({
    name: "Uploaded airport jetway structural edge definition",
    color: 0x4a5053,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    toneMapped: false,
  });
  const meshes = [];
  model.traverse((entry) => {
    if (entry.isMesh && !entry.material?.transparent) meshes.push(entry);
  });
  for (const mesh of meshes) {
    const edgeGeometry = new THREE.EdgesGeometry(mesh.geometry, 34);
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.name = `${mesh.name || "UploadedJetwayMesh"}_StructuralEdges`;
    edges.renderOrder = 3;
    mesh.add(edges);
  }
  return meshes.length;
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
      root.add(decodePrimitive(THREE, primitive, binary, materials));
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
  const structuralEdgeMeshCount = addStructuralEdges(THREE, model);
  const aligned = new THREE.Group();
  aligned.name = "UploadedAirportJetway_AlignedPrototype";
  // The supplied model's rotunda pivot is at approximately (-0.652, 4.12, -15.12).
  // Translate that authored pivot to the package gate origin without changing airport placement.
  model.position.set(0.651626, 0.23, 15.12);
  aligned.add(model);
  aligned.userData.modelAuthority = MODEL_AUTHORITY;
  aligned.userData.materialAuthority = sourceMaterials.body.userData.materialAuthority;
  aligned.userData.structuralEdgeMeshCount = structuralEdgeMeshCount;
  return aligned;
}

function createController() {
  let deployment = 1;
  let visual = null;
  let state = "loading-uploaded-model";

  const apply = () => {
    if (!visual) return;
    const retract = 1 - deployment;
    const { anchor, nodes, base } = visual;
    anchor.rotation.y = base.yaw - retract * 0.105;
    if (nodes.tunnelB) nodes.tunnelB.position.z = base.tunnelB.z - retract * 1.1;
    if (nodes.tunnelC) nodes.tunnelC.position.z = base.tunnelC.z - retract * 2.25;
    if (nodes.cab) {
      nodes.cab.position.z = base.cab.z - retract * 3.85;
      nodes.cab.position.y = base.cab.y + retract * 0.16;
    }
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
  group.userData.uploadedJetwayExpectedCount = placements.length;

  readPayload()
    .then((payload) => {
      const prototype = buildPrototype(THREE, payload, sourceTextures);
      const fleet = new THREE.Group();
      fleet.name = "UploadedAirportJetwayFleet";
      for (const placement of placements) {
        const anchor = new THREE.Group();
        anchor.name = `UploadedAirportJetway_${placement.gate}`;
        anchor.position.set(placement.x, 0, placement.z);
        anchor.rotation.y = placement.yaw;
        const model = prototype.clone(true);
        model.name = `UploadedAirportJetwayModel_${placement.gate}`;
        anchor.add(model);
        fleet.add(anchor);
        addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement);
        if (placement.gate === "A1") controller.bind(anchor);
      }
      group.add(fleet);
      const hiddenGeneratedObjectCount = hideGeneratedJetways(group);
      group.userData.uploadedJetwayLoadState = "ready";
      group.userData.uploadedJetwayCount = placements.length;
      group.userData.uploadedJetwayMeasuredTerminalConnectorCount = placements.length;
      group.userData.uploadedJetwayHiddenGeneratedObjectCount = hiddenGeneratedObjectCount;
      group.userData.uploadedJetwayTerminalConnectorPreserved = true;
      group.userData.uploadedJetwayMaterialAuthority = prototype.userData.materialAuthority;
      group.userData.uploadedJetwayStructuralEdgeMeshCount = prototype.userData.structuralEdgeMeshCount;
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
