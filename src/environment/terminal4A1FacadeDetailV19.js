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

function hideLegacyA1FacadePatch(group) {
  const names = [
    "Terminal4_A1_SolidLowerFacadePanels",
    "Terminal4_A1_LowerFacadeCurbs",
    "Terminal4_A1_ServiceDoor",
    "Terminal4_A1_VentilationGrille",
  ];
  let hidden = 0;
  for (const name of names) {
    const object = group.getObjectByName(name);
    if (!object) continue;
    object.visible = false;
    object.castShadow = false;
    hidden += 1;
  }
  return hidden;
}

function addGateSign(parent, anchor, normal, quaternion) {
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
  sign.position.copy(anchor).addScaledVector(normal, 0.12).setY(5.44);
  sign.quaternion.copy(quaternion);
  sign.renderOrder = 4;
  parent.add(sign);
  return sign;
}

export function installTerminal4A1FacadeDetailV19(group) {
  if (!group?.isGroup) throw new Error("A1 facade detail requires the source-placed Terminal 4 jetway group");
  const existing = group.getObjectByName("Terminal4_A1_RampFacadeDetail_V19");
  if (existing) return existing;

  const legacyFacadeObjectCount = hideLegacyA1FacadePatch(group);
  const root = new THREE.Group();
  root.name = "Terminal4_A1_RampFacadeDetail_V19";

  // Exact BGATE1 wall plane already used by the measured A1 connector. The
  // legacy emergency closure was centered 0.24 m behind this plane and exposed
  // its blank front face. These replacement bays sit on the exact plane, while
  // every door, grille and sign is offset toward the ramp-facing normal.
  const normal = new THREE.Vector3(0.580968, 0, -0.813927);
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
  const exactWall = new THREE.Vector3(-3.55299146, 0, -40.60699866);
  const facadeCenter = exactWall.clone().addScaledVector(normal, -0.08);
  const frontPlane = exactWall.clone().addScaledVector(normal, 0.08);
  const yaw = Math.atan2(normal.x, normal.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

  const facade = standard("Terminal 4 A1 precast concrete facade", 0xbfb19e, 0.9, 0.015);
  const facadeAlternate = standard("Terminal 4 A1 alternate precast bay", 0xb4a694, 0.9, 0.015);
  const joint = standard("Terminal 4 A1 concrete panel joint", 0x71685e, 0.9, 0.02);
  const frame = standard("Terminal 4 A1 galvanized portal frame", 0x596165, 0.62, 0.35);
  const portal = standard("Terminal 4 A1 dark portal recess", 0x171c1f, 0.84, 0.08);
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

  // Two compact 6.8 m bays replace the former 21.2 m monolithic wall. The
  // 3.2 m center opening remains clear for the measured bridge portal.
  for (const [index, side] of [-1, 1].entries()) {
    const center = facadeCenter.clone().addScaledVector(tangent, side * 5.0).setY(1.72);
    addBox(
      root,
      `Terminal4_A1_CompactFacadeBay_${index}_V19`,
      index === 0 ? facade : facadeAlternate,
      center,
      [6.8, 3.36, 0.24],
      quaternion,
    );
    addBox(
      root,
      `Terminal4_A1_CompactFacadePlinth_${index}_V19`,
      plinth,
      frontPlane.clone().addScaledVector(tangent, side * 5.0).setY(0.43),
      [6.8, 0.68, 0.13],
      quaternion,
    );
    addBox(
      root,
      `Terminal4_A1_CompactProtectionRail_${index}_V19`,
      bumper,
      frontPlane.clone().addScaledVector(tangent, side * 5.0).addScaledVector(normal, 0.09).setY(1.14),
      [6.45, 0.13, 0.13],
      quaternion,
    );
  }

  // Irregular precast joints make the wall read as a real terminal elevation.
  for (const [index, offset] of [-7.75, -5.25, -2.55, 2.55, 5.25, 7.75].entries()) {
    addBox(
      root,
      `Terminal4_A1_PanelJoint_${index}_V19`,
      joint,
      frontPlane.clone().addScaledVector(tangent, offset).addScaledVector(normal, 0.09).setY(1.73),
      [0.085, 3.2, 0.07],
      quaternion,
    );
  }

  const doors = [
    { offset: 6.35, width: 1.34, height: 2.16 },
    { offset: -6.45, width: 1.10, height: 2.02 },
  ];
  for (const [index, entry] of doors.entries()) {
    const base = frontPlane.clone().addScaledVector(tangent, entry.offset).addScaledVector(normal, 0.12);
    addBox(root, `Terminal4_A1_ServiceDoorFrame_${index}_V19`, frame, base.clone().setY(entry.height / 2 + 0.06), [entry.width + 0.22, entry.height + 0.22, 0.13], quaternion);
    addBox(root, `Terminal4_A1_ServiceDoor_${index}_V19`, door, base.clone().addScaledVector(normal, 0.08).setY(entry.height / 2 + 0.06), [entry.width, entry.height, 0.08], quaternion);
    addBox(root, `Terminal4_A1_ServiceDoorInset_${index}_V19`, doorInset, base.clone().addScaledVector(tangent, entry.width * 0.32).addScaledVector(normal, 0.14).setY(1.1), [0.07, 0.18, 0.04], quaternion);
  }

  for (const [index, entry] of [
    { offset: -4.15, y: 2.02, width: 1.58, height: 0.5 },
    { offset: 4.05, y: 2.24, width: 1.16, height: 0.42 },
  ].entries()) {
    const base = frontPlane.clone().addScaledVector(tangent, entry.offset).addScaledVector(normal, 0.13).setY(entry.y);
    addBox(root, `Terminal4_A1_VentFrame_${index}_V19`, frame, base, [entry.width + 0.16, entry.height + 0.14, 0.11], quaternion);
    addBox(root, `Terminal4_A1_Vent_${index}_V19`, vent, base.clone().addScaledVector(normal, 0.08), [entry.width, entry.height, 0.07], quaternion);
    for (let slat = -0.34; slat <= 0.34; slat += 0.17) {
      addBox(
        root,
        `Terminal4_A1_VentSlat_${index}_${slat.toFixed(2)}_V19`,
        frame,
        base.clone().addScaledVector(tangent, slat * entry.width).addScaledVector(normal, 0.13),
        [0.035, entry.height * 0.78, 0.025],
        quaternion,
      );
    }
  }

  for (const [index, offset] of [-2.35, 2.32].entries()) {
    const base = frontPlane.clone().addScaledVector(tangent, offset).addScaledVector(normal, 0.28);
    addBox(root, `Terminal4_A1_UtilityCabinet_${index}_V19`, cabinet, base.clone().setY(0.96), [0.82, 1.42, 0.4], quaternion);
    addBox(root, `Terminal4_A1_UtilityCabinetDoor_${index}_V19`, cabinetDoor, base.clone().addScaledVector(normal, 0.23).setY(0.96), [0.63, 1.14, 0.04], quaternion);
  }

  // Real recessed bridge penetration and trim on the ramp-facing side.
  addBox(root, "Terminal4_A1_PortalRecess_V19", portal, frontPlane.clone().addScaledVector(normal, 0.06).setY(4.36), [3.18, 2.94, 0.16], quaternion);
  for (const side of [-1, 1]) {
    addBox(
      root,
      `Terminal4_A1_PortalPost_${side}_V19`,
      frame,
      frontPlane.clone().addScaledVector(tangent, side * 1.7).addScaledVector(normal, 0.18).setY(4.38),
      [0.22, 3.18, 0.22],
      quaternion,
    );
  }
  addBox(root, "Terminal4_A1_PortalHeader_V19", frame, frontPlane.clone().addScaledVector(normal, 0.18).setY(5.91), [3.62, 0.22, 0.22], quaternion);
  addBox(root, "Terminal4_A1_PortalSill_V19", frame, frontPlane.clone().addScaledVector(normal, 0.18).setY(2.84), [3.62, 0.16, 0.22], quaternion);

  for (const [index, offset] of [-7.55, -3.85, 3.82, 7.5].entries()) {
    const lampBase = frontPlane.clone().addScaledVector(tangent, offset).addScaledVector(normal, 0.24);
    addBox(root, `Terminal4_A1_WallLampHousing_${index}_V19`, lampHousing, lampBase.clone().setY(2.98), [0.46, 0.25, 0.26], quaternion);
    addBox(root, `Terminal4_A1_WallLampLens_${index}_V19`, lampLens, lampBase.clone().addScaledVector(normal, 0.16).setY(2.96), [0.32, 0.13, 0.045], quaternion);
    addBox(root, `Terminal4_A1_Conduit_${index}_V19`, conduit, lampBase.clone().addScaledVector(tangent, -0.3).setY(1.74), [0.05, 2.22, 0.05], quaternion);
  }
  for (const [index, offset] of [-2.0, 1.98, 5.55, 7.15].entries()) {
    const post = frontPlane.clone().addScaledVector(tangent, offset).addScaledVector(normal, 0.92).setY(0.58);
    addBox(root, `Terminal4_A1_Bollard_${index}_V19`, bollard, post, [0.22, 1.05, 0.22], quaternion);
    addBox(root, `Terminal4_A1_BollardFoot_${index}_V19`, plinth, post.clone().setY(0.08), [0.5, 0.16, 0.5], quaternion);
  }

  addGateSign(root, frontPlane, normal, quaternion);

  root.userData.authority = "exact-BGATE1-ramp-facing-compact-facade-doors-vents-portal-sign-v19";
  root.userData.legacyFacadeObjectCountHidden = legacyFacadeObjectCount;
  root.userData.compactFacadePanelCount = 2;
  root.userData.portalClearWidthMeters = 3.2;
  root.userData.panelJointCount = 6;
  root.userData.serviceDoorCount = doors.length;
  root.userData.wallLampCount = 4;
  root.userData.bollardCount = 4;
  group.add(root);
  return root;
}
