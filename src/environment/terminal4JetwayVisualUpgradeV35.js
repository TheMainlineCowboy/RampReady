const AUTHORITY = "package-native-terminal4-jetway-material-pass-no-procedural-detail-v52";

const SHELL_MATERIAL = /exact-source|outer shell|telescoping shell|aircraft cabin/i;
const GLASS_MATERIAL = /glass|glazing|window/i;
const STRUCTURE_MATERIAL = /structural trim|galvanized|lift column|axle|bogie|frame/i;
const SAFETY_MATERIAL = /safety yellow|warning|bumper/i;

function tuneMaterial(material) {
  if (!material) return;
  const label = `${material.name || ""}`;
  if (SHELL_MATERIAL.test(label)) {
    material.color?.setHex(0xd7dad5);
    material.roughness = 0.72;
    material.metalness = 0.08;
    if (material.emissive) material.emissive.setHex(0x090909);
    material.emissiveIntensity = Math.min(Number(material.emissiveIntensity) || 0, 0.035);
  } else if (GLASS_MATERIAL.test(label)) {
    material.color?.setHex(0x162a33);
    material.roughness = 0.2;
    material.metalness = 0.1;
    material.opacity = Math.min(Number(material.opacity) || 1, 0.82);
  } else if (STRUCTURE_MATERIAL.test(label)) {
    material.color?.setHex(0x51595d);
    material.roughness = 0.6;
    material.metalness = 0.32;
  } else if (SAFETY_MATERIAL.test(label)) {
    material.color?.setHex(0xd1a21d);
    material.roughness = 0.7;
    material.metalness = 0.08;
  }
  material.needsUpdate = true;
}

export function enhanceTerminal4JetwayVisuals(THREE, group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway visual pass requires the source-placed jetway group");

  const visitedMaterials = new Set();
  let sourceMeshCount = 0;
  group.traverse((entry) => {
    if (!entry.isMesh) return;
    sourceMeshCount += 1;
    entry.castShadow = true;
    entry.receiveShadow = true;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material || visitedMaterials.has(material.uuid)) continue;
      visitedMaterials.add(material.uuid);
      tuneMaterial(material);
    }
  });

  const outer = group.getObjectByName("AIR_Jetway01_OuterTelescopingTunnels");
  const animatedA1 = group.getObjectByName("AIR_Jetway01_A1_AnimatedDepartureAssembly_V12");
  if (animatedA1) {
    animatedA1.traverse((entry) => {
      if (!entry.isMesh) return;
      entry.castShadow = true;
      entry.receiveShadow = true;
      const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
      materials.forEach(tuneMaterial);
    });
  }

  group.userData.jetwayVisualUpgradeAuthority = AUTHORITY;
  group.userData.jetwayVisualUpgradeDetailInstanceCount = 0;
  group.userData.jetwayVisualUpgradeStaticJetwayCount = outer?.count ?? 0;
  group.userData.jetwayVisualUpgradeExactTexturePreserved = true;
  group.userData.jetwayVisualUpgradeProceduralGeometryRemoved = true;
  group.userData.jetwayVisualUpgradePackageMeshIsSoleGeometryAuthority = true;
  group.userData.jetwayVisualUpgradeSourceMeshCount = sourceMeshCount;
  group.userData.jetwayVisualUpgradeMissingSourceMeshDisclosure = true;

  return {
    authority: AUTHORITY,
    detailInstanceCount: 0,
    staticJetwayCount: outer?.count ?? 0,
    sourceMeshCount,
  };
}
