import * as THREE from "three";

function material(name, color, roughness, metalness = 0.02, extra = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
    ...extra,
  });
}

function addBox(parent, name, sourceMaterial, position, size, yaw = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), sourceMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = yaw;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, sourceMaterial, position, radius, height, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), sourceMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function addFacadeModule(root, materials, axis, face, center, index, prefix) {
  const alternating = index % 3 === 0 ? materials.wallDark : materials.wallRelief;
  if (axis === "x") {
    addBox(root, `${prefix}_Relief_${index}`, alternating, [center, 1.7, face], [5.72, 2.8, 0.12]);
    addBox(root, `${prefix}_Pilaster_${index}`, materials.pilaster, [center - 2.93, 2.15, face + Math.sign(face) * 0.045], [0.14, 4.95, 0.17]);
    if (index % 4 === 1) {
      addBox(root, `${prefix}_ServiceDoor_${index}`, materials.door, [center + 1.45, 1.06, face + Math.sign(face) * 0.085], [1.18, 2.08, 0.1]);
      addBox(root, `${prefix}_DoorHeader_${index}`, materials.frame, [center + 1.45, 2.2, face + Math.sign(face) * 0.12], [1.42, 0.12, 0.12]);
    } else if (index % 4 === 3) {
      addBox(root, `${prefix}_Vent_${index}`, materials.vent, [center + 1.35, 1.62, face + Math.sign(face) * 0.09], [1.6, 0.52, 0.11]);
    }
  } else {
    addBox(root, `${prefix}_Relief_${index}`, alternating, [face, 1.7, center], [0.12, 2.8, 5.72]);
    addBox(root, `${prefix}_Pilaster_${index}`, materials.pilaster, [face + Math.sign(face) * 0.045, 2.15, center - 2.93], [0.17, 4.95, 0.14]);
    if (index % 4 === 1) {
      addBox(root, `${prefix}_ServiceDoor_${index}`, materials.door, [face + Math.sign(face) * 0.085, 1.06, center + 1.45], [0.1, 2.08, 1.18]);
      addBox(root, `${prefix}_DoorHeader_${index}`, materials.frame, [face + Math.sign(face) * 0.12, 2.2, center + 1.45], [0.12, 0.12, 1.42]);
    } else if (index % 4 === 3) {
      addBox(root, `${prefix}_Vent_${index}`, materials.vent, [face + Math.sign(face) * 0.09, 1.62, center + 1.35], [0.11, 0.52, 1.6]);
    }
  }
}

function addB15Portal(root, materials, x, z, gate) {
  const faceX = x + 0.12;
  const vestibuleX = x + 0.62;

  // Recess and rubber seal are deliberately dark so the bridge reads as entering
  // a real terminal opening instead of intersecting a flat beige box.
  addBox(root, `Terminal4_${gate}_JetwayPortalRecess_V18`, materials.portal, [faceX, 4.25, z], [0.22, 2.9, 3.72]);
  addBox(root, `Terminal4_${gate}_JetwayPortalSeal_V18`, materials.rubber, [faceX + 0.13, 4.25, z], [0.13, 2.6, 3.38]);

  // Projected vestibule around the source rotunda; the shallow projection stays
  // behind the moving jetway and gives the facade depth in ramp-level views.
  for (const side of [-1, 1]) {
    addBox(root, `Terminal4_${gate}_VestibuleSide_${side}_V18`, materials.upperWall, [vestibuleX, 4.25, z + side * 2.05], [1.15, 3.18, 0.24]);
    addBox(root, `Terminal4_${gate}_PortalPost_${side}_V18`, materials.frame, [x + 1.22, 4.25, z + side * 1.9], [0.22, 3.26, 0.22]);
  }
  addBox(root, `Terminal4_${gate}_VestibuleRoof_V18`, materials.roof, [vestibuleX, 5.94, z], [1.32, 0.22, 4.55]);
  addBox(root, `Terminal4_${gate}_PortalHeader_V18`, materials.frame, [x + 1.22, 5.82, z], [0.22, 0.24, 4.04]);
  addBox(root, `Terminal4_${gate}_PortalSill_V18`, materials.frame, [x + 1.22, 2.72, z], [0.22, 0.18, 4.04]);

  // Gate ID panel and a small ramp service cabinet provide readable scale.
  addBox(root, `Terminal4_${gate}_GatePanel_V18`, materials.sign, [x + 1.35, 5.18, z - 1.52], [0.1, 0.58, 0.86]);
  addBox(root, `Terminal4_${gate}_ServiceCabinet_V18`, materials.cabinet, [x + 0.36, 1.05, z + 2.65], [0.72, 1.74, 0.72]);
  addBox(root, `Terminal4_${gate}_CabinetDoor_V18`, materials.frame, [x + 0.73, 1.05, z + 2.65], [0.05, 1.46, 0.55]);
}

function addRoofUnit(root, materials, name, x, z, width, height, depth, yaw = 0) {
  addBox(root, `Terminal4_BConcourse_RooftopUnit_${name}_V18`, materials.roofEquipment, [x, 7.2 + height / 2, z], [width, height, depth], yaw);
  addBox(root, `Terminal4_BConcourse_RooftopUnitTop_${name}_V18`, materials.roofLight, [x, 7.23 + height, z], [width + 0.12, 0.08, depth + 0.12], yaw);
  addBox(root, `Terminal4_BConcourse_RooftopGrille_${name}_V18`, materials.roofDark, [x, 7.24 + height * 0.58, z + depth / 2 + 0.055], [width * 0.72, height * 0.45, 0.08], yaw);
}

function addFloodlight(root, materials, name, x, z, height = 7.2) {
  addCylinder(root, `Terminal4_BConcourse_FloodlightPole_${name}_V18`, materials.pole, [x, 7.24 + height / 2, z], 0.09, height, 12);
  addBox(root, `Terminal4_BConcourse_FloodlightHead_${name}_V18`, materials.lamp, [x, 7.24 + height, z], [0.72, 0.28, 0.3]);
  addBox(root, `Terminal4_BConcourse_FloodlightLens_${name}_V18`, materials.lens, [x, 7.22 + height, z + 0.17], [0.58, 0.16, 0.05]);
}

export function installTerminal4BConcourseDetailV18(root, bounds) {
  if (!root?.isGroup) throw new Error("Terminal 4 B-concourse detail requires the rebuilt pier group");
  const existing = root.getObjectByName("Terminal4_BConcourse_SimulatorDetail_V18");
  if (existing) return existing;

  const detail = new THREE.Group();
  detail.name = "Terminal4_BConcourse_SimulatorDetail_V18";

  const wallRelief = material("Terminal 4 B-concourse facade relief", 0xb7aa97, 0.88, 0.015);
  const wallDark = material("Terminal 4 B-concourse alternate facade panel", 0xa99b88, 0.9, 0.015);
  const upperWall = material("Terminal 4 B-concourse vestibule wall", 0xd1c5b4, 0.84, 0.02);
  const panelJoint = material("Terminal 4 B-concourse panel joint", 0x71685f, 0.82, 0.04);
  const pilaster = material("Terminal 4 B-concourse vertical pilaster", 0x877b6e, 0.82, 0.05);
  const curb = material("Terminal 4 B-concourse ramp curb", 0x57534e, 0.94, 0.02);
  const plinth = material("Terminal 4 B-concourse dark lower plinth", 0x5e5d59, 0.9, 0.04);
  const frame = material("Terminal 4 B-concourse portal frame", 0x4d575b, 0.6, 0.36);
  const portal = material("Terminal 4 B-concourse jetway portal recess", 0x151b1e, 0.8, 0.08);
  const rubber = material("Terminal 4 B-concourse portal rubber seal", 0x0f1214, 0.96, 0.01);
  const sign = material("Terminal 4 B-concourse gate sign panel", 0x1e2529, 0.7, 0.18);
  const door = material("Terminal 4 B-concourse service door", 0x60696d, 0.7, 0.18);
  const vent = material("Terminal 4 B-concourse ventilation grille", 0x363f43, 0.62, 0.34);
  const cabinet = material("Terminal 4 B-concourse ramp cabinet", 0xc2b7a6, 0.82, 0.08);
  const roof = material("Terminal 4 B-concourse vestibule roof", 0xd9d5ce, 0.9, 0.02);
  const roofEquipment = material("Terminal 4 B-concourse roof equipment", 0x7a8285, 0.76, 0.24);
  const roofLight = material("Terminal 4 B-concourse roof equipment cap", 0xaab0b1, 0.74, 0.18);
  const roofDark = material("Terminal 4 B-concourse roof equipment grille", 0x333b3f, 0.68, 0.32);
  const pole = material("Terminal 4 B-concourse floodlight pole", 0x626a6d, 0.58, 0.46);
  const lamp = material("Terminal 4 B-concourse floodlight housing", 0x3c4448, 0.58, 0.38);
  const lens = material("Terminal 4 B-concourse floodlight lens", 0xd9e2df, 0.32, 0.04, {
    emissive: 0x95a6a2,
    emissiveIntensity: 0.28,
  });
  const materials = {
    wallRelief,
    wallDark,
    upperWall,
    panelJoint,
    pilaster,
    curb,
    plinth,
    frame,
    portal,
    rubber,
    sign,
    door,
    vent,
    cabinet,
    roof,
    roofEquipment,
    roofLight,
    roofDark,
    pole,
    lamp,
    lens,
  };

  const { mainXMin, mainXMax, mainZMin, mainZMax, b15XMin, b15XMax, b15ZMin, b15ZMax } = bounds;
  const mainCenterX = (mainXMin + mainXMax) / 2;
  const mainLength = mainXMax - mainXMin;
  const b15CenterZ = (b15ZMin + b15ZMax) / 2;
  const b15Length = b15ZMax - b15ZMin;

  // Continuous curbs and a dark lower plinth seat the synthetic pier on the ramp.
  for (const z of [mainZMin - 0.25, mainZMax + 0.25]) {
    addBox(detail, `Terminal4_BConcourse_MainCurb_${z}_V18`, curb, [mainCenterX, 0.14, z], [mainLength, 0.28, 0.34]);
    addBox(detail, `Terminal4_BConcourse_MainPlinth_${z}_V18`, plinth, [mainCenterX, 0.48, z], [mainLength, 0.68, 0.18]);
  }
  for (const x of [b15XMin - 0.25, b15XMax + 0.25]) {
    addBox(detail, `Terminal4_B15Pier_Curb_${x}_V18`, curb, [x, 0.14, b15CenterZ], [0.34, 0.28, b15Length]);
    addBox(detail, `Terminal4_B15Pier_Plinth_${x}_V18`, plinth, [x, 0.48, b15CenterZ], [0.18, 0.68, b15Length]);
  }

  // Alternating shallow relief panels, pilasters, doors and vents break up the
  // featureless wall planes without repeating a row of open service bays.
  let mainModuleCount = 0;
  for (let x = mainXMin + 3.2; x < mainXMax - 2.8; x += 6.35) {
    for (const z of [mainZMin - 0.18, mainZMax + 0.18]) {
      addFacadeModule(detail, materials, "x", z, x, mainModuleCount, `Terminal4_BConcourse_Main_${z}`);
    }
    mainModuleCount += 1;
  }
  let b15ModuleCount = 0;
  for (let z = b15ZMin + 3.2; z < b15ZMax - 2.8; z += 6.35) {
    for (const x of [b15XMin - 0.18, b15XMax + 0.18]) {
      addFacadeModule(detail, materials, "z", x, z, b15ModuleCount, `Terminal4_B15Pier_${x}`);
    }
    b15ModuleCount += 1;
  }

  // Stronger panel joints continue through the upper wall and window band.
  for (let x = mainXMin + 6; x < mainXMax - 4; x += 6.6) {
    for (const z of [mainZMin - 0.24, mainZMax + 0.24]) {
      addBox(detail, `Terminal4_BConcourse_MainPanelJoint_${x.toFixed(1)}_${z}_V18`, panelJoint, [x, 4.62, z], [0.075, 5.1, 0.08]);
    }
  }
  for (let z = b15ZMin + 6; z < b15ZMax - 4; z += 6.6) {
    for (const x of [b15XMin - 0.24, b15XMax + 0.24]) {
      addBox(detail, `Terminal4_B15Pier_PanelJoint_${z.toFixed(1)}_${x}_V18`, panelJoint, [x, 4.62, z], [0.08, 5.1, 0.075]);
    }
  }

  // Exact source rotunda positions receive projected, framed terminal portals.
  addB15Portal(detail, materials, b15XMax, 527.23, "B15L");
  addB15Portal(detail, materials, b15XMax, 551.03, "B15M");

  // Parapets, mechanical equipment and floodlights form an irregular skyline.
  for (const z of [mainZMin - 0.55, mainZMax + 0.55]) {
    addBox(detail, `Terminal4_BConcourse_MainParapet_${z}_V18`, curb, [mainCenterX, 7.3, z], [mainLength + 1.1, 0.42, 0.24]);
  }
  for (const x of [b15XMin - 0.55, b15XMax + 0.55]) {
    addBox(detail, `Terminal4_B15Pier_Parapet_${x}_V18`, curb, [x, 7.3, b15CenterZ], [0.24, 0.42, b15Length + 1.1]);
  }

  const rooftopUnits = [
    ["B15_North", -46.2, 535.0, 5.6, 1.0, 3.2, 0],
    ["B15_South", -45.4, 479.0, 4.2, 0.82, 2.7, Math.PI / 2],
    ["B15_Central", -46.8, 420.0, 6.4, 1.15, 3.6, 0],
    ["B15_Connector", -45.2, 350.0, 4.5, 0.92, 3.1, Math.PI / 2],
    ["Main_West", 18.0, 427.0, 7.2, 1.2, 3.2, 0],
    ["Main_Center", 88.0, 429.5, 5.5, 0.92, 4.0, Math.PI / 2],
    ["Main_East", 164.0, 425.0, 8.0, 1.32, 3.3, 0],
  ];
  for (const [name, x, z, width, height, depth, yaw] of rooftopUnits) {
    addRoofUnit(detail, materials, name, x, z, width, height, depth, yaw);
  }

  for (const [name, x, z, height] of [
    ["B15L", -43.5, 523.0, 6.8],
    ["B15M", -43.8, 555.2, 7.4],
    ["B15_South", -44.2, 390.0, 6.4],
    ["Main_West", 8.0, 446.0, 7.0],
    ["Main_Center", 96.0, 406.5, 6.8],
    ["Main_East", 190.0, 446.0, 7.3],
  ]) {
    addFloodlight(detail, materials, name, x, z, height);
  }

  detail.userData.authority = "source-aligned-B-concourse-relief-portals-equipment-floodlights-v18";
  detail.userData.b15Portals = Object.freeze(["B15L", "B15M"]);
  detail.userData.panelJointSpacingMeters = 6.6;
  detail.userData.facadeModuleSpacingMeters = 6.35;
  detail.userData.rooftopUnitCount = rooftopUnits.length;
  detail.userData.floodlightCount = 6;
  root.add(detail);
  return detail;
}
