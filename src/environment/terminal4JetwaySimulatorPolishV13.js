import * as THREE from "three";

const HIDDEN_REPETITIVE_DETAIL = /AIR_Jetway01_(?:HorizontalRibs|VerticalRibs|PanelSeams)/i;
const LARGE_SHADOW_CASTER = /AIR_Jetway01_(?:OuterTelescopingTunnels|InnerTelescopingTunnels|AircraftCabins|Rotundas|WallCollars|FixedTerminalWalkways)/i;

function tuneSharedMaterial(material, labels) {
  if (!material) return;
  const label = `${labels} ${material.name || ""}`;
  if (/HorizontalRibs|VerticalRibs|PanelSeams|structural|frame|trim/i.test(label)) {
    material.color?.setHex(0xa5a9aa);
    material.emissive?.setHex(0x080808);
    material.emissiveIntensity = 0.1;
    material.roughness = 0.76;
    material.metalness = 0.18;
  } else if (/OuterTelescopingTunnels|InnerTelescopingTunnels|FixedTerminalWalkways|WallCollars|Rotundas|AircraftCabins|exact-source/i.test(label)) {
    material.color?.setHex(material.map ? 0xffffff : 0xeceae4);
    material.emissive?.setHex(0x282828);
    material.emissiveIntensity = Math.max(Number(material.emissiveIntensity) || 0, material.map ? 0.38 : 0.22);
    material.roughness = 0.8;
    material.metalness = 0.035;
  } else if (/Window|Glass/i.test(label)) {
    material.color?.setHex(0x304650);
    material.roughness = 0.25;
    material.metalness = 0.05;
  } else if (/galvanized|LiftColumns|WheelBogies|Axles|SupportFeet/i.test(label)) {
    material.color?.setHex(0x94999b);
    material.emissive?.setHex(0x070707);
    material.emissiveIntensity = 0.08;
    material.roughness = 0.66;
    material.metalness = 0.3;
  }
  material.needsUpdate = true;
}

function installFixedWalkwayGroundSupports(group) {
  if (group.getObjectByName("Terminal4_FixedWalkwayGroundSupports_V14")) return 0;
  const walkways = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!walkways?.isInstancedMesh || walkways.count < 1) return 0;

  const liftColumns = group.getObjectByName("AIR_Jetway01_LiftColumns");
  const supportMaterial = liftColumns?.material?.clone?.() || new THREE.MeshStandardMaterial({
    color: 0x7a8082,
    roughness: 0.66,
    metalness: 0.3,
  });
  supportMaterial.name = "Terminal 4 fixed walkway galvanized support";
  supportMaterial.map = null;
  supportMaterial.emissiveMap = null;
  supportMaterial.color?.setHex(0x7d8385);
  supportMaterial.emissive?.setHex(0x060606);
  supportMaterial.emissiveIntensity = 0.08;
  supportMaterial.roughness = 0.66;
  supportMaterial.metalness = 0.3;
  supportMaterial.needsUpdate = true;

  const footMaterial = supportMaterial.clone();
  footMaterial.name = "Terminal 4 fixed walkway concrete foot";
  footMaterial.color?.setHex(0x8d8a85);
  footMaterial.roughness = 0.92;
  footMaterial.metalness = 0.01;

  const records = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  for (let instance = 0; instance < walkways.count; instance += 1) {
    walkways.getMatrixAt(instance, matrix);
    matrix.decompose(position, quaternion, scale);
    const length = Math.abs(scale.z);
    if (length < 8.5) continue;
    forward.set(0, 0, 1).applyQuaternion(quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(quaternion).normalize();
    const spacing = length > 24 ? 7.2 : 6.2;
    for (let along = 4.2; along < length - 2.8; along += spacing) {
      const offset = along - length / 2;
      records.push({
        centerX: position.x + forward.x * offset,
        centerZ: position.z + forward.z * offset,
        rightX: right.x,
        rightZ: right.z,
        yaw: Math.atan2(forward.x, forward.z),
      });
    }
  }

  if (!records.length) return 0;
  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkwayGroundSupports_V14";

  const columnGeometry = new THREE.CylinderGeometry(0.14, 0.18, 3.0, 12, 1, false);
  const footGeometry = new THREE.BoxGeometry(0.72, 0.2, 0.72);
  const crossbeamGeometry = new THREE.BoxGeometry(2.32, 0.18, 0.24);
  const columns = new THREE.InstancedMesh(columnGeometry, supportMaterial, records.length * 2);
  const feet = new THREE.InstancedMesh(footGeometry, footMaterial, records.length * 2);
  const crossbeams = new THREE.InstancedMesh(crossbeamGeometry, supportMaterial, records.length);
  columns.name = "Terminal4_FixedWalkwaySupportColumns";
  feet.name = "Terminal4_FixedWalkwaySupportFeet";
  crossbeams.name = "Terminal4_FixedWalkwaySupportCrossbeams";

  const dummy = new THREE.Object3D();
  let columnIndex = 0;
  records.forEach((record, recordIndex) => {
    for (const side of [-1, 1]) {
      dummy.position.set(
        record.centerX + record.rightX * side * 0.82,
        1.62,
        record.centerZ + record.rightZ * side * 0.82,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      columns.setMatrixAt(columnIndex, dummy.matrix);

      dummy.position.y = 0.1;
      dummy.rotation.set(0, record.yaw, 0);
      dummy.updateMatrix();
      feet.setMatrixAt(columnIndex, dummy.matrix);
      columnIndex += 1;
    }
    dummy.position.set(record.centerX, 3.08, record.centerZ);
    dummy.rotation.set(0, record.yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    crossbeams.setMatrixAt(recordIndex, dummy.matrix);
  });

  for (const mesh of [columns, feet, crossbeams]) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    root.add(mesh);
  }
  root.userData.authority = "source-placed-fixed-walkway-ground-supports-v14";
  root.userData.supportStationCount = records.length;
  root.userData.columnCount = records.length * 2;
  group.add(root);
  return records.length;
}

export function applyTerminal4JetwaySimulatorPolish(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway simulator polish requires the source-placed jetway group");
  const materialLabels = new Map();
  let hiddenRepetitiveMeshCount = 0;
  let reducedShadowCasterCount = 0;

  group.traverse((entry) => {
    if (!entry.isMesh) return;
    const name = entry.name || "";
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      if (!materialLabels.has(material)) materialLabels.set(material, new Set());
      materialLabels.get(material).add(name || "unnamed");
    }

    if (HIDDEN_REPETITIVE_DETAIL.test(name)) {
      entry.visible = false;
      entry.castShadow = false;
      hiddenRepetitiveMeshCount += 1;
    } else {
      entry.castShadow = LARGE_SHADOW_CASTER.test(name);
      if (!entry.castShadow) reducedShadowCasterCount += 1;
    }
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });

  for (const [material, labels] of materialLabels) {
    tuneSharedMaterial(material, [...labels].join(" "));
  }

  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group);
  group.userData.simulatorPolishAuthority = "exact-source-clean-shell-daylight-lift-grounded-walkways-v14";
  group.userData.simulatorPolishMaterialCount = materialLabels.size;
  group.userData.simulatorPolishHiddenRepetitiveMeshCount = hiddenRepetitiveMeshCount;
  group.userData.simulatorPolishReducedShadowCasterCount = reducedShadowCasterCount;
  group.userData.simulatorPolishSilhouette = "exact-atlas-shells-with-procedural-ribs-and-seams-suppressed";
  group.userData.fixedWalkwaySupportStationCount = fixedWalkwaySupportStationCount;
  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";
  return group;
}
