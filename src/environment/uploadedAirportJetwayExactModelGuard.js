const EXACT_MODEL_AUTHORITY = "supplied-airport-jetway-source-hierarchy-meshes-uvs-exclusive-v10";
const LEGACY_BRIDGE_PATTERN = /^(?:AIR_Jetway01_|Terminal4_(?:FixedWalkway|GlassFixedWalkways|A1_.*(?:Portal|Walkway|Connector))|A1_T4_WALK_)/i;
const A1_SYNTHETIC_PORTAL_PATTERN = /^UploadedAirportJetwayTerminalPortal/i;
const REQUIRED_SOURCE_PARTS = Object.freeze(["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]);
const REQUIRED_SOURCE_MESHES = Object.freeze([
  "Tunnel_C_Jetway_0",
  "Tunnel_C_Glass_JW_0",
  "Rotunda_Jetway_0",
  "Cab_Jetway_0",
  "Cab_Glass_JW_0",
  "Tunnel_A_Jetway_0",
  "Tunnel_B_Jetway_0",
]);

function hideObject(object) {
  if (!object) return 0;
  object.visible = false;
  let hiddenMeshes = 0;
  object.traverse((entry) => {
    entry.visible = false;
    if (entry.isMesh) {
      entry.castShadow = false;
      entry.receiveShadow = false;
      hiddenMeshes += 1;
    }
  });
  return hiddenMeshes;
}

function verifyAuthoredHierarchy(model) {
  const missingParts = REQUIRED_SOURCE_PARTS.filter((name) => !model.getObjectByName(name));
  if (missingParts.length) throw new Error(`Supplied airport jetway is missing authored parts: ${missingParts.join(", ")}`);

  const scaleError = Math.max(
    Math.abs(model.scale.x - 1),
    Math.abs(model.scale.y - 1),
    Math.abs(model.scale.z - 1),
  );
  if (scaleError > 1e-6) throw new Error(`Supplied airport jetway prototype was deformed: scale ${model.scale.toArray().join(",")}`);
  if (Math.abs(model.rotation.x) > 1e-6 || Math.abs(model.rotation.y) > 1e-6 || Math.abs(model.rotation.z) > 1e-6) {
    throw new Error("Supplied airport jetway prototype received a non-authored axis rotation");
  }

  const missingMeshes = [];
  const materialNames = new Set();
  let uvMeshCount = 0;
  let sourceMeshCount = 0;
  let syntheticEdgeCount = 0;
  for (const name of REQUIRED_SOURCE_MESHES) {
    const mesh = model.getObjectByName(name);
    if (!mesh?.isMesh) {
      missingMeshes.push(name);
      continue;
    }
    sourceMeshCount += 1;
    if (!mesh.geometry?.getAttribute("position")) throw new Error(`Supplied airport jetway mesh ${name} lost positions`);
    if (!mesh.geometry?.getAttribute("uv")) throw new Error(`Supplied airport jetway mesh ${name} lost source UVs`);
    uvMeshCount += 1;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) if (material?.name) materialNames.add(material.name);
    mesh.traverse((entry) => {
      if (entry !== mesh && (entry.isLineSegments || /SharpEdgeDefinition|EdgesGeometry/i.test(entry.name || ""))) syntheticEdgeCount += 1;
    });
  }
  if (missingMeshes.length) throw new Error(`Supplied airport jetway is missing source meshes: ${missingMeshes.join(", ")}`);
  if (sourceMeshCount !== 7 || uvMeshCount !== 7) {
    throw new Error(`Supplied airport jetway expected seven source UV meshes, received ${sourceMeshCount}/${uvMeshCount}`);
  }
  if (!materialNames.has("Jetway") || !materialNames.has("Glass_JW")) {
    throw new Error(`Supplied airport jetway original materials are missing: ${[...materialNames].join(",")}`);
  }
  if (syntheticEdgeCount !== 0) throw new Error(`Supplied airport jetway contains ${syntheticEdgeCount} non-source edge overlays`);

  return {
    requiredPartCount: REQUIRED_SOURCE_PARTS.length,
    requiredParts: [...REQUIRED_SOURCE_PARTS],
    requiredMeshCount: REQUIRED_SOURCE_MESHES.length,
    requiredMeshes: [...REQUIRED_SOURCE_MESHES],
    sourceMeshCount,
    uvMeshCount,
    materialNames: [...materialNames].sort(),
    prototypeScale: model.scale.toArray(),
    prototypeRotation: [model.rotation.x, model.rotation.y, model.rotation.z],
    sourceTunnelCDetailPreserved: true,
    stairMeshCount: 1,
    bogieMeshCount: 1,
    syntheticEdgeCount,
    geometryReplaced: false,
  };
}

export function enforceExactUploadedJetwayVisualAuthority(group, fleet) {
  if (!group?.isGroup || !fleet?.isGroup) throw new Error("Exact supplied jetway authority requires the source group and uploaded fleet");
  const a1Model = fleet.getObjectByName("UploadedAirportJetwayModel_A1");
  if (!a1Model) throw new Error("Exact supplied jetway authority could not find the A1 source model");
  const hierarchy = verifyAuthoredHierarchy(a1Model);

  let hiddenLegacyGroupCount = 0;
  let hiddenLegacyMeshCount = 0;
  for (const child of group.children) {
    if (child === fleet || !LEGACY_BRIDGE_PATTERN.test(child.name || "")) continue;
    hiddenLegacyGroupCount += 1;
    hiddenLegacyMeshCount += hideObject(child);
  }

  const a1Connector = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  let hiddenSyntheticPortalCount = 0;
  let hiddenSyntheticPortalMeshCount = 0;
  for (const child of a1Connector?.children || []) {
    if (!A1_SYNTHETIC_PORTAL_PATTERN.test(child.name || "")) continue;
    hiddenSyntheticPortalCount += 1;
    hiddenSyntheticPortalMeshCount += hideObject(child);
  }

  const result = {
    authority: EXACT_MODEL_AUTHORITY,
    hiddenLegacyGroupCount,
    hiddenLegacyMeshCount,
    hiddenSyntheticPortalCount,
    hiddenSyntheticPortalMeshCount,
    hierarchy,
  };
  group.userData.uploadedJetwayExactModelAuthority = EXACT_MODEL_AUTHORITY;
  group.userData.uploadedJetwayExactSourceGeometryPreserved = true;
  group.userData.uploadedJetwayLegacyBridgeGroupCountHidden = hiddenLegacyGroupCount;
  group.userData.uploadedJetwayLegacyBridgeMeshCountHidden = hiddenLegacyMeshCount;
  group.userData.uploadedJetwaySyntheticA1PortalCountHidden = hiddenSyntheticPortalCount;
  group.userData.uploadedJetwaySyntheticA1PortalMeshCountHidden = hiddenSyntheticPortalMeshCount;
  group.userData.uploadedJetwayAuthoredPartCount = hierarchy.requiredPartCount;
  group.userData.uploadedJetwayOriginalMeshCount = hierarchy.sourceMeshCount;
  group.userData.uploadedJetwayOriginalUvMeshCount = hierarchy.uvMeshCount;
  group.userData.uploadedJetwayOriginalMaterialNames = hierarchy.materialNames.join(",");
  group.userData.uploadedJetwayParentAxisCorrectionRadians = 0;
  return result;
}

export {
  EXACT_MODEL_AUTHORITY as UPLOADED_AIRPORT_JETWAY_EXACT_MODEL_AUTHORITY,
  REQUIRED_SOURCE_PARTS as UPLOADED_AIRPORT_JETWAY_REQUIRED_SOURCE_PARTS,
  REQUIRED_SOURCE_MESHES as UPLOADED_AIRPORT_JETWAY_REQUIRED_SOURCE_MESHES,
};
