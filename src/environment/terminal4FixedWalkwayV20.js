import * as THREE from "three";

const AUTHORITY = "package-native-fixed-walkway-source-geometry-v54";

function tunePackageMaterial(material) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (!entry) continue;
    entry.side = THREE.DoubleSide;
    entry.transparent = Boolean(entry.transparent);
    entry.opacity = Number.isFinite(entry.opacity) ? entry.opacity : 1;
    entry.roughness = Number.isFinite(entry.roughness) ? Math.max(0.48, entry.roughness) : 0.72;
    entry.metalness = Number.isFinite(entry.metalness) ? Math.min(0.18, entry.metalness) : 0.04;
    entry.dithering = true;
    entry.needsUpdate = true;
  }
}

function hideProceduralGroup(group, name) {
  const object = group.getObjectByName(name);
  if (!object) return false;
  object.visible = false;
  object.traverse((node) => {
    node.visible = false;
    if (node.isMesh) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
  return true;
}

export function installTerminal4FixedWalkwayV20(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 fixed walkway authority requires the source jetway group");
  const existing = group.getObjectByName("Terminal4_GlassFixedWalkways_V20");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!source?.isInstancedMesh || source.count < 1) {
    throw new Error("Terminal 4 package fixed walkways are missing");
  }

  source.visible = true;
  source.castShadow = true;
  source.receiveShadow = true;
  tunePackageMaterial(source.material);

  const hiddenArchitecturalOverlay = hideProceduralGroup(group, "Terminal4_FixedWalkwayArchitecturalDetail_V15");
  const hiddenGroundSupports = hideProceduralGroup(group, "Terminal4_FixedWalkwayGroundSupports_V14");
  const hiddenObsoleteA1Facade = hideProceduralGroup(group, "Terminal4_A1_LowerFacadePortal_V15");

  const marker = new THREE.Group();
  marker.name = "Terminal4_GlassFixedWalkways_V20";
  marker.userData.authority = AUTHORITY;
  marker.userData.walkwayCount = source.count;
  marker.userData.sourceGeometryVisible = true;
  marker.userData.sourceGeometryUnmoved = true;
  marker.userData.proceduralReplacementMeshCount = 0;
  marker.userData.packageWalkwayIsSoleGeometryAuthority = true;
  marker.userData.hiddenProceduralArchitecturalOverlay = hiddenArchitecturalOverlay;
  marker.userData.hiddenProceduralGroundSupports = hiddenGroundSupports;
  marker.userData.hiddenObsoleteA1Facade = hiddenObsoleteA1Facade;
  group.add(marker);

  group.userData.fixedWalkwayAuthority = AUTHORITY;
  group.userData.fixedWalkwayCount = source.count;
  group.userData.fixedWalkwayProceduralReplacementMeshCount = 0;
  group.userData.fixedWalkwaySourceGeometryVisible = true;
  group.userData.fixedWalkwaySourceGeometryUnmoved = true;
  group.userData.fixedWalkwayProceduralGroundSupportsHidden = hiddenGroundSupports;
  group.userData.fixedWalkwayProceduralArchitecturalOverlayHidden = hiddenArchitecturalOverlay;
  group.userData.obsoleteA1LowerFacadePortalHidden = hiddenObsoleteA1Facade;
  return marker;
}
