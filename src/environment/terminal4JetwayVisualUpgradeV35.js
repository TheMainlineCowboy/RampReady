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

function createMaterial(THREE, name, color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
  });
}

function composeLocalMatrix(THREE, detail) {
  const position = new THREE.Vector3(...(detail.position || [0, 0, 0]));
  const rotation = new THREE.Euler(...(detail.rotation || [0, 0, 0]), "YXZ");
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scale = new THREE.Vector3(...(detail.scale || [1, 1, 1]));
  return new THREE.Matrix4().compose(position, quaternion, scale);
}

function addRelativeInstances(THREE, group, sourceMesh, geometry, material, details, name) {
  if (!sourceMesh?.isInstancedMesh || !sourceMesh.count || !details.length) return 0;
  const mesh = new THREE.InstancedMesh(geometry, material, sourceMesh.count * details.length);
  mesh.name = name;
  const base = new THREE.Matrix4();
  let index = 0;
  for (let sourceIndex = 0; sourceIndex < sourceMesh.count; sourceIndex += 1) {
    sourceMesh.getMatrixAt(sourceIndex, base);
    for (const detail of details) {
      const matrix = base.clone().multiply(composeLocalMatrix(THREE, detail));
      mesh.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  group.add(mesh);
  return mesh.count;
}

function tunnelDetailSet(width, height, inner = false) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const sideX = halfWidth + 0.035;
  const roofX = halfWidth * 0.69;
  const underX = halfWidth * 0.58;
  const skirtHeight = inner ? 0.34 : 0.42;
  const details = {
    dark: [],
    galvanized: [],
    yellow: [],
  };
  for (const side of [-1, 1]) {
    details.dark.push({
      position: [side * sideX, -halfHeight + skirtHeight * 0.56, 0],
      scale: [0.075, skirtHeight, 0.98],
    });
    details.galvanized.push({
      position: [side * roofX, halfHeight + 0.04, 0],
      scale: [0.11, 0.1, 0.985],
    });
    details.galvanized.push({
      position: [side * underX, -halfHeight - 0.18, 0],
      scale: [0.11, 0.11, 0.96],
    });
    details.yellow.push({
      position: [side * (sideX + 0.022), -halfHeight + 0.13, 0],
      scale: [0.055, 0.075, 0.94],
    });
  }
  for (const z of [-0.4, -0.2, 0, 0.2, 0.4]) {
    details.galvanized.push({
      position: [0, -halfHeight - 0.18, z],
      scale: [width * 0.72, 0.075, 0.035],
    });
  }
  return details;
}

function cabinDetailSet() {
  return {
    dark: [
      { position: [-1.245, -0.7, 0], scale: [0.08, 0.5, 0.9] },
      { position: [1.245, -0.7, 0], scale: [0.08, 0.5, 0.9] },
      { position: [0, 0.98, 0.515], scale: [2.15, 0.09, 0.055] },
      { position: [-1.04, 0.13, 0.515], scale: [0.08, 1.72, 0.055] },
      { position: [1.04, 0.13, 0.515], scale: [0.08, 1.72, 0.055] },
    ],
    galvanized: [
      { position: [0, 1.18, 0], scale: [2.38, 0.14, 0.96] },
      { position: [-0.88, 1.34, 0], scale: [0.055, 0.24, 0.82] },
      { position: [0.88, 1.34, 0], scale: [0.055, 0.24, 0.82] },
    ],
    yellow: [
      { position: [0, -1.0, 0.525], scale: [2.12, 0.11, 0.07] },
    ],
  };
}

function rotundaDetailSet() {
  return {
    dark: [
      { position: [0, -0.42, 0], scale: [1.03, 0.12, 1.03] },
      { position: [0, 0.42, 0], scale: [1.04, 0.11, 1.04] },
    ],
    galvanized: [
      { position: [0, 0.62, 0], scale: [1.08, 0.08, 1.08] },
    ],
  };
}

export function enhanceTerminal4JetwayVisuals(THREE, group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway visual upgrade requires the source-placed jetway group");

  const visitedMaterials = new Set();
  group.traverse((entry) => {
    if (!entry.isMesh) return;
    entry.castShadow = true;
    entry.receiveShadow = true;
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material || visitedMaterials.has(material.uuid)) continue;
      visitedMaterials.add(material.uuid);
      tuneMaterial(material);
    }
  });

  const dark = createMaterial(THREE, "AIR_Jetway01 dark structural reveal V35", 0x30383c, 0.68, 0.24);
  const galvanized = createMaterial(THREE, "AIR_Jetway01 galvanized edge and truss V35", 0x727a7d, 0.58, 0.38);
  const yellow = createMaterial(THREE, "AIR_Jetway01 PHX yellow safety band V35", 0xd0a018, 0.72, 0.08);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const ring = new THREE.CylinderGeometry(1, 1, 1, 28, 1, true);

  const outer = group.getObjectByName("AIR_Jetway01_OuterTelescopingTunnels");
  const inner = group.getObjectByName("AIR_Jetway01_InnerTelescopingTunnels");
  const cabins = group.getObjectByName("AIR_Jetway01_AircraftCabins");
  const rotundas = group.getObjectByName("AIR_Jetway01_Rotundas");

  const outerDetails = tunnelDetailSet(2.44, 2.34, false);
  const innerDetails = tunnelDetailSet(2.18, 2.18, true);
  const cabinDetails = cabinDetailSet();
  const rotundaDetails = rotundaDetailSet();

  let detailInstanceCount = 0;
  detailInstanceCount += addRelativeInstances(THREE, group, outer, box, dark, outerDetails.dark, "AIR_Jetway01_OuterLowerSkirts_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, outer, box, galvanized, outerDetails.galvanized, "AIR_Jetway01_OuterRoofAndUnderbridgeStructure_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, outer, box, yellow, outerDetails.yellow, "AIR_Jetway01_OuterSafetyBands_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, inner, box, dark, innerDetails.dark, "AIR_Jetway01_InnerLowerSkirts_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, inner, box, galvanized, innerDetails.galvanized, "AIR_Jetway01_InnerRoofAndUnderbridgeStructure_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, inner, box, yellow, innerDetails.yellow, "AIR_Jetway01_InnerSafetyBands_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, cabins, box, dark, cabinDetails.dark, "AIR_Jetway01_CabinFramesAndSkirts_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, cabins, box, galvanized, cabinDetails.galvanized, "AIR_Jetway01_CabinRoofStructure_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, cabins, box, yellow, cabinDetails.yellow, "AIR_Jetway01_CabinThresholds_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, rotundas, ring, dark, rotundaDetails.dark, "AIR_Jetway01_RotundaStructuralBands_V35");
  detailInstanceCount += addRelativeInstances(THREE, group, rotundas, ring, galvanized, rotundaDetails.galvanized, "AIR_Jetway01_RotundaRoofLips_V35");

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

  group.userData.jetwayVisualUpgradeAuthority = "full-terminal4-jetway-structural-detail-and-material-contrast-v35";
  group.userData.jetwayVisualUpgradeDetailInstanceCount = detailInstanceCount;
  group.userData.jetwayVisualUpgradeStaticJetwayCount = outer?.count ?? 0;
  group.userData.jetwayVisualUpgradeExactTexturePreserved = true;
  group.userData.jetwayVisualUpgradeMissingSourceMeshDisclosure = true;

  return {
    authority: group.userData.jetwayVisualUpgradeAuthority,
    detailInstanceCount,
    staticJetwayCount: outer?.count ?? 0,
  };
}
