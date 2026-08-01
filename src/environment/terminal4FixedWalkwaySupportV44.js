import * as THREE from "three";

const AUTHORITY = "source-transform-fixed-walkway-coherent-portal-frame-v46";

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
  const existing = group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V46")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V45")
    || group.getObjectByName("Terminal4_FixedWalkway_SupportUpgrade_V44");
  if (existing) return existing;

  const source = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  const records = extractRecords(source);
  if (!records.length) throw new Error("Terminal 4 walkway support upgrade recovered zero source transforms");

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkway_SupportUpgrade_V46";
  const galvanized = material("Terminal 4 fixed walkway galvanized portal frames V46", 0x687176, 0.56, 0.38);
  const darkSteel = material("Terminal 4 fixed walkway dark structural reveals V46", 0x252b2f, 0.68, 0.28);
  const concrete = material("Terminal 4 fixed walkway formed concrete piers V46", 0x888680, 0.92, 0.01);
  const service = material("Terminal 4 fixed walkway compact service cabinets V46", 0x454c50, 0.78, 0.16);

  const longitudinalBeams = [];
  const crossheads = [];
  const columns = [];
  const kneeBraces = [];
  const footings = [];
  const cabinets = [];
  const cabinetCaps = [];
  const braceLeft = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.72));
  const braceRight = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.72));

  for (const record of records) {
    const undersideY = record.position.y - 1.26;
    const columnHeight = Math.max(1.65, undersideY - 0.34);
    const pairOffset = 1.02;

    // One deep beam follows the exact source walkway axis and visually carries
    // the entire corridor. It is structural dressing only: source transforms,
    // dimensions and airport placement remain untouched.
    longitudinalBeams.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.18, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.56, 0.34, Math.max(3.4, record.length * 0.82)),
    });
    crossheads.push({
      position: new THREE.Vector3(record.position.x, undersideY - 0.42, record.position.z),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(2.72, 0.28, 0.48),
    });

    for (const side of [-1, 1]) {
      const lateral = record.right.clone().multiplyScalar(side * pairOffset);
      const columnCenter = new THREE.Vector3(record.position.x, columnHeight / 2 + 0.22, record.position.z)
        .add(lateral);
      columns.push({
        position: columnCenter,
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.34, columnHeight, 0.34),
      });
      footings.push({
        position: new THREE.Vector3(record.position.x, 0.16, record.position.z).add(lateral),
        quaternion: record.quaternion.clone(),
        scale: new THREE.Vector3(0.88, 0.32, 0.94),
      });
      kneeBraces.push({
        position: new THREE.Vector3(record.position.x, undersideY - 0.92, record.position.z)
          .addScaledVector(record.right, side * 0.76),
        quaternion: record.quaternion.clone().multiply(side < 0 ? braceLeft : braceRight),
        scale: new THREE.Vector3(0.14, 1.34, 0.14),
      });
    }

    // Keep service equipment believable and low. The prior tall enclosure made
    // the original center post more conspicuous and read as stacked placeholder
    // geometry. This compact cabinet masks only the base area.
    cabinets.push({
      position: new THREE.Vector3(record.position.x, 0.58, record.position.z)
        .addScaledVector(record.forward, 0.2),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(0.76, 1.02, 0.58),
    });
    cabinetCaps.push({
      position: new THREE.Vector3(record.position.x, 1.12, record.position.z)
        .addScaledVector(record.forward, 0.2),
      quaternion: record.quaternion.clone(),
      scale: new THREE.Vector3(0.84, 0.12, 0.66),
    });
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const beamCount = addInstances(root, "Terminal4_FixedWalkway_LongitudinalBeams_V46", box, darkSteel, longitudinalBeams);
  const crossheadCount = addInstances(root, "Terminal4_FixedWalkway_Crossheads_V46", box, galvanized, crossheads);
  const columnCount = addInstances(root, "Terminal4_FixedWalkway_RectangularColumns_V46", box, galvanized, columns);
  const braceCount = addInstances(root, "Terminal4_FixedWalkway_KneeBraces_V46", box, darkSteel, kneeBraces);
  const footingCount = addInstances(root, "Terminal4_FixedWalkway_Footings_V46", box, concrete, footings);
  const cabinetCount = addInstances(root, "Terminal4_FixedWalkway_ServiceCabinets_V46", box, service, cabinets);
  const capCount = addInstances(root, "Terminal4_FixedWalkway_ServiceCabinetCaps_V46", box, galvanized, cabinetCaps);

  root.userData.authority = AUTHORITY;
  root.userData.sourceGeometryUnmoved = true;
  root.userData.sourceTransformCount = records.length;
  root.userData.longitudinalBeamCount = beamCount;
  root.userData.crossheadCount = crossheadCount;
  root.userData.columnCount = columnCount;
  root.userData.braceCount = braceCount;
  root.userData.footingCount = footingCount;
  root.userData.serviceCabinetCount = cabinetCount;
  root.userData.serviceCabinetCapCount = capCount;
  group.add(root);

  group.userData.fixedWalkwaySupportAuthority = AUTHORITY;
  group.userData.fixedWalkwaySupportSourceTransformCount = records.length;
  group.userData.fixedWalkwaySupportDetailCount = beamCount + crossheadCount + columnCount
    + braceCount + footingCount + cabinetCount + capCount;
  group.userData.fixedWalkwaySupportSourceGeometryUnmoved = true;
  return root;
}
