const DETAIL_AUTHORITY = "same-day-a1-photo-corrugation-pipes-support-and-utility-v1";

function addBox(THREE, parent, material, name, dimensions, position, yaw, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = yaw;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinderBetween(THREE, parent, material, name, start, end, radius, radialSegments = 14) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (!(length > 0.1)) throw new Error(`${name} has no usable length`);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1, false),
    material,
  );
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createMaterials(THREE) {
  return {
    whiteMetal: new THREE.MeshStandardMaterial({
      name: "A1 fixed vestibule white painted metal detail",
      color: 0xdedfdc,
      roughness: 0.76,
      metalness: 0.12,
      side: THREE.DoubleSide,
    }),
    seam: new THREE.MeshStandardMaterial({
      name: "A1 fixed vestibule corrugation shadow seam",
      color: 0xb8bbb9,
      roughness: 0.82,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    pipe: new THREE.MeshStandardMaterial({
      name: "A1 fixed vestibule white service pipe",
      color: 0xd1d1ca,
      roughness: 0.72,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      name: "A1 fixed vestibule utility dark metal",
      color: 0x4b5052,
      roughness: 0.68,
      metalness: 0.32,
      side: THREE.DoubleSide,
    }),
    equipment: new THREE.MeshStandardMaterial({
      name: "A1 Cavotec-style utility enclosure",
      color: 0xbfc2bd,
      roughness: 0.74,
      metalness: 0.16,
      side: THREE.DoubleSide,
    }),
    hose: new THREE.MeshStandardMaterial({
      name: "A1 fixed vestibule yellow conditioned-air hose",
      color: 0xb98716,
      roughness: 0.88,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };
}

function segmentFrame(mesh) {
  const parameters = mesh?.geometry?.parameters;
  const length = Number(parameters?.depth || 0);
  if (!(length > 1)) throw new Error("A1 main vestibule roof is missing its authored segment depth");
  const yaw = mesh.rotation.y;
  return Object.freeze({
    centerX: mesh.position.x,
    centerY: mesh.position.y,
    centerZ: mesh.position.z,
    length,
    yaw,
    ux: Math.sin(yaw),
    uz: Math.cos(yaw),
    sideX: Math.cos(yaw),
    sideZ: -Math.sin(yaw),
  });
}

export function decorateA1PhotoVestibule(THREE, group, fleet) {
  const connector = fleet?.getObjectByName?.("UploadedAirportJetwayTerminalConnector_A1");
  if (!connector?.isGroup) throw new Error("A1 photo detail requires the fixed terminal connector group");
  if (connector.userData.photoDetailAuthority === DETAIL_AUTHORITY) {
    return connector.userData.photoDetailReport;
  }

  const roof = connector.getObjectByName("UploadedAirportJetwayA1MainVestibuleRoof");
  const floor = connector.getObjectByName("UploadedAirportJetwayA1MainVestibuleFloor");
  if (!roof?.isMesh || !floor?.isMesh) {
    throw new Error("A1 photo detail could not resolve the main fixed vestibule shell");
  }

  const frame = segmentFrame(roof);
  const materials = createMaterials(THREE);
  const detail = new THREE.Group();
  detail.name = "UploadedAirportJetwayA1PhotoMatchedFixedVestibuleDetails";
  const width = 3.18;
  const halfWidth = width * 0.5;
  const wallHeight = 2.72;
  const ribSpacing = 0.48;
  const ribCountAlongLength = Math.max(8, Math.floor(frame.length / ribSpacing));
  let ribCount = 0;

  for (let index = 1; index < ribCountAlongLength; index += 1) {
    const along = -frame.length * 0.5 + (frame.length * index) / ribCountAlongLength;
    const baseX = frame.centerX + frame.ux * along;
    const baseZ = frame.centerZ + frame.uz * along;
    for (const side of [-1, 1]) {
      addBox(
        THREE,
        detail,
        materials.seam,
        `UploadedAirportJetwayA1PhotoWallRib_${index}_${side}`,
        [0.075, wallHeight * 0.94, 0.085],
        [
          baseX + frame.sideX * side * (halfWidth + 0.045),
          floor.position.y + wallHeight * 0.5,
          baseZ + frame.sideZ * side * (halfWidth + 0.045),
        ],
        frame.yaw,
        false,
      );
      ribCount += 1;
    }
  }

  const pipeStartAlong = -frame.length * 0.38;
  const pipeEndAlong = frame.length * 0.34;
  const pipeY = floor.position.y - 0.28;
  let pipeCount = 0;
  for (const side of [-0.72, 0.72]) {
    const start = new THREE.Vector3(
      frame.centerX + frame.ux * pipeStartAlong + frame.sideX * side,
      pipeY,
      frame.centerZ + frame.uz * pipeStartAlong + frame.sideZ * side,
    );
    const end = new THREE.Vector3(
      frame.centerX + frame.ux * pipeEndAlong + frame.sideX * side,
      pipeY,
      frame.centerZ + frame.uz * pipeEndAlong + frame.sideZ * side,
    );
    addCylinderBetween(
      THREE,
      detail,
      materials.pipe,
      `UploadedAirportJetwayA1PhotoServicePipe_${pipeCount}`,
      start,
      end,
      0.115,
      16,
    );
    pipeCount += 1;
  }

  const groundY = -Number(fleet.position.y || 0);
  const supportAlong = frame.length * 0.31;
  const supportX = frame.centerX + frame.ux * supportAlong;
  const supportZ = frame.centerZ + frame.uz * supportAlong;
  const supportTopY = floor.position.y - 0.05;
  const supportHeight = Math.max(1.2, supportTopY - groundY);
  const support = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.5, supportHeight, 18, 1, false),
    materials.whiteMetal,
  );
  support.name = "UploadedAirportJetwayA1PhotoTerminalSupportColumn";
  support.position.set(supportX, groundY + supportHeight * 0.5, supportZ);
  support.castShadow = true;
  support.receiveShadow = true;
  detail.add(support);

  const equipmentAlong = frame.length * 0.16;
  const equipmentX = frame.centerX + frame.ux * equipmentAlong + frame.sideX * 1.15;
  const equipmentZ = frame.centerZ + frame.uz * equipmentAlong + frame.sideZ * 1.15;
  const equipmentCenterY = groundY + 0.72;
  addBox(
    THREE,
    detail,
    materials.equipment,
    "UploadedAirportJetwayA1PhotoUtilityUnit",
    [1.6, 1.25, 2.05],
    [equipmentX, equipmentCenterY, equipmentZ],
    frame.yaw,
  );
  let ventCount = 0;
  for (let index = -4; index <= 4; index += 1) {
    addBox(
      THREE,
      detail,
      materials.darkMetal,
      `UploadedAirportJetwayA1PhotoUtilityVent_${index}`,
      [0.04, 0.72, 0.09],
      [
        equipmentX + frame.sideX * 0.83 + frame.ux * index * 0.14,
        equipmentCenterY + 0.06,
        equipmentZ + frame.sideZ * 0.83 + frame.uz * index * 0.14,
      ],
      frame.yaw,
      false,
    );
    ventCount += 1;
  }

  const hoseStart = new THREE.Vector3(
    equipmentX - frame.ux * 0.72,
    equipmentCenterY - 0.15,
    equipmentZ - frame.uz * 0.72,
  );
  const hoseEnd = new THREE.Vector3(
    supportX - frame.ux * 1.1 + frame.sideX * 0.55,
    floor.position.y - 0.38,
    supportZ - frame.uz * 1.1 + frame.sideZ * 0.55,
  );
  addCylinderBetween(
    THREE,
    detail,
    materials.hose,
    "UploadedAirportJetwayA1PhotoConditionedAirHose",
    hoseStart,
    hoseEnd,
    0.16,
    18,
  );

  connector.add(detail);
  const report = Object.freeze({
    authority: DETAIL_AUTHORITY,
    ribCount,
    pipeCount,
    supportCount: 1,
    utilityUnitCount: 1,
    ventCount,
    hoseCount: 1,
    mainVestibuleLengthMeters: frame.length,
  });
  connector.userData.photoDetailAuthority = DETAIL_AUTHORITY;
  connector.userData.photoDetailReport = report;
  group.userData.uploadedJetwayA1PhotoDetailAuthority = report.authority;
  group.userData.uploadedJetwayA1PhotoWallRibCount = report.ribCount;
  group.userData.uploadedJetwayA1PhotoServicePipeCount = report.pipeCount;
  group.userData.uploadedJetwayA1PhotoSupportCount = report.supportCount;
  group.userData.uploadedJetwayA1PhotoUtilityUnitCount = report.utilityUnitCount;
  group.userData.uploadedJetwayA1PhotoVentCount = report.ventCount;
  group.userData.uploadedJetwayA1PhotoHoseCount = report.hoseCount;
  return report;
}

export { DETAIL_AUTHORITY as A1_PHOTO_VESTIBULE_DETAIL_AUTHORITY };
