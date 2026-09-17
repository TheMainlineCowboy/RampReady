import * as THREE from "three";

function mat(color, roughness = 0.66, metalness = 0.08, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function mesh(parent, name, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, name, size, material, position, rotation = [0, 0, 0]) {
  return mesh(parent, name, new THREE.BoxGeometry(...size), material, position, rotation);
}

function tube(parent, name, start, end, radius, material, radialSegments = 14) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const delta = b.clone().sub(a);
  const object = mesh(parent, name, new THREE.CylinderGeometry(radius, radius, delta.length(), radialSegments), material);
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}

function wheel(name, radius, width) {
  const pivot = new THREE.Group();
  pivot.name = `${name}_Pivot`;
  const tire = mesh(pivot, `${name}_Tire`, new THREE.CylinderGeometry(radius, radius, width, 28), mat(0x111111, 0.96, 0.01), [0, 0, 0], [0, 0, Math.PI / 2]);
  const rim = mesh(pivot, `${name}_Rim`, new THREE.CylinderGeometry(radius * 0.43, radius * 0.43, width * 1.02, 24), mat(0x777b7d, 0.50, 0.55), [0, 0, 0], [0, 0, Math.PI / 2]);
  return { pivot, tire, rim, radius };
}

export function installDetailedManagerKubotaVisual(rig) {
  const root = new THREE.Group();
  root.name = "RampReady_ManagerKubotaRTV_Detailed";

  const orange = mat(0xd65a12, 0.56, 0.12);
  const orangeDark = mat(0x9f370a, 0.66, 0.12);
  const black = mat(0x17191a, 0.84, 0.05);
  const dark = mat(0x25282a, 0.78, 0.12);
  const steel = mat(0x545a5d, 0.48, 0.48);
  const glass = mat(0xa8c9d8, 0.18, 0.02, { transparent: true, opacity: 0.34, depthWrite: false });
  const red = mat(0xb01818, 0.45, 0.05, { emissive: 0x3a0505, emissiveIntensity: 0.35 });
  const white = mat(0xe5e7df, 0.30, 0.05, { emissive: 0x3c3c31, emissiveIntensity: 0.25 });

  // Low RTV chassis and center tunnel.
  box(root, "Kubota_Chassis", [1.44, 0.24, 2.70], dark, [0, 0.39, -0.02]);
  box(root, "Kubota_Floor", [1.34, 0.08, 1.22], black, [0, 0.62, 0.14]);
  box(root, "Kubota_CenterTunnel", [0.26, 0.26, 1.18], black, [0, 0.72, 0.16]);

  // Front hood / nose, with the orange manager-cart character of the supplied RTV.
  box(root, "Kubota_Hood", [1.28, 0.43, 0.77], orange, [0, 0.83, 1.06], [-0.05, 0, 0]);
  box(root, "Kubota_HoodTop", [1.13, 0.08, 0.72], orangeDark, [0, 1.07, 1.05], [-0.08, 0, 0]);
  box(root, "Kubota_FrontBumper", [1.36, 0.18, 0.17], black, [0, 0.46, 1.50]);
  for (const side of [-1, 1]) {
    box(root, `Kubota_Headlight_${side}`, [0.25, 0.14, 0.035], white, [side * 0.43, 0.88, 1.455]);
  }

  // Two-seat manager cab.
  for (const side of [-1, 1]) {
    box(root, `Kubota_SeatCushion_${side}`, [0.48, 0.12, 0.48], black, [side * 0.31, 0.79, 0.00], [-0.04, 0, 0]);
    box(root, `Kubota_SeatBack_${side}`, [0.46, 0.52, 0.12], black, [side * 0.31, 1.04, -0.22], [-0.12, 0, 0]);
  }
  box(root, "Kubota_Dash", [1.16, 0.24, 0.25], dark, [0, 1.00, 0.54], [-0.18, 0, 0]);
  box(root, "Kubota_InstrumentCluster", [0.34, 0.16, 0.03], mat(0x15191c, 0.52, 0.08), [-0.34, 1.10, 0.405], [-0.18, 0, 0]);

  const steering = new THREE.Group();
  steering.name = "Kubota_SteeringWheel";
  steering.position.set(-0.34, 1.07, 0.35);
  steering.rotation.x = -0.55;
  mesh(steering, "Kubota_SteeringRim", new THREE.TorusGeometry(0.17, 0.018, 12, 44), black);
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    const spoke = box(steering, `Kubota_SteeringSpoke_${angle.toFixed(2)}`, [0.018, 0.13, 0.014], black, [0, 0, 0]);
    spoke.rotation.z = angle;
  }
  root.add(steering);
  tube(root, "Kubota_SteeringColumn", [-0.34, 0.88, 0.45], [-0.34, 1.03, 0.36], 0.028, steel);

  // Cargo box behind the cab.
  box(root, "Kubota_CargoBedFloor", [1.39, 0.10, 0.95], dark, [0, 0.74, -0.92]);
  box(root, "Kubota_CargoBedFront", [1.39, 0.45, 0.07], dark, [0, 0.95, -0.48]);
  box(root, "Kubota_CargoBedTailgate", [1.39, 0.47, 0.08], dark, [0, 0.94, -1.40]);
  for (const side of [-1, 1]) box(root, `Kubota_CargoBedSide_${side}`, [0.07, 0.44, 0.92], dark, [side * 0.66, 0.95, -0.94]);

  // ROPS/canopy and windshield frame.
  const cage = mat(0x181a1c, 0.62, 0.32);
  for (const side of [-1, 1]) {
    tube(root, `Kubota_ROPS_Front_${side}`, [side * 0.61, 0.60, 0.45], [side * 0.61, 1.93, 0.32], 0.035, cage);
    tube(root, `Kubota_ROPS_Rear_${side}`, [side * 0.61, 0.63, -0.48], [side * 0.61, 1.93, -0.42], 0.035, cage);
    tube(root, `Kubota_ROPS_RoofRail_${side}`, [side * 0.61, 1.93, -0.42], [side * 0.61, 1.93, 0.32], 0.035, cage);
  }
  tube(root, "Kubota_ROPS_FrontTop", [-0.61, 1.93, 0.32], [0.61, 1.93, 0.32], 0.035, cage);
  tube(root, "Kubota_ROPS_RearTop", [-0.61, 1.93, -0.42], [0.61, 1.93, -0.42], 0.035, cage);
  box(root, "Kubota_Canopy", [1.48, 0.08, 1.18], black, [0, 2.02, -0.02]);
  box(root, "Kubota_Windshield", [1.16, 0.91, 0.025], glass, [0, 1.49, 0.35], [-0.05, 0, 0]);

  // Rear lights and manager-cart details.
  for (const side of [-1, 1]) box(root, `Kubota_TailLamp_${side}`, [0.18, 0.11, 0.035], red, [side * 0.50, 0.91, -1.455]);
  tube(root, "Kubota_BeaconPost", [0.49, 1.96, -0.32], [0.49, 2.12, -0.32], 0.025, cage);
  mesh(root, "Kubota_AmberBeacon", new THREE.CylinderGeometry(0.055, 0.065, 0.10, 20), mat(0xff9b18, 0.34, 0.03, { emissive: 0x552000, emissiveIntensity: 0.45 }), [0.49, 2.18, -0.32]);

  const wheels = [];
  const frontSteer = [];
  const halfTrack = 0.62;
  const halfWheelbase = 1.02;
  for (const side of [-1, 1]) {
    const front = wheel(`Kubota_Front_${side < 0 ? "L" : "R"}`, 0.34, 0.22);
    front.pivot.position.set(side * halfTrack, 0.34, halfWheelbase);
    root.add(front.pivot);
    wheels.push(front);
    frontSteer.push(front.pivot);

    const rear = wheel(`Kubota_Rear_${side < 0 ? "L" : "R"}`, 0.36, 0.23);
    rear.pivot.position.set(side * halfTrack, 0.36, -halfWheelbase);
    root.add(rear.pivot);
    wheels.push(rear);
  }

  rig.visual.visible = false;
  rig.root.add(root);
  rig.operatorEye.position.fromArray(rig.profile.operatorEye);
  rig.forwardLook.position.fromArray(rig.profile.operatorLook);
  rig.setSteering = (angle) => { for (const pivot of frontSteer) pivot.rotation.y = angle; };
  rig.rotateWheels = (distance) => {
    for (const item of wheels) {
      item.tire.rotation.x += distance / item.radius;
      item.rim.rotation.x = item.tire.rotation.x;
    }
  };
  rig.setLiftProgress = () => {};

  rig.root.userData.authoredVehicleScene = root;
  rig.root.userData.runtimeVisualSource = "manager-kubota-rtv-detailed-v1";
  rig.root.userData.runtimeVisualUrl = "procedural-threejs-supplied-rtv-derived";
  rig.root.userData.vehicleRole = rig.profile.role;
  rig.root.userData.vehicleReferenceModel = rig.profile.referenceModel;
  rig.root.userData.operatorStation = "seated-manager-driver";
  rig.root.userData.operatorControls = "kubota-steering-dash-pedals";
  rig.root.userData.steeringLayout = "front-pair";
  return rig.root.userData.runtimeVisualSource;
}
