import * as THREE from "three";

function standard(name, color, roughness = 0.8, metalness = 0.04, extra = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function addBox(parent, name, material, position, size, quaternion) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.copy(position);
  if (quaternion) mesh.quaternion.copy(quaternion);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function addGateSign(parent, wall, normal, quaternion) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#171d21";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#d8dde0";
  context.lineWidth = 7;
  context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
  context.fillStyle = "#f4f6f6";
  context.font = "700 78px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("A1", canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = "Terminal 4 A1 gate identifier texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.72), material);
  sign.name = "Terminal4_A1_GateIdentifier_V19";
  sign.position.copy(wall).addScaledVector(normal, -0.52).setY(5.55);
  sign.quaternion.copy(quaternion);
  sign.renderOrder = 3;
  parent.add(sign);
  return sign;
}

export function installTerminal4A1FacadeDetailV19(group) {
  if (!group?.isGroup) throw new Error("A1 facade detail requires the source-placed Terminal 4 jetway group");
  const existing = group.getObjectByName("Terminal4_A1_RampFacadeDetail_V19");
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = "Terminal4_A1_RampFacadeDetail_V19";

  // Exact BGATE1 wall authority already used by the A1 connector. All detail is
  // shallow and lies on that same plane; nothing moves the terminal or jetway.
  const normal = new THREE.Vector3(0.580968, 0, -0.813927);
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
  const wall = new THREE.Vector3(-3.55299146, 0, -40.60699866).addScaledVector(normal, -0.52);
  const yaw = Math.atan2(normal.x, normal.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

  const joint = standard("Terminal 4 A1 concrete panel joint", 0x746b62, 0.9, 0.02);
  const frame = standard("Terminal 4 A1 galvanized portal frame", 0x596165, 0.62, 0.35);
  const door = standard("Terminal 4 A1 recessed service door", 0x596267, 0.68, 0.2);
  const doorInset = standard("Terminal 4 A1 service door inset", 0x2d3437, 0.74, 0.18);
  const vent = standard("Terminal 4 A1 louvered ventilation grille", 0x343b3e, 0.64, 0.36);
  const cabinet = standard("Terminal 4 A1 ramp utility cabinet", 0xa99d8e, 0.82, 0.08);
  const cabinetDoor = standard("Terminal 4 A1 utility cabinet door", 0x676d6e, 0.7, 0.22);
  const plinth = standard("Terminal 4 A1 lower facade plinth", 0x55524e, 0.94, 0.02);
  const bumper = standard("Terminal 4 A1 wall protection rail", 0x6b7071, 0.66, 0.34);
  const bollard = standard("Terminal 4 A1 safety bollard", 0xe0ac21, 0.7, 0.16);
  const lampHousing = standard("Terminal 4 A1 wall lamp housing", 0x3f474a, 0.58, 0.38);
  const lampLens = standard("Terminal 4 A1 wall lamp lens", 0xe7e4cf, 0.32, 0.04, {
    emissive: 0xd5d1ad,
    emissiveIntensity: 0.52,
  });
  const conduit = standard("Terminal 4 A1 electrical conduit", 0x777d7e, 0.58, 0.42);

  // Vertical joints divide the former monolithic wall into irregular precast bays.
  for (const [index, offset] of [-9.1, -6.25, -3.55, 3.35, 6.15, 8.85].entries()) {
    const position = wall.clone().addScaledVector(tangent, offset).setY(1.73);
    addBox(root, `Terminal4_A1_PanelJoint_${index}_V19`, joint, position, [0.095, 3.25, 0.08], quaternion);
  }
  for (const side of [-1, 1]) {
    const position = wall.clone().addScaledVector(tangent, side * 6.05).setY(0.46);
    addBox(root, `Terminal4_A1_DarkPlinth_${side}_V19`, plinth, position, [8.9, 0.72, 0.14], quaternion);
    const railPosition = wall.clone().addScaledVector(tangent, side * 6.0).addScaledVector(normal, -0.18).setY(1.14);
    addBox(root, `Terminal4_A1_ProtectionRail_${side}_V19`, bumper, railPosition, [8.7, 0.13, 0.14], quaternion);
  }

  // Two differently sized recessed ramp doors avoid a repeated row of openings.
  const doors = [
    { offset: 6.55, width: 1.38, height: 2.18 },
    { offset: -7.25, width: 1.12, height: 2.02 },
  ];
  for (const [index, entry] of doors.entries()) {
    const base = wall.clone().addScaledVector(tangent, entry.offset).addScaledVector(normal, -0.19);
    addBox(root, `Terminal4_A1_ServiceDoorFrame_${index}_V19`, frame, base.clone().setY(entry.height / 2 + 0.06), [entry.width + 0.22, entry.height + 0.22, 0.13], quaternion);
    addBox(root, `Terminal4_A1_ServiceDoor_${index}_V19`, door, base.clone().addScaledVector(normal, -0.08).setY(entry.height / 2 + 0.06), [entry.width, entry.height, 0.08], quaternion);
    addBox(root, `Terminal4_A1_ServiceDoorInset_${index}_V19`, doorInset, base.clone().addScaledVector(tangent, entry.width * 0.32).addScaledVector(normal, -0.14).setY(1.1), [0.07, 0.18, 0.04], quaternion);
  }

  // Unequal vents and cabinets create real ramp-side utility rhythm.
  for (const [index, entry] of [
    { offset: -4.85, y: 2.02, width: 1.65, height: 0.52 },
    { offset: 4.25, y: 2.28, width: 1.18, height: 0.42 },
  ].entries()) {
    const base = wall.clone().addScaledVector(tangent, entry.offset).addScaledVector(normal, -0.21).setY(entry.y);
    addBox(root, `Terminal4_A1_VentFrame_${index}_V19`, frame, base, [entry.width + 0.16, entry.height + 0.14, 0.11], quaternion);
    addBox(root, `Terminal4_A1_Vent_${index}_V19`, vent, base.clone().addScaledVector(normal, -0.08), [entry.width, entry.height, 0.07], quaternion);
    for (let slat = -0.34; slat <= 0.34; slat += 0.17) {
      addBox(
        root,
        `Terminal4_A1_VentSlat_${index}_${slat.toFixed(2)}_V19`,
        frame,
        base.clone().addScaledVector(tangent, slat * entry.width).addScaledVector(normal, -0.13),
        [0.035, entry.height * 0.78, 0.025],
        quaternion,
      );
    }
  }

  for (const [index, offset] of [-2.65, 2.45].entries()) {
    const base = wall.clone().addScaledVector(tangent, offset).addScaledVector(normal, -0.28);
    addBox(root, `Terminal4_A1_UtilityCabinet_${index}_V19`, cabinet, base.clone().setY(0.96), [0.86, 1.46, 0.42], quaternion);
    addBox(root, `Terminal4_A1_UtilityCabinetDoor_${index}_V19`, cabinetDoor, base.clone().addScaledVector(normal, -0.23).setY(0.96), [0.67, 1.18, 0.04], quaternion);
  }

  // Frame the elevated boarding-bridge penetration so it reads as an authored
  // terminal portal rather than a walkway passing through an undetailed wall.
  for (const side of [-1, 1]) {
    const post = wall.clone().addScaledVector(tangent, side * 1.72).addScaledVector(normal, -0.24).setY(4.38);
    addBox(root, `Terminal4_A1_PortalPost_${side}_V19`, frame, post, [0.22, 3.2, 0.24], quaternion);
  }
  addBox(root, "Terminal4_A1_PortalHeader_V19", frame, wall.clone().addScaledVector(normal, -0.24).setY(5.92), [3.66, 0.22, 0.24], quaternion);
  addBox(root, "Terminal4_A1_PortalSill_V19", frame, wall.clone().addScaledVector(normal, -0.24).setY(2.84), [3.66, 0.16, 0.24], quaternion);

  // Wall lamps, conduits and protected bollards provide scale at tug height.
  for (const [index, offset] of [-8.1, -4.0, 4.05, 8.05].entries()) {
    const lampBase = wall.clone().addScaledVector(tangent, offset).addScaledVector(normal, -0.3);
    addBox(root, `Terminal4_A1_WallLampHousing_${index}_V19`, lampHousing, lampBase.clone().setY(2.98), [0.48, 0.26, 0.28], quaternion);
    addBox(root, `Terminal4_A1_WallLampLens_${index}_V19`, lampLens, lampBase.clone().addScaledVector(normal, -0.17).setY(2.96), [0.34, 0.13, 0.045], quaternion);
    addBox(root, `Terminal4_A1_Conduit_${index}_V19`, conduit, lampBase.clone().addScaledVector(tangent, -0.34).setY(1.74), [0.055, 2.25, 0.055], quaternion);
  }
  for (const [index, offset] of [-2.05, 2.0, 5.75, 7.45].entries()) {
    const post = wall.clone().addScaledVector(tangent, offset).addScaledVector(normal, -1.0).setY(0.58);
    addBox(root, `Terminal4_A1_Bollard_${index}_V19`, bollard, post, [0.22, 1.05, 0.22], quaternion);
    addBox(root, `Terminal4_A1_BollardFoot_${index}_V19`, plinth, post.clone().setY(0.08), [0.5, 0.16, 0.5], quaternion);
  }

  addGateSign(root, wall, normal, quaternion);

  root.userData.authority = "exact-BGATE1-wall-ramp-facade-panel-doors-vents-portal-sign-v19";
  root.userData.panelJointCount = 6;
  root.userData.serviceDoorCount = doors.length;
  root.userData.wallLampCount = 4;
  root.userData.bollardCount = 4;
  group.add(root);
  return root;
}
