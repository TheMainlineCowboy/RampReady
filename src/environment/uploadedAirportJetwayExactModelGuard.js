const EXACT_MODEL_AUTHORITY = "user-supplied-airport-jetway-exclusive-geometry-v9";
const LEGACY_BRIDGE_PATTERN = /^(?:AIR_Jetway01_|Terminal4_(?:FixedWalkway|GlassFixedWalkways|A1_.*(?:Portal|Walkway|Connector))|A1_T4_WALK_)/i;
const A1_SYNTHETIC_PORTAL_PATTERN = /^UploadedAirportJetwayTerminalPortal/i;
const REQUIRED_SOURCE_PARTS = Object.freeze(["Tunnel_A", "Tunnel_B", "Tunnel_C", "Rotunda", "Cab"]);
const SOURCE_STAIR_NAME = "Tunnel_C_GalvanizedServiceStair_SourceTriangles";
const SOURCE_BOGIE_NAME = "Tunnel_C_DarkBogieLift_SourceTriangles";

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
  const missing = REQUIRED_SOURCE_PARTS.filter((name) => !model.getObjectByName(name));
  if (missing.length) {
    throw new Error(`Supplied airport jetway is missing authored parts: ${missing.join(", ")}`);
  }

  // The prototype root is renamed to UploadedAirportJetwayModel_A1 when cloned.
  // Its transform must remain identity so only the gate anchor and real moving
  // child joints control placement and aircraft-specific articulation.
  const aligned = model;
  const scaleError = Math.max(
    Math.abs(aligned.scale.x - 1),
    Math.abs(aligned.scale.y - 1),
    Math.abs(aligned.scale.z - 1),
  );
  if (scaleError > 1e-6) {
    throw new Error(`Supplied airport jetway prototype was deformed: scale ${aligned.scale.toArray().join(",")}`);
  }
  if (Math.abs(aligned.rotation.x) > 1e-6 || Math.abs(aligned.rotation.y) > 1e-6 || Math.abs(aligned.rotation.z) > 1e-6) {
    throw new Error("Supplied airport jetway prototype received a non-authored axis rotation");
  }

  const stair = model.getObjectByName(SOURCE_STAIR_NAME);
  const bogie = model.getObjectByName(SOURCE_BOGIE_NAME);
  if (!stair?.isMesh || !bogie?.isMesh) {
    throw new Error("Supplied airport jetway stair or bogie source triangles are missing");
  }
  const syntheticEdgeCount = [stair, bogie].reduce(
    (count, mesh) => count + mesh.children.filter((child) => /SharpEdgeDefinition/i.test(child.name || "")).length,
    0,
  );
  if (syntheticEdgeCount !== 0) {
    throw new Error(`Supplied airport jetway contains ${syntheticEdgeCount} non-source edge overlays`);
  }

  return {
    requiredPartCount: REQUIRED_SOURCE_PARTS.length,
    requiredParts: [...REQUIRED_SOURCE_PARTS],
    prototypeScale: aligned.scale.toArray(),
    prototypeRotation: [aligned.rotation.x, aligned.rotation.y, aligned.rotation.z],
    stairMeshCount: 1,
    bogieMeshCount: 1,
    syntheticEdgeCount,
    geometryReplaced: false,
  };
}

export function enforceExactUploadedJetwayVisualAuthority(group, fleet) {
  if (!group?.isGroup || !fleet?.isGroup) {
    throw new Error("Exact supplied jetway authority requires the source group and uploaded fleet");
  }

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
  group.userData.uploadedJetwayParentAxisCorrectionRadians = 0;
  return result;
}

export {
  EXACT_MODEL_AUTHORITY as UPLOADED_AIRPORT_JETWAY_EXACT_MODEL_AUTHORITY,
  REQUIRED_SOURCE_PARTS as UPLOADED_AIRPORT_JETWAY_REQUIRED_SOURCE_PARTS,
};
