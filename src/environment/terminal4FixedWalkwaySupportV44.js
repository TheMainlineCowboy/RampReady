import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-structural-support-v45";

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
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V44")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V45");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V45";
  const steel = material("Terminal 4 fixed walkway galvanized frames V45", 0x747b7e, 0.58, 0.34);
  const darkSteel = material("Terminal 4 fixed walkway structural brace reveals V45", 0x303639, 0.7, 0.24);
  const concrete = material("Terminal 4 fixed walkway formed concrete footings V45", 0x85837d, 0.92, 0.01);
  const service = material("Terminal 4 fixed walkway utility riser V45", 0x4a5053, 0.76, 0.18);

  const columns = [];
  const crossheads = [];
  const footings = [];
  const braces = [];
  const tieBeams = [];
  const utilityRisers = [];
  const utilityCaps = [];
  const baseQuaternion = new THREE.Quaternion();
  const braceLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.59));
  const braceRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.59));

  for (const record of records) {
    const undersideY = record.position.y - 1.28;
    const columnHeight = Math.max(1.55, undersideY - 0.42);
    const supportCenter = record.position.clone();
    supportCenter.y = columnHeight / 2 + 0.24;
    const pairOffset = 0.72;

    for (const side of [-1, 1]) {
      const lateral = record.right.clone().multiplyScalar(side * pairOffset);
      columns.push({
        position: supportCenter.clone().add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.28, columnHeight, 0.28),
      });
      footings.push({
        position: new THREE.Vector3(supportCenter.x, 0.17, supportCenter.z).add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.82, 0.34, 0.92),
      });
      braces.push({
        position: new THREE.Vector3(record.position.x, undersideY - 0.68, record.position.z)
          .addScaledVector(record.right, side * 0.73),
        quaternion: record.quaternion.clone().multiply(side < 0 ? braceLeft : braceRight),
        scale: new THREE.Vector3(0.13, 1.85, 0.13),
      });
    }

    crossheads.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.05, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.78, 0.3, 0.54),
    });
    tieBeams.push({
      position: new THREE.Vector3(record.position.x, 1.15, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(1.72, 0.18, 0.3),
    });

    // Enclose the legacy pencil-thin center post as a believable electrical /
    // hydraulic riser instead of leaving it exposed. This does not move or
    // resize the source corridor; it only finishes the support assembly around
    // the source-derived transform.
    utilityRisers.push({
      position: new THREE.Vector3(record.position.x, Math.min(1.35, columnHeight / 2), record.position.z)
        .addScaledVector(record.forward, 0.08),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(0.68, Math.min(2.3, columnHeight - 0.22), 0.58),
    });
    utilityCaps.push({
      position: new THREE.Vector3(record.position.x, Math.min(2.56, columnHeight + 0.1), record.position.z)
        .addScaledVector(record.forward, 0.08),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(0.82, 0.16, 0.72),
    });
    footings.push({
      position: new THREE.Vector3(record.position.x, 0.09, record.position.z),
      quaternion: baseQuaternion,
      scale: new THREE.Vector3(2.18, 0.18, 1.34),
    });
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const columnGeometry = new THREE.CylinderGeometry(0.5, 0.56, 1, 16);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_TwinColumns_V45", columnGeometry, steel, columns);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_Crossheads_V45", box, steel, crossheads);
  const footingCount = addInstances(root, "Terminal4_FixedWalkway_Footings_V45", box, concrete, footings);
  const braceCount = addInstances(root, "Terminal4_FixedWalkway_DiagonalBraces_V45", box, darkSteel, braces);
  const tieBeamCount = addInstances(root, "Terminal4_FixedWalkway_LowerTieBeams_V45", box, darkSteel, tieBeams);
  const riserCount = addInstances(root, "Terminal4_FixedWalkway_UtilityRisers_V45", box, service, utilityRisers);
  const capCount = addInstances(root, "Terminal4_FixedWalkway_UtilityCaps_V45", box, steel, utilityCaps);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.columnCount = columnCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.footingCount = footingCount;
  root.userData.braceCount = braceCount;
  root.userData.tieBeamCount = tieBeamCount;
  root.userData.utilityRiserCount = riserCount;
  root.userData.utilityCapCount = capCount;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportDetailCount = columnCount + crossheadCount + footingCount
    + braceCount + tieBeamCount + riserCount + capCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  return root;
}
