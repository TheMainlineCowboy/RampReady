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

function addBeamBetween(parent, name, sourceMaterial, start, end, width, height) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const delta = b.clone().sub(a);
  const length = Math.hypot(delta.x, delta.z);
  const center = a.add(b).multiplyScalar(0.5);
  return addBox(
    parent,
    name,
    sourceMaterial,
    [center.x, center.y, center.z],
    [width, height, length],
    Math.atan2(delta.x, delta.z),
  );
}

function connectorFrame(start, end) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const forward = b.clone().sub(a).setY(0).normalize();
  return {
    start: a,
    end: b,
    forward,
    right: new THREE.Vector3(-forward.z, 0, forward.x),
  };
}

export function installTerminal4BConcourseExtensionV17(group) {
  if (!group?.isGroup) throw new Error("Terminal 4 B-concourse extension requires the source-placed jetway group");
  const existing = group.getObjectByName("Terminal4_BConcourse_SourceAerialExtension_V17");
  if (existing) return existing;

  // The supplied term4.BGL stops at world Z ≈337 m while the same airport
  // package places B16-B28 around world Z 380-485 m and B15 at 533-557 m.
  // The package aerial clearly shows the missing T-shaped pier. Coordinates
  // below are in the jetway group's A1-local frame (the group adds +6.2 m Z):
  //   main pier: gate-derived opposing rotunda rows at Z 373-450 m
  //   B15 pier: east facade fixed by B15L/M rotundas at X ≈-27.4 m
  //   connector: joins the supplied terminal's eastern wall near world Z 337 m.
  const root = new THREE.Group();
  root.name = "Terminal4_BConcourse_SourceAerialExtension_V17";

  const wall = material("Terminal 4 B-concourse source-aerial beige wall", 0xc6b9a6, 0.86, 0.015);
  wall.emissive.setHex(0x17130f);
  wall.emissiveIntensity = 0.08;
  const upperWall = material("Terminal 4 B-concourse upper architectural wall", 0xd8cdbc, 0.82, 0.02);
  upperWall.emissive.setHex(0x1c1813);
  upperWall.emissiveIntensity = 0.08;
  const glass = material("Terminal 4 B-concourse blue-gray glazing", 0x355766, 0.26, 0.08, {
    transparent: true,
    opacity: 0.84,
    depthWrite: true,
  });
  glass.emissive.setHex(0x102128);
  glass.emissiveIntensity = 0.2;
  const trim = material("Terminal 4 B-concourse galvanized trim", 0x777e81, 0.66, 0.26);
  const roof = material("Terminal 4 B-concourse light roof", 0xe8e3da, 0.9, 0.015);
  const door = material("Terminal 4 B-concourse sparse ramp service door", 0x6c7174, 0.7, 0.16);
  const vent = material("Terminal 4 B-concourse sparse ventilation grille", 0x4e5558, 0.64, 0.3);
  const support = material("Terminal 4 B-concourse connector support", 0x737a7d, 0.68, 0.28);

  // Main east-west pier visible in the source aerial. It is bounded by the
  // opposing source jetway rows rather than invented terminal spans.
  const mainXMin = -63.0;
  const mainXMax = 211.0;
  const mainZMin = 403.5;
  const mainZMax = 451.0;
  const mainCenterX = (mainXMin + mainXMax) / 2;
  const mainCenterZ = (mainZMin + mainZMax) / 2;
  const mainLength = mainXMax - mainXMin;
  const mainWidth = mainZMax - mainZMin;

  addBox(root, "Terminal4_BConcourse_MainLowerVolume", wall, [mainCenterX, 1.68, mainCenterZ], [mainLength, 3.36, mainWidth]);
  addBox(root, "Terminal4_BConcourse_MainUpperVolume", upperWall, [mainCenterX, 5.72, mainCenterZ], [mainLength, 2.25, mainWidth]);
  addBox(root, "Terminal4_BConcourse_MainRoof", roof, [mainCenterX, 7.02, mainCenterZ], [mainLength + 1.2, 0.26, mainWidth + 1.2]);
  for (const z of [mainZMin - 0.08, mainZMax + 0.08]) {
    addBox(root, `Terminal4_BConcourse_MainWindowBand_${z}`, glass, [mainCenterX, 4.34, z], [mainLength - 1.0, 1.18, 0.13]);
    addBox(root, `Terminal4_BConcourse_MainLowerBelt_${z}`, trim, [mainCenterX, 3.48, z], [mainLength, 0.18, 0.18]);
  }
  for (let x = mainXMin + 4; x < mainXMax - 3; x += 7.5) {
    for (const z of [mainZMin - 0.17, mainZMax + 0.17]) {
      addBox(root, `Terminal4_BConcourse_MainMullion_${x.toFixed(1)}_${z}`, trim, [x, 4.34, z], [0.12, 1.34, 0.13]);
    }
  }

  // B15 north-south pier. Its east facade intersects both exact B15 source
  // rotundas, eliminating detached bridges without moving either source gate.
  const b15XMin = -64.0;
  const b15XMax = -27.35;
  const b15ZMin = 326.5;
  const b15ZMax = 570.0;
  const b15CenterX = (b15XMin + b15XMax) / 2;
  const b15CenterZ = (b15ZMin + b15ZMax) / 2;
  const b15Width = b15XMax - b15XMin;
  const b15Length = b15ZMax - b15ZMin;

  addBox(root, "Terminal4_B15Pier_LowerVolume", wall, [b15CenterX, 1.68, b15CenterZ], [b15Width, 3.36, b15Length]);
  addBox(root, "Terminal4_B15Pier_UpperVolume", upperWall, [b15CenterX, 5.72, b15CenterZ], [b15Width, 2.25, b15Length]);
  addBox(root, "Terminal4_B15Pier_Roof", roof, [b15CenterX, 7.02, b15CenterZ], [b15Width + 1.2, 0.26, b15Length + 1.2]);
  for (const x of [b15XMin - 0.08, b15XMax + 0.08]) {
    addBox(root, `Terminal4_B15Pier_WindowBand_${x}`, glass, [x, 4.34, b15CenterZ], [0.13, 1.18, b15Length - 1.0]);
    addBox(root, `Terminal4_B15Pier_LowerBelt_${x}`, trim, [x, 3.48, b15CenterZ], [0.18, 0.18, b15Length]);
  }
  for (let z = b15ZMin + 4; z < b15ZMax - 3; z += 7.5) {
    for (const x of [b15XMin - 0.17, b15XMax + 0.17]) {
      addBox(root, `Terminal4_B15Pier_Mullion_${z.toFixed(1)}_${x}`, trim, [x, 4.34, z], [0.13, 1.34, 0.12]);
    }
  }

  // Sparse, irregular ramp details prevent another repeated row of openings.
  for (const [name, x, z] of [
    ["B18", 24, mainZMin - 0.28],
    ["B22", 77, mainZMin - 0.28],
    ["B27", 170, mainZMax + 0.28],
    ["B17", 18, mainZMax + 0.28],
    ["B15L", b15XMax + 0.28, 516.0],
  ]) {
    const onB15EastFacade = name === "B15L";
    addBox(
      root,
      `Terminal4_BConcourse_ServiceDoor_${name}`,
      door,
      [x, 1.08, z],
      onB15EastFacade ? [0.16, 2.08, 1.32] : [1.32, 2.08, 0.16],
    );
  }
  addBox(root, "Terminal4_BConcourse_Vent_B24", vent, [112, 2.08, mainZMin - 0.3], [1.7, 0.46, 0.16]);
  addBox(root, "Terminal4_B15Pier_Vent", vent, [b15XMax + 0.3, 2.08, 548], [0.16, 0.46, 1.7]);

  // Windowed connector to the edge of the supplied terminal mesh. This follows
  // the source aerial corridor and is supported from both sides of the ramp.
  const connectorStart = [205.0, 4.45, 425.5];
  const connectorEnd = [226.0, 4.45, 331.0];
  const frame = connectorFrame(connectorStart, connectorEnd);
  addBeamBetween(root, "Terminal4_BConcourse_ToSuppliedTerminalConnector", upperWall, connectorStart, connectorEnd, 12.5, 3.15);
  for (const side of [-1, 1]) {
    const sideOffset = frame.right.clone().multiplyScalar(side * 6.28);
    const glassStart = frame.start.clone().add(sideOffset).setY(4.58);
    const glassEnd = frame.end.clone().add(sideOffset).setY(4.58);
    addBeamBetween(
      root,
      `Terminal4_BConcourse_ConnectorGlass_${side < 0 ? "Left" : "Right"}`,
      glass,
      glassStart.toArray(),
      glassEnd.toArray(),
      0.16,
      1.06,
    );
    const beltStart = frame.start.clone().add(sideOffset).setY(3.78);
    const beltEnd = frame.end.clone().add(sideOffset).setY(3.78);
    addBeamBetween(
      root,
      `Terminal4_BConcourse_ConnectorLowerBelt_${side < 0 ? "Left" : "Right"}`,
      trim,
      beltStart.toArray(),
      beltEnd.toArray(),
      0.18,
      0.18,
    );
  }
  addBeamBetween(
    root,
    "Terminal4_BConcourse_ConnectorRoof",
    roof,
    [connectorStart[0], 6.15, connectorStart[2]],
    [connectorEnd[0], 6.15, connectorEnd[2]],
    13.2,
    0.22,
  );
  for (let t = 0.12; t < 0.92; t += 0.12) {
    const center = frame.start.clone().lerp(frame.end, t).setY(0);
    for (const side of [-1, 1]) {
      const point = center.clone().addScaledVector(frame.right, side * 4.75);
      addBox(root, `Terminal4_BConcourse_ConnectorSupport_${side}_${t.toFixed(2)}`, support, [point.x, 1.58, point.z], [0.38, 3.16, 0.38]);
      addBox(root, `Terminal4_BConcourse_ConnectorFoot_${side}_${t.toFixed(2)}`, support, [point.x, 0.12, point.z], [0.9, 0.24, 0.9]);
    }
  }

  root.userData.authority = "source-gate-and-source-aerial-aligned-terminal4-B-concourse-v17";
  root.userData.sourceAerialAuthority = "PHXPhoto.bgl supplied daytime source";
  root.userData.sourceGateAuthority = "KPHX_ADEX B15-B28 source rotundas and parkings";
  root.userData.mainPierBounds = Object.freeze([mainXMin, mainXMax, mainZMin, mainZMax]);
  root.userData.b15PierBounds = Object.freeze([b15XMin, b15XMax, b15ZMin, b15ZMax]);
  root.userData.b15AttachedRotundas = Object.freeze(["B15L", "B15M"]);
  root.userData.syntheticEquivalentDisclosure = "package-aerial-and-gate-aligned-building-equivalent-for-missing-term4.BGL-extension";
  group.add(root);
  return root;
}
