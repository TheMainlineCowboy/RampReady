import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-structural-support-v44";

function extractRecords(source) {
  if (!source?.isInstancedMesh || source.count < 1) return [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const records = [];
  for (let index = 0; index < source.count; index += 1) {
    source.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    records.push({
      position: position.clone(),
      quaternion: quaternion.clone(),
      right: new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
      length: Math.abs(scale.z),
    });
  }
  return records;
}

function material(name, color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness });
}

function addInstances(parent, name, geometry, surface, records) {
  if (!records.length) return 0;
  const mesh = new THREE.InstancedMesh(geometry, surface, records.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  records.forEach((record, index) => {
    dummy.position.copy(record.position);
    dummy.quaternion.copy(record.quaternion || new THREE.Quaternion());
    dummy.scale.copy(record.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh.count;
}

export function installTerminal4FixedWalkwaySupportV44(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 walkway support upgrade requires the source jetway group");
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V44");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V44";
  const steel = material("Terminal 4 fixed walkway galvanized supports V44", 0x666d70, 0.63, 0.3);
  const darkSteel = material("Terminal 4 fixed walkway dark brace reveals V44", 0x343a3d, 0.72, 0.2);
  const concrete = material("Terminal 4 fixed walkway concrete footings V44", 0x8d8b84, 0.9, 0.02);

  const columns = [];
  const crossheads = [];
  const footings = [];
  const braces = [];
  const baseQuaternion = new THREE.Quaternion();
  const braceLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.48));
  const braceRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.48));

  for (const record of records) {
    const undersideY = record.position.y - 1.28;
    const columnHeight = Math.max(1.5, undersideY - 0.38);
    const supportCenter = record.position.clone();
    supportCenter.y = columnHeight / 2 + 0.22;
    const pairOffset = 0.34;

    for (const side of [-1, 1]) {
      columns.push({
        position: supportCenter.clone().addScaledVector(record.right, side * pairOffset),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.18, columnHeight, 0.18),
      });
      footings.push({
        position: new THREE.Vector3(supportCenter.x, 0.13, supportCenter.z).addScaledVector(record.right, side * pairOffset),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.62, 0.26, 0.72),
      });
      const braceQuaternion = record.quaternion.clone().multiply(side < 0 ? braceLeft : braceRight);
      braces.push({
        position: new THREE.Vector3(record.position.x, undersideY - 0.62, record.position.z)
          .addScaledVector(record.right, side * 0.53),
        quaternion: braceQuaternion,
        scale: new THREE.Vector3(0.11, 1.55, 0.11),
      });
    }

    crossheads.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.08, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.22, 0.22, 0.44),
    });
    footings.push({
      position: new THREE.Vector3(record.position.x, 0.07, record.position.z),
      quaternion: baseQuaternion,
      scale: new THREE.Vector3(1.52, 0.14, 1.08),
    });
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const columnGeometry = new THREE.CylinderGeometry(0.5, 0.58, 1, 12);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_TwinColumns_V44", columnGeometry, steel, columns);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_Crossheads_V44", box, steel, crossheads);
  const footingCount = addInstances(root, "Terminal4_FixedWalkway_Footings_V44", box, concrete, footings);
  const braceCount = addInstances(root, "Terminal4_FixedWalkway_DiagonalBraces_V44", box, darkSteel, braces);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.columnCount = columnCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.footingCount = footingCount;
  root.userData.braceCount = braceCount;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportDetailCount = columnCount + crossheadCount + footingCount + braceCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  return root;
}
