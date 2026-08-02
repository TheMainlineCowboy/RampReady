const DETAIL_POLISH_AUTHORITY = "a1-original-stair-bogie-readable-metal-and-sharp-edges-v1";

function cloneReadableMaterial(material, color, emissive, emissiveIntensity) {
  const readable = material.clone();
  readable.color.setHex(color);
  readable.roughness = 0.58;
  readable.metalness = 0.3;
  readable.emissive.setHex(emissive);
  readable.emissiveIntensity = emissiveIntensity;
  readable.flatShading = true;
  readable.needsUpdate = true;
  return readable;
}

function addSharpEdgeDefinition(THREE, mesh, name, color, opacity, thresholdAngle) {
  const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
  const material = new THREE.LineBasicMaterial({
    name: `${name} material`,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const lines = new THREE.LineSegments(edges, material);
  lines.name = name;
  lines.frustumCulled = mesh.frustumCulled;
  lines.renderOrder = 6;
  mesh.add(lines);
  return lines;
}

export function polishUploadedA1JetwayDetail(THREE, model) {
  const stair = model.getObjectByName("Tunnel_C_GalvanizedServiceStair_SourceTriangles");
  const mechanical = model.getObjectByName("Tunnel_C_DarkBogieLift_SourceTriangles");
  if (!stair?.isMesh || !mechanical?.isMesh) {
    throw new Error("Uploaded A1 source stair or bogie triangles are missing from the supplied model");
  }

  stair.material = cloneReadableMaterial(stair.material, 0xc7cbc9, 0x242827, 0.32);
  stair.material.name = "A1 supplied galvanized stair readable metal";
  stair.castShadow = false;
  stair.receiveShadow = true;
  addSharpEdgeDefinition(
    THREE,
    stair,
    "A1_SuppliedStair_SharpEdgeDefinition",
    0x50585b,
    0.72,
    24,
  );

  mechanical.material = cloneReadableMaterial(mechanical.material, 0x727b7f, 0x171a1b, 0.24);
  mechanical.material.name = "A1 supplied bogie and lift readable metal";
  mechanical.castShadow = false;
  mechanical.receiveShadow = true;
  addSharpEdgeDefinition(
    THREE,
    mechanical,
    "A1_SuppliedBogie_SharpEdgeDefinition",
    0x252a2c,
    0.62,
    32,
  );

  model.userData.a1SourceDetailPolishAuthority = DETAIL_POLISH_AUTHORITY;
  model.userData.a1SourceStairMeshCount = 1;
  model.userData.a1SourceBogieMeshCount = 1;
  model.userData.a1SourceDetailEdgeOverlayCount = 2;
  model.userData.a1SourceDetailGeometryReplaced = false;
  return {
    authority: DETAIL_POLISH_AUTHORITY,
    stairMeshCount: 1,
    bogieMeshCount: 1,
    edgeOverlayCount: 2,
    geometryReplaced: false,
  };
}

export { DETAIL_POLISH_AUTHORITY as A1_UPLOADED_JETWAY_DETAIL_POLISH_AUTHORITY };
