import * as THREE from "three";

const HIDDEN_REPETITIVE_DETAIL = /AIR_Jetway01_(?:HorizontalRibs|VerticalRibs|PanelSeams)/i;
const LARGE_SHADOW_CASTER = /AIR_Jetway01_(?:OuterTelescopingTunnels|InnerTelescopingTunnels|AircraftCabins|Rotundas|WallCollars)/i;

function tuneSharedMaterial(material, labels) {
  if (!material) return;
  const label = `${labels} ${material.name || ""}`;
  if (/HorizontalRibs|VerticalRibs|PanelSeams|structural|frame|trim/i.test(label)) {
    material.color?.setHex(0xa5a9aa);
    material.emissive?.setHex(0x111111);
    material.emissiveIntensity = 0.14;
    material.roughness = 0.76;
    material.metalness = 0.18;
  } else if (/OuterTelescopingTunnels|InnerTelescopingTunnels|Rotundas|AircraftCabins|exact-source/i.test(label)) {
    material.color?.setHex(0xffffff);
    // Retain the exact recovered M1DGJETWAY diffuse atlas, but do not let its
    // very dark legacy lightmap turn every bridge into a black pipe in daylight.
    material.emissiveMap = null;
    material.emissive?.setHex(0x929292);
    material.emissiveIntensity = 0.68;
    material.roughness = 0.78;
    material.metalness = 0.04;
  } else if (/FixedTerminalWalkways|WallCollars/i.test(label)) {
    material.map = null;
    material.emissiveMap = null;
    material.color?.setHex(0xe0ddd6);
    material.emissive?.setHex(0x303030);
    material.emissiveIntensity = 0.22;
    material.roughness = 0.82;
    material.metalness = 0.035;
  } else if (/Window|Glass/i.test(label)) {
    material.color?.setHex(0x304650);
    material.roughness = 0.25;
    material.metalness = 0.05;
  } else if (/galvanized|LiftColumns|WheelBogies|Axles|SupportFeet/i.test(label)) {
    material.color?.setHex(0x94999b);
    material.emissive?.setHex(0x070707);
    material.emissiveIntensity = 0.08;
    material.roughness = 0.66;
    material.metalness = 0.3;
  }
  material.needsUpdate = true;
}

function addInstancedBoxes(parent, name, material, records) {
  if (!records.length) return null;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, records.length);
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
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function fixedWalkwayRecords(group) {
  const walkways = group.getObjectByName("AIR_Jetway01_FixedTerminalWalkways_V13");
  if (!walkways?.isInstancedMesh || walkways.count < 1) return [];
  const records = [];
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  for (let instance = 0; instance < walkways.count; instance += 1) {
    walkways.getMatrixAt(instance, matrix);
    matrix.decompose(position, quaternion, scale);
    forward.set(0, 0, 1).applyQuaternion(quaternion).normalize();
    right.set(1, 0, 0).applyQuaternion(quaternion).normalize();
    records.push({
      position: position.clone(),
      quaternion: quaternion.clone(),
      forward: forward.clone(),
      right: right.clone(),
      length: Math.abs(scale.z),
    });
  }
  return records;
}

function installFixedWalkwayArchitecturalDetail(group, records) {
  if (group.getObjectByName("Terminal4_FixedWalkwayArchitecturalDetail_V15")) return 0;
  if (!records.length) return 0;
  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkwayArchitecturalDetail_V15";

  const glass = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway blue-gray glazing",
    color: 0x3e5965,
    emissive: 0x122027,
    emissiveIntensity: 0.18,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.84,
    depthWrite: true,
    side: THREE.DoubleSide,
  });
  const trim = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway architectural trim",
    color: 0xa2a5a3,
    emissive: 0x101010,
    emissiveIntensity: 0.1,
    roughness: 0.7,
    metalness: 0.2,
  });
  const roof = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway light roof cap",
    color: 0xe8e5de,
    emissive: 0x242424,
    emissiveIntensity: 0.16,
    roughness: 0.84,
    metalness: 0.025,
  });

  const windows = [];
  const lowerBelts = [];
  const roofCaps = [];
  const mullions = [];
  for (const record of records) {
    const usableLength = Math.max(1.2, record.length - 0.5);
    for (const side of [-1, 1]) {
      windows.push({
        position: record.position.clone()
          .addScaledVector(record.right, side * 1.255)
          .add(new THREE.Vector3(0, 0.24, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.055, 0.72, usableLength),
      });
      lowerBelts.push({
        position: record.position.clone()
          .addScaledVector(record.right, side * 1.27)
          .add(new THREE.Vector3(0, -0.66, 0)),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.06, 0.34, usableLength),
      });
      for (let along = 1.2; along < record.length - 0.7; along += 2.35) {
        mullions.push({
          position: record.position.clone()
            .addScaledVector(record.forward, along - record.length / 2)
            .addScaledVector(record.right, side * 1.285)
            .add(new THREE.Vector3(0, 0.24, 0)),
          quaternion: record.quaternion,
          scale: new THREE.Vector3(0.075, 0.78, 0.08),
        });
      }
    }
    roofCaps.push({
      position: record.position.clone().add(new THREE.Vector3(0, 1.23, 0)),
      quaternion: record.quaternion,
      scale: new THREE.Vector3(2.58, 0.13, usableLength),
    });
  }

  addInstancedBoxes(root, "Terminal4_FixedWalkwayWindowBands", glass, windows);
  addInstancedBoxes(root, "Terminal4_FixedWalkwayLowerBelts", trim, lowerBelts);
  addInstancedBoxes(root, "Terminal4_FixedWalkwayWindowMullions", trim, mullions);
  addInstancedBoxes(root, "Terminal4_FixedWalkwayRoofCaps", roof, roofCaps);
  root.userData.authority = "light-cladding-window-band-roof-cap-fixed-walkways-v15";
  root.userData.walkwayCount = records.length;
  root.userData.windowBandCount = windows.length;
  group.add(root);
  return records.length;
}

function installFixedWalkwayGroundSupports(group, walkwayRecords) {
  if (group.getObjectByName("Terminal4_FixedWalkwayGroundSupports_V14")) return 0;
  const supportMaterial = new THREE.MeshStandardMaterial({
    name: "Terminal 4 fixed walkway galvanized support",
    color: 0x7d8385,
    emissive: 0x060606,
    emissiveIntensity: 0.08,
    roughness: 0.66,
    metalness: 0.3,
  });
  const footMaterial = supportMaterial.clone();
  footMaterial.name = "Terminal 4 fixed walkway concrete foot";
  footMaterial.color.setHex(0x8d8a85);
  footMaterial.roughness = 0.92;
  footMaterial.metalness = 0.01;

  const records = [];
  for (const walkway of walkwayRecords) {
    if (walkway.length < 8.5) continue;
    const spacing = walkway.length > 24 ? 7.2 : 6.2;
    for (let along = 4.2; along < walkway.length - 2.8; along += spacing) {
      const offset = along - walkway.length / 2;
      records.push({
        center: walkway.position.clone().addScaledVector(walkway.forward, offset),
        right: walkway.right,
        quaternion: walkway.quaternion,
      });
    }
  }
  if (!records.length) return 0;

  const root = new THREE.Group();
  root.name = "Terminal4_FixedWalkwayGroundSupports_V14";
  const columns = [];
  const feet = [];
  const crossbeams = [];
  for (const record of records) {
    for (const side of [-1, 1]) {
      columns.push({
        position: record.center.clone().addScaledVector(record.right, side * 0.82).setY(1.62),
        scale: new THREE.Vector3(0.32, 3.0, 0.32),
      });
      feet.push({
        position: record.center.clone().addScaledVector(record.right, side * 0.82).setY(0.1),
        quaternion: record.quaternion,
        scale: new THREE.Vector3(0.72, 0.2, 0.72),
      });
    }
    crossbeams.push({
      position: record.center.clone().setY(3.08),
      quaternion: record.quaternion,
      scale: new THREE.Vector3(2.32, 0.18, 0.24),
    });
  }
  addInstancedBoxes(root, "Terminal4_FixedWalkwaySupportColumns", supportMaterial, columns);
  addInstancedBoxes(root, "Terminal4_FixedWalkwaySupportFeet", footMaterial, feet);
  addInstancedBoxes(root, "Terminal4_FixedWalkwaySupportCrossbeams", supportMaterial, crossbeams);
  root.userData.authority = "source-placed-fixed-walkway-ground-supports-v14";
  root.userData.supportStationCount = records.length;
  root.userData.columnCount = columns.length;
  group.add(root);
  return records.length;
}

function installA1LowerFacadePortal(group) {
  if (group.getObjectByName("Terminal4_A1_LowerFacadePortal_V15")) return 0;
  const root = new THREE.Group();
  root.name = "Terminal4_A1_LowerFacadePortal_V15";
  const normal = new THREE.Vector3(0.580968, 0, -0.813927);
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
  const wall = new THREE.Vector3(-3.55299146, 0, -40.60699866).addScaledVector(normal, -0.24);
  const yaw = Math.atan2(normal.x, normal.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

  const facade = new THREE.MeshStandardMaterial({
    name: "Terminal 4 A1 solid lower facade",
    color: 0xc9bca9,
    emissive: 0x17130f,
    emissiveIntensity: 0.08,
    roughness: 0.86,
    metalness: 0.015,
  });
  const door = new THREE.MeshStandardMaterial({
    name: "Terminal 4 A1 ramp service door",
    color: 0x74787a,
    roughness: 0.7,
    metalness: 0.14,
  });
  const vent = door.clone();
  vent.name = "Terminal 4 A1 ventilation grille";
  vent.color.setHex(0x4f5558);
  vent.metalness = 0.28;
  const curb = facade.clone();
  curb.name = "Terminal 4 A1 facade curb";
  curb.color.setHex(0x67615a);

  const panels = [];
  const curbs = [];
  for (const side of [-1, 1]) {
    const center = wall.clone().addScaledVector(tangent, side * 6.05);
    panels.push({ position: center.clone().setY(1.72), quaternion, scale: new THREE.Vector3(9.1, 3.36, 0.42) });
    curbs.push({ position: center.clone().setY(0.14).addScaledVector(normal, -0.12), quaternion, scale: new THREE.Vector3(9.1, 0.28, 0.18) });
  }
  addInstancedBoxes(root, "Terminal4_A1_SolidLowerFacadePanels", facade, panels);
  addInstancedBoxes(root, "Terminal4_A1_LowerFacadeCurbs", curb, curbs);
  addInstancedBoxes(root, "Terminal4_A1_ServiceDoor", door, [{
    position: wall.clone().addScaledVector(tangent, 6.6).addScaledVector(normal, -0.25).setY(1.1),
    quaternion,
    scale: new THREE.Vector3(1.35, 2.12, 0.14),
  }]);
  addInstancedBoxes(root, "Terminal4_A1_VentilationGrille", vent, [{
    position: wall.clone().addScaledVector(tangent, -6.2).addScaledVector(normal, -0.25).setY(2.02),
    quaternion,
    scale: new THREE.Vector3(1.55, 0.48, 0.14),
  }]);
  root.userData.authority = "exact-BGATE1-wall-solid-lower-facade-with-jetway-portal-v15";
  root.userData.portalClearWidthMeters = 3.0;
  group.add(root);
  return panels.length;
}

export function applyTerminal4JetwaySimulatorPolish(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 jetway simulator polish requires the source-placed jetway group");
  const materialLabels = new Map();
  let hiddenRepetitiveMeshCount = 0;
  let reducedShadowCasterCount = 0;

  group.traverse((entry) => {
    if (!entry.isMesh) return;
    const name = entry.name || "";
    if (/AIR_Jetway01_FixedTerminalWalkways_V13/i.test(name)) {
      const fixedMaterial = entry.material.clone();
      fixedMaterial.name = "Terminal 4 light fixed terminal walkway shell";
      fixedMaterial.map = null;
      fixedMaterial.emissiveMap = null;
      entry.material = fixedMaterial;
    }
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) {
      if (!material) continue;
      if (!materialLabels.has(material)) materialLabels.set(material, new Set());
      materialLabels.get(material).add(name || "unnamed");
    }
    if (HIDDEN_REPETITIVE_DETAIL.test(name)) {
      entry.visible = false;
      entry.castShadow = false;
      hiddenRepetitiveMeshCount += 1;
    } else {
      entry.castShadow = LARGE_SHADOW_CASTER.test(name);
      if (!entry.castShadow) reducedShadowCasterCount += 1;
    }
    entry.receiveShadow = true;
    entry.frustumCulled = true;
  });

  for (const [material, labels] of materialLabels) tuneSharedMaterial(material, [...labels].join(" "));

  const walkwayRecords = fixedWalkwayRecords(group);
  const fixedWalkwayArchitecturalCount = installFixedWalkwayArchitecturalDetail(group, walkwayRecords);
  const fixedWalkwaySupportStationCount = installFixedWalkwayGroundSupports(group, walkwayRecords);
  const a1LowerFacadePanelCount = installA1LowerFacadePortal(group);
  group.userData.simulatorPolishAuthority = "daylight-exact-shell-windowed-fixed-walkway-grounded-a1-portal-v15";
  group.userData.simulatorPolishMaterialCount = materialLabels.size;
  group.userData.simulatorPolishHiddenRepetitiveMeshCount = hiddenRepetitiveMeshCount;
  group.userData.simulatorPolishReducedShadowCasterCount = reducedShadowCasterCount;
  group.userData.simulatorPolishSilhouette = "daylight-corrugated-moving-shell-windowed-fixed-walkway-v15";
  group.userData.fixedWalkwayArchitecturalCount = fixedWalkwayArchitecturalCount;
  group.userData.fixedWalkwayArchitecturalAuthority = "light-cladding-window-band-roof-cap-fixed-walkways-v15";
  group.userData.fixedWalkwaySupportStationCount = fixedWalkwaySupportStationCount;
  group.userData.fixedWalkwayGroundSupportAuthority = "source-placed-fixed-walkway-ground-supports-v14";
  group.userData.a1LowerFacadePanelCount = a1LowerFacadePanelCount;
  group.userData.a1LowerFacadeAuthority = "exact-BGATE1-wall-solid-lower-facade-with-jetway-portal-v15";
  return group;
}
