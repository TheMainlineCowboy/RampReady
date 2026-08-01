import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-integrated-load-frame-v49";

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
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V49")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V48")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V47")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V46")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V45")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V44");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V49";
  const galvanized = material("Terminal 4 fixed walkway galvanized load frames V49", 0x626d72, 0.54, 0.38);
  const darkSteel = material("Terminal 4 fixed walkway dark transfer steel V49", 0x20272b, 0.68, 0.3);
  const concrete = material("Terminal 4 fixed walkway formed concrete foundations V49", 0x85837e, 0.96, 0.01);

  const longitudinalBeams = [];
  const underdeckFascias = [];
  const transferCrossheads = [];
  const columns = [];
  const centerSpines = [];
  const pierBases = [];
  const kneeBraces = [];
  const lowerTies = [];
  const longitudinalBraces = [];
  const braceLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.72));
  const braceRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.72));

  for (const record of records) {
    const undersideY = record.position.y - 1.12;
    const columnHeight = Math.max(2.2, undersideY - 0.3);
    const pairOffset = 1.38;
    const stationOffset = Math.max(1.0, Math.min(record.length * 0.27, 2.25));

    longitudinalBeams.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.16, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(3.42, 0.5, Math.max(4.0, record.length * 0.97)),
    });
    underdeckFascias.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.48, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(3.5, 0.22, Math.max(4.0, record.length * 0.94)),
    });
    centerSpines.push({
      position: new THREE.Vector3(record.position.x, columnHeight / 2 + 0.3, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(0.72, columnHeight, 0.82),
    });
    pierBases.push({
      position: new THREE.Vector3(record.position.x, 0.3, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(1.45, 0.6, 1.55),
    });

    for (const station of [-1, 1]) {
      const stationCenter = record.position.clone().addScaledVector(record.forward, station * stationOffset);
      transferCrossheads.push({
        position: new THREE.Vector3(stationCenter.x, undersideY - 0.43, stationCenter.z),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(3.62, 0.42, 0.72),
      });
      lowerTies.push({
        position: new THREE.Vector3(stationCenter.x, 1.08, stationCenter.z),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(2.88, 0.24, 0.46),
      });

      for (const side of [-1, 1]) {
        const lateral = record.right.clone().multiplyScalar(side * pairOffset);
        columns.push({
          position: new THREE.Vector3(stationCenter.x, columnHeight / 2 + 0.3, stationCenter.z).add(lateral),
          quaternion: record.quaternion.clone(),
          scale: new THREE.Vector3(0.68, columnHeight, 0.72),
        });
        pierBases.push({
          position: new THREE.Vector3(stationCenter.x, 0.3, stationCenter.z).add(lateral),
          quaternion: record.quaternion.clone(),
          scale: new THREE.Vector3(1.28, 0.6, 1.38),
        });
        kneeBraces.push({
          position: new THREE.Vector3(stationCenter.x, undersideY - 1.0, stationCenter.z)
            .addScaledVector(record.right, side * 0.98),
          quaternion: record.quaternion.clone().multiply(side < 0 ? braceLeft : braceRight),
          scale: new THREE.Vector3(0.22, 1.62, 0.22),
        });
      }
    }

    for (const side of [-1, 1]) {
      const lateral = record.right.clone().multiplyScalar(side * pairOffset);
      longitudinalBraces.push({
        position: new THREE.Vector3(record.position.x, 1.72, record.position.z).add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.22, 0.22, stationOffset * 2.15),
      });
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const beamCount = addInstances(root, "Terminal4_FixedWalkway_LongitudinalGirders_V49", box, darkSteel, longitudinalBeams);
  const fasciaCount = addInstances(root, "Terminal4_FixedWalkway_UnderdeckFascias_V49", box, galvanized, underdeckFascias);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_TransferCrossheads_V49", box, galvanized, transferCrossheads);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_LoadColumns_V49", box, galvanized, columns);
  const centerSpineCount = addInstances(root, "Terminal4_FixedWalkway_CenterLoadSpines_V49", box, darkSteel, centerSpines);
  const braceCount = addInstances(root, "Terminal4_FixedWalkway_KneeBraces_V49", box, darkSteel, kneeBraces);
  const baseCount = addInstances(root, "Terminal4_FixedWalkway_FormedFoundations_V49", box, concrete, pierBases);
  const tieCount = addInstances(root, "Terminal4_FixedWalkway_LowerTies_V49", box, darkSteel, lowerTies);
  const longitudinalBraceCount = addInstances(root, "Terminal4_FixedWalkway_LongitudinalBraces_V49", box, darkSteel, longitudinalBraces);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.portalStationsPerWalkway = 2;
  root.userData.longitudinalBeamCount = beamCount;
  root.userData.underdeckFasciaCount = fasciaCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.columnCount = columnCount;
  root.userData.centerLoadSpineCount = centerSpineCount;
  root.userData.braceCount = braceCount;
  root.userData.pierBaseCount = baseCount;
  root.userData.lowerTieCount = tieCount;
  root.userData.longitudinalBraceCount = longitudinalBraceCount;
  root.userData.removedDecorativeServiceCabinets = true;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportPortalStationsPerWalkway = 2;
  group.userData.fixedWalkwaySupportDetailCount = beamCount + fasciaCount + crossheadCount + columnCount
    + centerSpineCount + braceCount + baseCount + tieCount + longitudinalBraceCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  return root;
}
