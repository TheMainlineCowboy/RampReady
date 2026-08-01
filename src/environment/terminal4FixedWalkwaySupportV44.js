import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-integrated-portal-frame-v47";

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
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V47")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V46")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V45")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V44");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V47";
  const galvanized = material("Terminal 4 fixed walkway galvanized portal frames V47", 0x727a7e, 0.58, 0.34);
  const darkSteel = material("Terminal 4 fixed walkway dark structural beams V47", 0x252b2f, 0.7, 0.26);
  const concrete = material("Terminal 4 fixed walkway formed concrete piers V47", 0x8d8b86, 0.94, 0.01);

  const longitudinalBeams = [];
  const crossheads = [];
  const columns = [];
  const pierBases = [];
  const kneeBraces = [];
  const lowerTies = [];
  const braceLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.68));
  const braceRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.68));

  for (const record of records) {
    const undersideY = record.position.y - 1.2;
    const columnHeight = Math.max(1.8, undersideY - 0.36);
    const pairOffset = 1.18;

    // A continuous dark girder follows the exact source walkway axis. The
    // crosshead and paired piers meet it directly, creating one readable load
    // path instead of several unrelated posts and equipment boxes.
    longitudinalBeams.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.12, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.9, 0.42, Math.max(3.6, record.length * 0.9)),
    });
    crossheads.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.38, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(3.18, 0.34, 0.62),
    });
    lowerTies.push({
      position: new THREE.Vector3(record.position.x, 1.02, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.62, 0.2, 0.42),
    });

    for (const side of [-1, 1]) {
      const lateral = record.right.clone().multiplyScalar(side * pairOffset);
      columns.push({
        position: new THREE.Vector3(record.position.x, columnHeight / 2 + 0.34, record.position.z).add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.5, columnHeight, 0.58),
      });
      pierBases.push({
        position: new THREE.Vector3(record.position.x, 0.28, record.position.z).add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(1.08, 0.56, 1.18),
      });
      kneeBraces.push({
        position: new THREE.Vector3(record.position.x, undersideY - 0.94, record.position.z)
          .addScaledVector(record.right, side * 0.83),
        quaternion: record.quaternion.clone().multiply(side < 0 ? braceLeft : braceRight),
        scale: new THREE.Vector3(0.18, 1.48, 0.18),
      });
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const beamCount = addInstances(root, "Terminal4_FixedWalkway_LongitudinalGirders_V47", box, darkSteel, longitudinalBeams);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_PortalCrossheads_V47", box, galvanized, crossheads);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_PortalColumns_V47", box, galvanized, columns);
  const braceCount = addInstances(root, "Terminal4_FixedWalkway_KneeBraces_V47", box, darkSteel, kneeBraces);
  const baseCount = addInstances(root, "Terminal4_FixedWalkway_FormedPierBases_V47", box, concrete, pierBases);
  const tieCount = addInstances(root, "Terminal4_FixedWalkway_LowerTies_V47", box, darkSteel, lowerTies);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.longitudinalBeamCount = beamCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.columnCount = columnCount;
  root.userData.braceCount = braceCount;
  root.userData.pierBaseCount = baseCount;
  root.userData.lowerTieCount = tieCount;
  root.userData.removedDecorativeServiceCabinets = true;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportDetailCount = beamCount + crossheadCount + columnCount
    + braceCount + baseCount + tieCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  return root;
}
