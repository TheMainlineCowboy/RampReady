import * as THREE from "three";

const AUTHORITY = "package-native-fixed-walkway-source-geometry-v52";

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

  const legacyOverlay = group.getObjectByName("Terminal4_FixedWalkwayArchitecturalDetail_V15");
  if (legacyOverlay) {
    legacyOverlay.visible = false;
    legacyOverlay.traverse((node) => {
      if (node.isMesh) {
        node.visible = false;
        node.castShadow = false;
      }
    });
  }

  const marker = new THREE.Group();
  marker.name = "Terminal4_GlassFixedWalkways_V20";
  marker.userData.authority = AUTHORITY;
  marker.userData.walkwayCount = source.count;
  marker.userData.sourceGeometryVisible = true;
  marker.userData.sourceGeometryUnmoved = true;
  marker.userData.proceduralReplacementMeshCount = 0;
  marker.userData.legacyOverlayHidden = Boolean(legacyOverlay);
  marker.userData.packageWalkwayIsSoleGeometryAuthority = true;
  group.add(marker);

  group.userData.fixedWalkwayAuthority = AUTHORITY;
  group.userData.fixedWalkwayCount = source.count;
  group.userData.fixedWalkwayProceduralReplacementMeshCount = 0;
  group.userData.fixedWalkwaySourceGeometryVisible = true;
  group.userData.fixedWalkwaySourceGeometryUnmoved = true;
  return marker;
}
