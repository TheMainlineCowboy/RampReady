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
    curveSegments: 10,
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

export function buildAnimatedA1Jetway(THREE, materials, layout) {
  if (!layout) throw new Error("A1 animated jetway layout is required");
  const root = new THREE.Group();
  root.name = "AIR_Jetway01_A1_AnimatedDepartureAssembly";
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

  const overlapBand = box(THREE, materials.trim, "A1 AIR_Jetway01 telescoping overlap band");
  root.add(overlapBand);

  const cabinRoot = new THREE.Group();
  cabinRoot.name = "A1 AIR_Jetway01 aircraft cabin moving root";
  const cabin = configureMesh(
    new THREE.Mesh(createArchedTunnelGeometry(THREE, 2.42, 2.3, 0.22), materials.cabin),
    "A1 AIR_Jetway01 aircraft cabin",
  );
  cabin.scale.set(1, 1, 2.15);
  cabinRoot.add(cabin);

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

  const hoodRoot = new THREE.Group();
  hoodRoot.name = "A1 AIR_Jetway01 retractable aircraft hood";
  hoodRoot.position.z = 0.96;
  for (let fold = 0; fold < 5; fold += 1) {
    const width = 2.18 - fold * 0.035;
    const height = 1.96 - fold * 0.025;
    const z = fold * 0.12;
    const top = box(THREE, materials.bellows, `A1 hood top fold ${fold + 1}`, width, 0.07, 0.08);
    const bottom = box(THREE, materials.bellows, `A1 hood bottom fold ${fold + 1}`, width, 0.07, 0.08);
    const left = box(THREE, materials.bellows, `A1 hood left fold ${fold + 1}`, 0.07, height, 0.08);
    const right = box(THREE, materials.bellows, `A1 hood right fold ${fold + 1}`, 0.07, height, 0.08);
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
  const axle = cylinder(THREE, materials.metal, "A1 AIR_Jetway01 axle", 0.13, 2.22, 12);
  axle.rotation.z = Math.PI / 2;
  axle.position.y = 0.42;
  bogieRoot.add(axle);
  const liftColumns = [];
  for (const side of [-1, 1]) {
    const column = cylinder(THREE, materials.metal, `A1 lift column ${side}`, 0.2, 1, 16);
    column.position.x = side * 0.52;
    bogieRoot.add(column);
    liftColumns.push(column);
    const sleeve = cylinder(THREE, materials.innerShell, `A1 lift sleeve ${side}`, 0.32, 1.7, 16);
    sleeve.position.set(side * 0.52, 1.25, 0);
    bogieRoot.add(sleeve);
    for (const fore of [-0.38, 0.38]) {
      const wheel = cylinder(THREE, materials.tire, `A1 wheel ${side} ${fore}`, 0.36, 0.24, 18);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 0.9, 0.42, fore);
      bogieRoot.add(wheel);
    }
  }
  root.add(bogieRoot);

  const stairRoot = new THREE.Group();
  stairRoot.name = "A1 AIR_Jetway01 moving service stair";
  stairRoot.position.set(-2.35, 0, -1.25);
  for (let index = 0; index < 8; index += 1) {
    const height = 0.16 + index * 0.21;
    const step = box(THREE, materials.stair, `A1 service step ${index + 1}`, 1.28, height, 0.34);
    step.position.set(0, height / 2, index * 0.32);
    stairRoot.add(step);
  }
  for (const side of [-1, 1]) {
    const rail = box(THREE, materials.metal, `A1 stair rail ${side}`, 0.045, 0.045, 2.8);
    rail.position.set(side * 0.52, 0.92, 1.1);
    rail.rotation.x = -0.48;
    stairRoot.add(rail);
  }
  cabinRoot.add(stairRoot);

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
    inner.position.set(0, bridgeY(innerCenter), innerCenter);
    inner.rotation.x = pitch;
    inner.scale.set(1, 1, innerLength);
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
  root.userData.animationAuthority = "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly";
  root.userData.requiredSequence = "hood-clear-telescope-in-rotate-to-park";
  root.userData.sourceScale = 1;
  setDeployment(1);
  return root;
}
