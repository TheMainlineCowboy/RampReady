import * as THREE from "three";

function material(name, color, roughness, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    roughness,
    metalness,
    side: THREE.DoubleSide,
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

function addB15Portal(root, materials, x, z, gate) {
  const faceX = x + 0.12;
  addBox(
    root,
    `Terminal4_${gate}_JetwayPortalRecess_V18`,
    materials.portal,
    [faceX, 4.25, z],
    [0.18, 2.8, 3.75],
  );
  for (const side of [-1, 1]) {
    addBox(
      root,
      `Terminal4_${gate}_JetwayPortalPost_${side}_V18`,
      materials.frame,
      [faceX + 0.12, 4.25, z + side * 1.95],
      [0.2, 3.15, 0.22],
    );
  }
  addBox(
    root,
    `Terminal4_${gate}_JetwayPortalHeader_V18`,
    materials.frame,
    [faceX + 0.12, 5.75, z],
    [0.2, 0.22, 4.1],
  );
  addBox(
    root,
    `Terminal4_${gate}_JetwayPortalSill_V18`,
    materials.frame,
    [faceX + 0.12, 2.73, z],
    [0.2, 0.18, 4.1],
  );
  addBox(
    root,
    `Terminal4_${gate}_RampPortalNumberPanel_V18`,
    materials.sign,
    [faceX + 0.24, 5.12, z - 1.46],
    [0.08, 0.48, 0.72],
  );
}

export function installTerminal4BConcourseDetailV18(root, bounds) {
  if (!root?.isGroup) throw new Error("Terminal 4 B-concourse detail requires the rebuilt pier group");
  const existing = root.getObjectByName("Terminal4_BConcourse_SimulatorDetail_V18");
  if (existing) return existing;

  const detail = new THREE.Group();
  detail.name = "Terminal4_BConcourse_SimulatorDetail_V18";
  const panelJoint = material("Terminal 4 B-concourse panel joint", 0x8d8173, 0.82, 0.03);
  const curb = material("Terminal 4 B-concourse ramp curb", 0x5d5954, 0.92, 0.02);
  const frame = material("Terminal 4 B-concourse portal frame", 0x5f676a, 0.62, 0.32);
  const portal = material("Terminal 4 B-concourse jetway portal recess", 0x20292d, 0.78, 0.08);
  const sign = material("Terminal 4 B-concourse gate sign panel", 0x252a2d, 0.74, 0.18);
  const roofEquipment = material("Terminal 4 B-concourse roof equipment", 0x858b8d, 0.76, 0.22);
  const roofDark = material("Terminal 4 B-concourse roof equipment grille", 0x3f474a, 0.7, 0.3);
  const materials = { panelJoint, curb, frame, portal, sign, roofEquipment, roofDark };

  const { mainXMin, mainXMax, mainZMin, mainZMax, b15XMin, b15XMax, b15ZMin, b15ZMax } = bounds;
  const mainCenterX = (mainXMin + mainXMax) / 2;
  const mainLength = mainXMax - mainXMin;
  const b15CenterZ = (b15ZMin + b15ZMax) / 2;
  const b15Length = b15ZMax - b15ZMin;

  // Continuous curbs visually seat the rebuilt terminal on the ramp.
  for (const z of [mainZMin - 0.25, mainZMax + 0.25]) {
    addBox(detail, `Terminal4_BConcourse_MainCurb_${z}_V18`, curb, [mainCenterX, 0.14, z], [mainLength, 0.28, 0.34]);
  }
  for (const x of [b15XMin - 0.25, b15XMax + 0.25]) {
    addBox(detail, `Terminal4_B15Pier_Curb_${x}_V18`, curb, [x, 0.14, b15CenterZ], [0.34, 0.28, b15Length]);
  }

  // Source-scale facade panel joints break up the large daylight wall planes.
  for (let x = mainXMin + 6; x < mainXMax - 4; x += 6.6) {
    for (const z of [mainZMin - 0.12, mainZMax + 0.12]) {
      addBox(detail, `Terminal4_BConcourse_MainPanelJoint_${x.toFixed(1)}_${z}_V18`, panelJoint, [x, 1.66, z], [0.055, 3.2, 0.07]);
    }
  }
  for (let z = b15ZMin + 6; z < b15ZMax - 4; z += 6.6) {
    for (const x of [b15XMin - 0.12, b15XMax + 0.12]) {
      addBox(detail, `Terminal4_B15Pier_PanelJoint_${z.toFixed(1)}_${x}_V18`, panelJoint, [x, 1.66, z], [0.07, 3.2, 0.055]);
    }
  }

  // Exact source rotunda positions receive framed terminal portals.
  addB15Portal(detail, materials, b15XMax, 527.23, "B15L");
  addB15Portal(detail, materials, b15XMax, 551.03, "B15M");

  // Parapets and irregular rooftop equipment give the pier a real terminal silhouette.
  for (const z of [mainZMin - 0.55, mainZMax + 0.55]) {
    addBox(detail, `Terminal4_BConcourse_MainParapet_${z}_V18`, curb, [mainCenterX, 7.26, z], [mainLength + 1.1, 0.34, 0.24]);
  }
  for (const x of [b15XMin - 0.55, b15XMax + 0.55]) {
    addBox(detail, `Terminal4_B15Pier_Parapet_${x}_V18`, curb, [x, 7.26, b15CenterZ], [0.24, 0.34, b15Length + 1.1]);
  }
  const rooftopUnits = [
    ["B15_North", -46.2, 535.0, 5.6, 1.0, 3.2],
    ["B15_South", -45.4, 479.0, 4.2, 0.82, 2.7],
    ["B15_Central", -46.8, 420.0, 6.4, 1.15, 3.6],
    ["Main_West", 18.0, 427.0, 7.2, 1.2, 3.2],
    ["Main_Center", 88.0, 429.5, 5.5, 0.92, 4.0],
    ["Main_East", 164.0, 425.0, 8.0, 1.32, 3.3],
  ];
  for (const [name, x, z, width, height, depth] of rooftopUnits) {
    addBox(detail, `Terminal4_BConcourse_RooftopUnit_${name}_V18`, roofEquipment, [x, 7.15 + height / 2, z], [width, height, depth]);
    addBox(detail, `Terminal4_BConcourse_RooftopGrille_${name}_V18`, roofDark, [x, 7.18 + height, z + depth / 2 + 0.04], [width * 0.72, height * 0.45, 0.08]);
  }

  detail.userData.authority = "source-aligned-B-concourse-panel-portals-curbs-parapets-rooftop-detail-v18";
  detail.userData.b15Portals = Object.freeze(["B15L", "B15M"]);
  detail.userData.panelJointSpacingMeters = 6.6;
  detail.userData.rooftopUnitCount = rooftopUnits.length;
  root.add(detail);
  return detail;
}
