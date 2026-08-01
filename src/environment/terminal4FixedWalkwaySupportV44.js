import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-minimal-support-v50";

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
      forward: new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
      length: Math.max(3.2, Math.abs(scale.z)),
    });
  }
  return records;
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
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V50");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V50";

  const galvanized = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway minimal galvanized supports V50",
    color: 0x858d90,
    roughness: 0.72,
    metalness: 0.22,
  });
  const concrete = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway compact concrete footings V50",
    color: 0xa39f97,
    roughness: 0.98,
    metalness: 0,
  });

  const columns = [];
  const crossheads = [];
  const footings = [];

  for (const record of records) {
    const undersideY = record.position.y - 1.08;
    const columnHeight = Math.max(2.1, undersideY - 0.26);
    const stationOffset = Math.max(0.9, Math.min(record.length * 0.28, 2.15));
    const lateralOffset = 1.12;

    for (const station of [-1, 1]) {
      const center = record.position.clone().addScaledVector(record.forward, station * stationOffset);
      crossheads.push({
        position: new THREE.Vector3(center.x, undersideY - 0.16, center.z),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(2.72, 0.18, 0.34),
      });

      for (const side of [-1, 1]) {
        const lateral = record.right.clone().multiplyScalar(side * lateralOffset);
        columns.push({
          position: new THREE.Vector3(center.x, columnHeight / 2 + 0.26, center.z).add(lateral),
          quaternion: record.quaternion.clone(),
          scale: new THREE.Vector3(0.28, columnHeight, 0.3),
        });
        footings.push({
          position: new THREE.Vector3(center.x, 0.16, center.z).add(lateral),
          quaternion: record.quaternion.clone(),
          scale: new THREE.Vector3(0.62, 0.32, 0.68),
        });
      }
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_MinimalColumns_V50", box, galvanized, columns);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_MinimalCrossheads_V50", box, galvanized, crossheads);
  const footingCount = addInstances(root, "Terminal4_FixedWalkway_CompactFootings_V50", box, concrete, footings);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.portalStationsPerWalkway = 2;
  root.userData.columnCount = columnCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.footingCount = footingCount;
  root.userData.noCenterSpines = true;
  root.userData.noLongitudinalScaffold = true;
  root.userData.packageWalkwayRemainsVisualAuthority = true;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportPortalStationsPerWalkway = 2;
  group.userData.fixedWalkwaySupportDetailCount = columnCount + crossheadCount + footingCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  group.userData.fixedWalkwayPackageVisualAuthority = true;
  return root;
}
