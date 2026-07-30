const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function createArchedTunnelGeometry(THREE, width, height, roofRise) {
  const shape = new THREE.Shape();
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const shoulder = halfHeight - roofRise;
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(-halfWidth, shoulder);
  shape.quadraticCurveTo(-halfWidth * 0.82, halfHeight, 0, halfHeight);
  shape.quadraticCurveTo(halfWidth * 0.82, halfHeight, halfWidth, shoulder);
  shape.lineTo(halfWidth, -halfHeight);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 14,
  });
  geometry.translate(0, 0, -0.5);
  geometry.computeVertexNormals();
  const position = geometry.getAttribute("position");
  const normalizedUv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    normalizedUv[index * 2] = clamp(position.getX(index) / width + 0.5, 0, 1);
    normalizedUv[index * 2 + 1] = clamp(position.getY(index) / height + 0.5, 0, 1);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(normalizedUv, 2));
  return geometry;
}

function configureMesh(mesh, name) {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(THREE, material, name, width = 1, height = 1, depth = 1) {
  return configureMesh(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material), name);
}

function cylinder(THREE, material, name, radius = 1, height = 1, segments = 18) {
  return configureMesh(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material), name);
}

function createTunnelRib(THREE, material, name, width, height, roofRise) {
  const rib = new THREE.Group();
  rib.name = name;
  const halfWidth = width / 2;
  const shoulder = height / 2 - roofRise * 0.5;
  const postHeight = height - roofRise * 0.36;
  for (const side of [-1, 1]) {
    const post = box(THREE, material, `${name} side post ${side}`, 0.055, postHeight, 0.055);
    post.position.set(side * halfWidth, -roofRise * 0.16, 0);
    rib.add(post);
  }
  const floor = box(THREE, material, `${name} floor crossmember`, width, 0.055, 0.055);
  floor.position.y = -height / 2;
  rib.add(floor);
  const shoulderBar = box(THREE, material, `${name} roof shoulder`, width * 0.82, 0.05, 0.055);
  shoulderBar.position.y = shoulder;
  rib.add(shoulderBar);
  const crown = box(THREE, material, `${name} roof crown`, width * 0.38, 0.05, 0.055);
  crown.position.y = height / 2;
  rib.add(crown);
  return rib;
}

function positionTunnelRibs(ribs, length, margin) {
  const usable = Math.max(0.1, length - margin * 2);
  ribs.forEach((rib, index) => {
    const t = ribs.length === 1 ? 0.5 : index / (ribs.length - 1);
    rib.position.set(0, 0, -length / 2 + margin + usable * t);
    rib.visible = length > margin * 2;
  });
}

function addWindowMullions(THREE, root, materials) {
  for (const x of [-0.64, 0, 0.64]) {
    const mullion = box(THREE, materials.trim, `A1 cabin front window mullion ${x}`, 0.045, 0.72, 0.065);
    mullion.position.set(x, 0.34, 1.135);
    root.add(mullion);
  }
  for (const side of [-1, 1]) {
    for (const z of [-0.38, 0.38]) {
      const mullion = box(THREE, materials.trim, `A1 cabin side window mullion ${side} ${z}`, 0.065, 0.62, 0.045);
      mullion.position.set(side * 1.205, 0.25, z);
      root.add(mullion);
    }
  }
}

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  if (!layout) throw new Error("A1 animated jetway layout is required");
  const root = new THREE.Group();
  root.name = "AIR_Jetway01_A1_AnimatedDepartureAssembly_V9";
  root.position.set(layout.x, 0, layout.z);

  const outer = configureMesh(
    new THREE.Mesh(createArchedTunnelGeometry(THREE, 2.44, 2.34, 0.28), materials.shell),
    "A1 AIR_Jetway01 outer telescoping tunnel",
  );
  const inner = configureMesh(
    new THREE.Mesh(createArchedTunnelGeometry(THREE, 2.18, 2.18, 0.24), materials.innerShell),
    "A1 AIR_Jetway01 inner telescoping tunnel",
  );
  root.add(outer, inner);

  const outerDetailRoot = new THREE.Group();
  outerDetailRoot.name = "A1 AIR_Jetway01 outer tunnel structural ribs";
  const outerRibs = Array.from({ length: 11 }, (_, index) =>
    createTunnelRib(THREE, materials.trim, `A1 outer tunnel rib ${index + 1}`, 2.48, 2.38, 0.28));
  outerDetailRoot.add(...outerRibs);
  root.add(outerDetailRoot);

  const innerDetailRoot = new THREE.Group();
  innerDetailRoot.name = "A1 AIR_Jetway01 inner tunnel structural ribs";
  const innerRibs = Array.from({ length: 9 }, (_, index) =>
    createTunnelRib(THREE, materials.trim, `A1 inner tunnel rib ${index + 1}`, 2.22, 2.22, 0.24));
  innerDetailRoot.add(...innerRibs);
  root.add(innerDetailRoot);

  const overlapBand = box(THREE, materials.trim, "A1 AIR_Jetway01 telescoping overlap band");
  root.add(overlapBand);

  const outerPanelSeams = Array.from({ length: 8 }, (_, index) => {
    const seam = box(THREE, materials.trim, `A1 outer shell panel seam ${index + 1}`, 2.49, 0.035, 0.035);
    outerDetailRoot.add(seam);
    return seam;
  });
  const innerPanelSeams = Array.from({ length: 7 }, (_, index) => {
    const seam = box(THREE, materials.trim, `A1 inner shell panel seam ${index + 1}`, 2.23, 0.032, 0.032);
    innerDetailRoot.add(seam);
    return seam;
  });

  const cabinRoot = new THREE.Group();
  cabinRoot.name = "A1 AIR_Jetway01 aircraft cabin moving root";
  const cabin = configureMesh(
    new THREE.Mesh(createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22), materials.cabin),
    "A1 AIR_Jetway01 aircraft cabin",
  );
  cabin.scale.set(1, 1, 2.15);
  cabinRoot.add(cabin);

  const cabinFloor = box(THREE, materials.metal, "A1 AIR_Jetway01 cabin floor plate", 2.34, 0.1, 2.2);
  cabinFloor.position.set(0, -1.12, 0);
  cabinRoot.add(cabinFloor);

  const cabinDoor = box(
    THREE,
    materials.cabinDoor || materials.cabin,
    "A1 AIR_Jetway01 source-textured cabin service door",
    0.045,
    1.86,
    0.82,
  );
  cabinDoor.position.set(-1.225, -0.03, -0.12);
  cabinRoot.add(cabinDoor);

  const cabinDoorFrameTop = box(THREE, materials.trim, "A1 cabin door frame top", 0.06, 0.08, 0.94);
  cabinDoorFrameTop.position.set(-1.255, 0.93, -0.12);
  const cabinDoorFrameBottom = cabinDoorFrameTop.clone();
  cabinDoorFrameBottom.name = "A1 cabin door frame bottom";
  cabinDoorFrameBottom.position.y = -0.99;
  cabinRoot.add(cabinDoorFrameTop, cabinDoorFrameBottom);
  for (const z of [-0.56, 0.32]) {
    const jamb = box(THREE, materials.trim, `A1 cabin door jamb ${z}`, 0.06, 1.92, 0.06);
    jamb.position.set(-1.255, -0.03, z);
    cabinRoot.add(jamb);
  }

  const frontWindow = box(THREE, materials.glass, "A1 AIR_Jetway01 cabin front window", 1.94, 0.68, 0.05);
  frontWindow.position.set(0, 0.34, 1.1);
  cabinRoot.add(frontWindow);
  for (const side of [-1, 1]) {
    const sideWindow = box(THREE, materials.glass, `A1 AIR_Jetway01 cabin side window ${side}`, 0.05, 0.62, 1.16);
    sideWindow.position.set(side * 1.18, 0.25, 0);
    cabinRoot.add(sideWindow);
    const light = box(THREE, materials.light, `A1 AIR_Jetway01 work light ${side}`, 0.17, 0.12, 0.08);
    light.position.set(side * 0.86, 0.88, 1.2);
    cabinRoot.add(light);
  }
  addWindowMullions(THREE, cabinRoot, materials);

  const controlConsole = box(THREE, materials.trim, "A1 cabin operator control console", 0.62, 0.72, 0.48);
  controlConsole.position.set(0.68, -0.68, 0.72);
  controlConsole.rotation.x = -0.16;
  cabinRoot.add(controlConsole);
  const controlFace = box(THREE, materials.glass, "A1 cabin operator control face", 0.54, 0.3, 0.04);
  controlFace.position.set(0.68, -0.42, 0.94);
  controlFace.rotation.x = -0.16;
  cabinRoot.add(controlFace);
  const roofBeacon = cylinder(THREE, materials.marker || materials.warning, "A1 cabin red obstruction beacon", 0.09, 0.12, 14);
  roofBeacon.position.set(0, 1.23, -0.3);
  cabinRoot.add(roofBeacon);

  const hoodRoot = new THREE.Group();
  hoodRoot.name = "A1 AIR_Jetway01 retractable aircraft hood";
  hoodRoot.position.z = 0.96;
  for (let fold = 0; fold < 7; fold += 1) {
    const width = 2.18 - fold * 0.028;
    const height = 1.96 - fold * 0.02;
    const z = fold * 0.09;
    const top = box(THREE, materials.bellows, `A1 hood top fold ${fold + 1}`, width, 0.065, 0.065);
    const bottom = box(THREE, materials.bellows, `A1 hood bottom fold ${fold + 1}`, width, 0.065, 0.065);
    const left = box(THREE, materials.bellows, `A1 hood left fold ${fold + 1}`, 0.065, height, 0.065);
    const right = box(THREE, materials.bellows, `A1 hood right fold ${fold + 1}`, 0.065, height, 0.065);
    top.position.set(0, height / 2, z);
    bottom.position.set(0, -height / 2, z);
    left.position.set(-width / 2, 0, z);
    right.position.set(width / 2, 0, z);
    hoodRoot.add(top, bottom, left, right);
  }
  const bumper = box(THREE, materials.warning, "A1 AIR_Jetway01 aircraft bumper", 1.84, 0.15, 0.14);
  bumper.position.set(0, -0.75, 0.62);
  hoodRoot.add(bumper);
  cabinRoot.add(hoodRoot);
  root.add(cabinRoot);

  const bogieRoot = new THREE.Group();
  bogieRoot.name = "A1 AIR_Jetway01 lift and wheel bogie moving root";
  const bogie = box(THREE, materials.metal, "A1 AIR_Jetway01 wheel bogie", 2.08, 0.34, 0.92);
  bogie.position.y = 0.55;
  bogieRoot.add(bogie);
  const axle = cylinder(THREE, materials.metal, "A1 AIR_Jetway01 axle", 0.13, 2.22, 16);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 0.42;
  bogieRoot.add(axle);
  const liftColumns = [];
  for (const side of [-1, 1]) {
    const column = cylinder(THREE, materials.metal, `A1 lift column ${side}`, 0.2, 1, 18);
    column.position.x = side * 0.52;
    bogieRoot.add(column);
    liftColumns.push(column);
    const sleeve = cylinder(THREE, materials.innerShell, `A1 lift sleeve ${side}`, 0.32, 1.7, 18);
    sleeve.position.set(side * 0.52, 1.25, 0);
    bogieRoot.add(sleeve);
    const brace = box(THREE, materials.metal, `A1 bogie diagonal brace ${side}`, 0.09, 1.45, 0.09);
    brace.position.set(side * 0.78, 1.12, -0.22);
    brace.rotation.z = side * -0.42;
    bogieRoot.add(brace);
    for (const fore of [-0.38, 0.38]) {
      const wheel = cylinder(THREE, materials.tire, `A1 wheel ${side} ${fore}`, 0.36, 0.24, 24);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.9, 0.42, fore);
      const hub = cylinder(THREE, materials.metal, `A1 wheel hub ${side} ${fore}`, 0.16, 0.27, 18);
      hub.rotation.z = Math.PI / 2;
      hub.position.copy(wheel.position);
      const fender = box(THREE, materials.metal, `A1 wheel fender ${side} ${fore}`, 0.34, 0.08, 0.62);
      fender.position.set(side * 0.9, 0.78, fore);
      bogieRoot.add(wheel, hub, fender);
    }
    const marker = box(THREE, materials.warning, `A1 bogie safety marker ${side}`, 0.22, 0.22, 0.08);
    marker.position.set(side * 1.16, 0.88, 0.22);
    bogieRoot.add(marker);
  }
  const bogieMotor = box(THREE, materials.trim, "A1 bogie drive motor housing", 0.72, 0.46, 0.58);
  bogieMotor.position.set(0, 0.82, -0.08);
  bogieRoot.add(bogieMotor);
  const steeringTieRod = cylinder(THREE, materials.metal, "A1 bogie steering tie rod", 0.045, 1.92, 12);
  steeringTieRod.rotation.z = Math.PI / 2;
  steeringTieRod.position.set(0, 0.58, 0.46);
  bogieRoot.add(steeringTieRod);
  root.add(bogieRoot);

  const stairRoot = new THREE.Group();
  stairRoot.name = "A1 AIR_Jetway01 moving open service stair";
  stairRoot.position.set(-2.35, 0, -1.25);
  for (let index = 0; index < 8; index += 1) {
    const height = 0.16 + index * 0.21;
    const step = box(THREE, materials.stair, `A1 service tread ${index + 1}`, 1.28, 0.1, 0.38);
    step.position.set(0, height, index * 0.32);
    const riser = box(THREE, materials.stair, `A1 service riser ${index + 1}`, 1.28, 0.18, 0.08);
    riser.position.set(0, height - 0.09, index * 0.32 - 0.16);
    stairRoot.add(step, riser);
  }
  for (const side of [-1, 1]) {
    const rail = box(THREE, materials.metal, `A1 stair rail ${side}`, 0.045, 0.045, 2.8);
    rail.position.set(side * 0.52, 0.92, 1.1);
    rail.rotation.x = -0.48;
    stairRoot.add(rail);
    for (let index = 0; index < 4; index += 1) {
      const post = box(THREE, materials.metal, `A1 stair rail post ${side} ${index + 1}`, 0.045, 0.78, 0.045);
      post.position.set(side * 0.52, 0.54 + index * 0.22, 0.32 + index * 0.58);
      stairRoot.add(post);
    }
    const landingRail = box(THREE, materials.metal, `A1 stair landing rail ${side}`, 0.045, 0.78, 0.045);
    landingRail.position.set(side * 0.52, 1.62, 2.08);
    stairRoot.add(landingRail);
  }
  cabinRoot.add(stairRoot);

  const cableSegments = Array.from({ length: 8 }, (_, index) =>
    box(THREE, materials.warning, `A1 underbridge service cable segment ${index + 1}`, 0.055, 0.055, 1));
  root.add(...cableSegments);

  const underbridgeRails = [-0.82, 0.82].map((x, index) => {
    const rail = box(THREE, materials.metal, `A1 underbridge longitudinal rail ${index + 1}`, 0.09, 0.09, 1);
    rail.position.x = x;
    root.add(rail);
    return rail;
  });
  const underbridgeCrossmembers = Array.from({ length: 10 }, (_, index) => {
    const crossmember = box(THREE, materials.metal, `A1 underbridge crossmember ${index + 1}`, 1.82, 0.07, 0.09);
    root.add(crossmember);
    return crossmember;
  });
  const roofCableTray = box(THREE, materials.metal, "A1 roof cable tray", 0.18, 0.11, 1);
  root.add(roofCableTray);

  const attachedBridgeEnd = layout.bridgeEnd;
  const bridgeStart = layout.bridgeStart;
  const attachedCabinY = layout.cabinY;
  const rotundaY = layout.rotundaY;
  const retractedBridgeEnd = Math.min(attachedBridgeEnd, 11.5);
  const parkedCabinY = clamp(attachedCabinY + 0.72, 2.35, 5.75);
  const parkedYawOffset = -0.54;
  const attachedBridgeLength = attachedBridgeEnd - bridgeStart;
  const baseOuterLength = clamp(attachedBridgeLength * 0.62, 8.5, 18.8);
  let deployment = 1;

  function setDeployment(value) {
    deployment = clamp(Number(value) || 0, 0, 1);
    const hoodDeployment = smoothstep(0.78, 1, deployment);
    const extensionDeployment = smoothstep(0, 0.78, deployment);
    const rotationDeployment = smoothstep(0, 0.34, deployment);
    const bridgeEnd = lerp(retractedBridgeEnd, attachedBridgeEnd, extensionDeployment);
    const cabinY = lerp(parkedCabinY, attachedCabinY, extensionDeployment);
    const bridgeLength = Math.max(3, bridgeEnd - bridgeStart);
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);
    const outerLength = Math.min(baseOuterLength, Math.max(5.5, bridgeLength - 2.2));
    const innerStart = bridgeStart + outerLength * 0.48;
    const innerLength = Math.max(1.8, bridgeEnd - innerStart);
    const outerCenter = bridgeStart + outerLength / 2;
    const innerCenter = innerStart + innerLength / 2;
    const bridgeY = (along) => rotundaY - drop * (along / bridgeLength);

    root.rotation.y = layout.yaw + (1 - rotationDeployment) * parkedYawOffset;
    outer.position.set(0, bridgeY(outerCenter), outerCenter);
    outer.rotation.x = pitch;
    outer.scale.set(1, 1, outerLength);
    outerDetailRoot.position.copy(outer.position);
    outerDetailRoot.rotation.x = pitch;
    positionTunnelRibs(outerRibs, outerLength, 0.65);
    outerPanelSeams.forEach((seam, index) => {
      const t = (index + 1) / (outerPanelSeams.length + 1);
      seam.position.set(0, 0, -outerLength / 2 + outerLength * t);
      seam.visible = outerLength > 4;
    });

    inner.position.set(0, bridgeY(innerCenter), innerCenter);
    inner.rotation.x = pitch;
    inner.scale.set(1, 1, innerLength);
    innerDetailRoot.position.copy(inner.position);
    innerDetailRoot.rotation.x = pitch;
    positionTunnelRibs(innerRibs, innerLength, 0.55);
    innerPanelSeams.forEach((seam, index) => {
      const t = (index + 1) / (innerPanelSeams.length + 1);
      seam.position.set(0, 0, -innerLength / 2 + innerLength * t);
      seam.visible = innerLength > 3;
    });

    overlapBand.position.set(0, bridgeY(innerStart + 0.16), innerStart + 0.16);
    overlapBand.rotation.x = pitch;
    overlapBand.scale.set(2.34, 2.2, 0.18);

    cabinRoot.position.set(0, cabinY, bridgeEnd);
    hoodRoot.scale.z = lerp(0.12, 1, hoodDeployment);
    hoodRoot.visible = deployment > 0.005;
    bogieRoot.position.set(0, 0, bridgeEnd - 2.45);
    for (const column of liftColumns) {
      column.position.y = cabinY / 2;
      column.scale.y = Math.max(0.5, cabinY - 0.48);
    }

    const cableStart = bridgeStart + 1.5;
    const cableEnd = Math.max(cableStart + 1, bridgeEnd - 2.1);
    const segmentLength = Math.max(0.7, (cableEnd - cableStart) / cableSegments.length);
    cableSegments.forEach((segment, index) => {
      const along = cableStart + segmentLength * (index + 0.5);
      segment.position.set(-1.34, bridgeY(along) - 1.22, along);
      segment.rotation.x = pitch;
      segment.scale.z = segmentLength * 0.94;
      segment.visible = along < bridgeEnd - 1.2;
    });

    const detailCenter = bridgeStart + bridgeLength / 2;
    underbridgeRails.forEach((rail) => {
      rail.position.y = bridgeY(detailCenter) - 1.24;
      rail.position.z = detailCenter;
      rail.rotation.x = pitch;
      rail.scale.z = Math.max(2.5, bridgeLength - 0.8);
    });
    underbridgeCrossmembers.forEach((crossmember, index) => {
      const t = (index + 0.5) / underbridgeCrossmembers.length;
      const along = bridgeStart + 0.45 + Math.max(1, bridgeLength - 0.9) * t;
      crossmember.position.set(0, bridgeY(along) - 1.24, along);
      crossmember.rotation.x = pitch;
      crossmember.visible = along < bridgeEnd - 0.3;
    });
    roofCableTray.position.set(-0.82, bridgeY(detailCenter) + 1.23, detailCenter);
    roofCableTray.rotation.x = pitch;
    roofCableTray.scale.z = Math.max(2.5, bridgeLength - 0.8);

    const state = deployment >= 0.995
      ? "attached"
      : deployment <= 0.005
        ? "parked"
        : hoodDeployment < 0.15 && extensionDeployment > 0.95
          ? "hood-clear"
          : extensionDeployment < 0.98 && rotationDeployment > 0.98
            ? "telescoping"
            : rotationDeployment < 0.98
              ? "rotating-to-park"
              : "retracting";
    root.userData.deployment = deployment;
    root.userData.state = state;
    root.userData.contactPosition = [
      layout.x + Math.sin(root.rotation.y) * (bridgeEnd + 1.58),
      cabinY,
      layout.z + Math.cos(root.rotation.y) * (bridgeEnd + 1.58),
    ];
  }

  const controller = {
    setDeployment,
    getDeployment: () => deployment,
    getState: () => root.userData.state,
    getContactPosition: () => [...root.userData.contactPosition],
  };
  root.userData.controller = controller;
  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v9";
  root.userData.detailAuthority = "source-scale-ribs-panel-structure-service-cable-door-stair-bogie-v8 source-scale-panel-ribs-open-stair-cabin-controls-underbridge-truss-cable-tray-bogie-drive-v9";
  root.userData.structuralRibCount = outerRibs.length + innerRibs.length;
  root.userData.serviceCableSegmentCount = cableSegments.length;
  root.userData.structuralDetailCount = outerRibs.length + innerRibs.length + outerPanelSeams.length + innerPanelSeams.length + underbridgeCrossmembers.length + underbridgeRails.length + 30;
  root.userData.requiredSequence = "hood-clear-telescope-in-rotate-to-park";
  root.userData.sourceScale = 1;
  setDeployment(1);
  return root;
}
