import * as THREE from "three";

const RED = 0xb51f2a;
const RED_DARK = 0x82131b;
const BLACK = 0x0f1113;
const DECK = 0x2a2d2f;
const RUBBER = 0x08090a;
const SILVER = 0xb9bec0;
const STEEL = 0x7c8589;
const AMBER = 0xffa31a;
const WHITE = 0xe7e8e4;

function mat(color, roughness = 0.62, metalness = 0.08, emissive = 0x000000) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emissive ? 0.75 : 0 });
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

function box(parent, name, size, material, position, rotation) {
  return mesh(parent, name, new THREE.BoxGeometry(...size), material, position, rotation);
}

function tube(parent, name, start, end, radius, material, radialSegments = 16) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const delta = b.clone().sub(a);
  const object = mesh(parent, name, new THREE.CylinderGeometry(radius, radius, delta.length(), radialSegments), material);
  object.position.copy(a).add(b).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}

function wedgeGeometry(width, heightBack, heightFront, depth) {
  const w = width / 2;
  const d = depth / 2;
  const vertices = new Float32Array([
    -w, 0, -d,  w, 0, -d,  w, 0, d, -w, 0, d,
    -w, heightBack, -d,  w, heightBack, -d,
     w, heightFront, d, -w, heightFront, d,
  ]);
  const indices = [
    0,2,1, 0,3,2,
    4,5,6, 4,6,7,
    0,1,5, 0,5,4,
    1,2,6, 1,6,5,
    2,3,7, 2,7,6,
    3,0,4, 3,4,7,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWheel(name, radius, width, steer = false) {
  const pivot = new THREE.Group();
  pivot.name = `${name}_Pivot`;
  const tire = mesh(pivot, `${name}_Tire`, new THREE.CylinderGeometry(radius, radius, width, 40, 1), mat(RUBBER, 0.96, 0.01), [0, 0, 0], [0, 0, Math.PI / 2]);
  const rim = mesh(pivot, `${name}_Rim`, new THREE.CylinderGeometry(radius * 0.47, radius * 0.47, width * 1.02, 32), mat(0xc8c9c6, 0.45, 0.55), [0, 0, 0], [0, 0, Math.PI / 2]);
  const hub = mesh(pivot, `${name}_Hub`, new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, width * 1.06, 24), mat(0x555a5d, 0.46, 0.62), [0, 0, 0], [0, 0, Math.PI / 2]);
  return { pivot, tire, rim, hub, steer };
}

function addSeat(parent, x, z, sideName) {
  const dark = mat(0x161719, 0.86, 0.02);
  const frame = mat(0x3a3d40, 0.55, 0.45);
  box(parent, `L88_${sideName}_SeatCushion`, [0.48, 0.12, 0.48], dark, [x, 0.60, z], [-0.03, 0, 0]);
  box(parent, `L88_${sideName}_SeatBack`, [0.47, 0.58, 0.11], dark, [x, 0.89, z - 0.22], [-0.17, 0, 0]);
  tube(parent, `L88_${sideName}_SeatPost`, [x, 0.28, z], [x, 0.55, z], 0.035, frame);
  box(parent, `L88_${sideName}_SeatBase`, [0.36, 0.07, 0.33], frame, [x, 0.27, z]);
}

function addSteeringWheel(parent, x, z) {
  const group = new THREE.Group();
  group.name = "L88_OperatorSteeringWheel";
  group.position.set(x, 0.94, z);
  group.rotation.x = -0.55;
  const wheelMat = mat(0x111214, 0.90, 0.03);
  mesh(group, "L88_SteeringRim", new THREE.TorusGeometry(0.185, 0.018, 14, 56), wheelMat);
  for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const spoke = box(group, `L88_SteeringSpoke_${angle.toFixed(2)}`, [0.020, 0.145, 0.014], wheelMat, [0, 0, 0]);
    spoke.rotation.z = angle;
  }
  mesh(group, "L88_SteeringHub", new THREE.CylinderGeometry(0.045, 0.045, 0.055, 24), wheelMat, [0, 0, -0.015], [Math.PI / 2, 0, 0]);
  mesh(group, "L88_SteeringKnob", new THREE.SphereGeometry(0.030, 16, 12), wheelMat, [0.14, -0.10, 0.02]);
  parent.add(group);
  tube(parent, "L88_SteeringColumn", [x, 0.78, z + 0.08], [x, 0.93, z], 0.035, mat(0x292c2f, 0.58, 0.45));
  return group;
}

export function buildDetailedLektro88Visual() {
  const root = new THREE.Group();
  root.name = "RampReady_LEKTRO88_AP8850SDA_Detailed";

  const red = mat(RED, 0.50, 0.20);
  const redDark = mat(RED_DARK, 0.60, 0.18);
  const black = mat(BLACK, 0.78, 0.10);
  const deck = mat(DECK, 0.86, 0.12);
  const steel = mat(STEEL, 0.45, 0.62);
  const silver = mat(SILVER, 0.38, 0.72);
  const strap = mat(0xc3a46e, 0.92, 0.01);

  box(root, "L88_LowerChassis", [1.88, 0.23, 3.35], redDark, [0, 0.31, 0.27]);
  box(root, "L88_CenterDeck", [1.73, 0.075, 2.55], deck, [0, 0.52, 0.48]);

  for (const side of [-1, 1]) {
    box(root, `L88_SideBatteryPod_${side}`, [0.35, 0.43, 2.62], red, [side * 0.83, 0.48, 0.35]);
    mesh(root, `L88_FrontShoulder_${side}`, wedgeGeometry(0.38, 0.38, 0.18, 1.04), red, [side * 0.82, 0.43, 1.98]);
    box(root, `L88_SideRubRail_${side}`, [0.045, 0.075, 3.33], black, [side * 1.00, 0.37, 0.23]);
    box(root, `L88_RearWing_${side}`, [0.36, 0.29, 0.70], red, [side * 0.82, 0.48, -1.42]);
    box(root, `L88_RearWingTop_${side}`, [0.38, 0.065, 0.76], red, [side * 0.82, 0.65, -1.42]);
  }

  box(root, "L88_OperatorFloor", [1.40, 0.055, 0.93], deck, [0, 0.28, -1.35]);
  addSeat(root, -0.38, -1.38, "Operator");
  addSeat(root, 0.38, -1.38, "Passenger");
  mesh(root, "L88_DashCowl", wedgeGeometry(0.66, 0.36, 0.22, 0.34), red, [-0.38, 0.64, -0.88]);
  box(root, "L88_InstrumentPanel", [0.54, 0.23, 0.035], mat(0xe5e1d4, 0.70, 0.03), [-0.38, 0.77, -0.74], [-0.32, 0, 0]);
  addSteeringWheel(root, -0.39, -0.82);
  box(root, "L88_CenterConsole", [0.20, 0.35, 0.42], redDark, [0.02, 0.49, -0.88]);
  mesh(root, "L88_DirectionLever", new THREE.CylinderGeometry(0.018, 0.018, 0.21, 14), black, [0.03, 0.77, -0.87], [0, 0, -0.34]);
  mesh(root, "L88_DirectionKnob", new THREE.SphereGeometry(0.035, 18, 12), black, [-0.005, 0.87, -0.87]);
  box(root, "L88_AcceleratorPedal", [0.13, 0.025, 0.20], black, [-0.46, 0.32, -0.92], [-0.25, 0, 0]);
  box(root, "L88_BrakePedal", [0.16, 0.025, 0.20], black, [-0.25, 0.32, -0.92], [-0.25, 0, 0]);

  box(root, "L88_RearBumper", [1.88, 0.18, 0.20], red, [0, 0.42, -1.78]);
  for (const side of [-1, 1]) {
    box(root, `L88_RearLampHousing_${side}`, [0.20, 0.11, 0.04], black, [side * 0.74, 0.48, -1.895]);
    box(root, `L88_RearLamp_${side}`, [0.15, 0.07, 0.015], mat(0xff6a24, 0.45, 0.05, 0x5e1900), [side * 0.74, 0.48, -1.92]);
  }
  tube(root, "L88_BeaconPost", [0, 0.62, -1.72], [0, 0.83, -1.72], 0.025, black);
  mesh(root, "L88_AmberBeacon", new THREE.CylinderGeometry(0.065, 0.075, 0.105, 24), mat(AMBER, 0.35, 0.02, 0x5b2b00), [0, 0.89, -1.72]);

  const cradleLift = new THREE.Group();
  cradleLift.name = "L88_CradleLiftVisual";
  box(cradleLift, "L88_CradleWearPlate", [1.55, 0.075, 1.18], steel, [0, 0.17, 2.77]);
  mesh(cradleLift, "L88_CradleApproachRamp", wedgeGeometry(1.55, 0.09, 0.015, 0.73), steel, [0, 0.10, 3.31]);
  box(cradleLift, "L88_CradleRearGate", [1.48, 0.24, 0.10], steel, [0, 0.29, 2.21]);
  for (const side of [-1, 1]) {
    box(cradleLift, `L88_CradleSideGuide_${side}`, [0.075, 0.18, 0.83], steel, [side * 0.73, 0.26, 2.76]);
    box(cradleLift, `L88_CradleControlPod_${side}`, [0.15, 0.20, 0.32], red, [side * 0.88, 0.37, 2.14]);
  }

  const winch = new THREE.Group();
  winch.name = "L88_WinchAssembly";
  mesh(winch, "L88_WinchMotorHorizontal", new THREE.CylinderGeometry(0.115, 0.115, 0.47, 28), mat(0x25292c, 0.54, 0.56), [0, 0.49, 1.88], [0, 0, Math.PI / 2]);
  mesh(winch, "L88_WinchSpool", new THREE.CylinderGeometry(0.12, 0.12, 0.30, 28), silver, [0, 0.48, 2.00], [0, 0, Math.PI / 2]);
  const rollerPositions = [[-0.145, 0.43, 2.14], [0.145, 0.43, 2.14], [0.00, 0.32, 2.17]];
  rollerPositions.forEach(([x, y, z], index) => {
    mesh(winch, `L88_StrapRoller_${index + 1}`, new THREE.CylinderGeometry(0.045, 0.045, index === 2 ? 0.26 : 0.20, 22), silver, [x, y, z], [0, 0, Math.PI / 2]);
  });
  box(winch, "L88_WinchStrap", [0.055, 0.018, 0.93], strap, [0, 0.33, 2.63], [-0.03, 0, 0]);
  mesh(winch, "L88_StrapHook", new THREE.TorusGeometry(0.055, 0.013, 10, 24, Math.PI * 1.55), steel, [0, 0.32, 3.07], [Math.PI / 2, 0, 0]);
  cradleLift.add(winch);
  root.add(cradleLift);

  const wheels = [];
  const steeringPivots = [];
  for (const side of [-1, 1]) {
    const front = makeWheel(`L88_FrontDrive_${side < 0 ? "L" : "R"}`, 0.292, 0.254, false);
    front.pivot.position.set(side * 0.83, 0.292, 1.17);
    root.add(front.pivot);
    wheels.push(front);

    const rear = makeWheel(`L88_RearSteer_${side < 0 ? "L" : "R"}`, 0.267, 0.203, true);
    rear.pivot.position.set(side * 0.72, 0.267, -1.17);
    root.add(rear.pivot);
    wheels.push(rear);
    steeringPivots.push(rear.pivot);
  }

  for (const side of [-1, 1]) {
    box(root, `L88_Headlight_${side}`, [0.23, 0.12, 0.035], mat(WHITE, 0.32, 0.10, 0x4a4a3e), [side * 0.73, 0.44, 2.38]);
    box(root, `L88_AmberMarkerFront_${side}`, [0.11, 0.055, 0.025], mat(AMBER, 0.35, 0.03, 0x542200), [side * 0.98, 0.48, 1.75]);
    box(root, `L88_AmberMarkerRear_${side}`, [0.11, 0.055, 0.025], mat(AMBER, 0.35, 0.03, 0x542200), [side * 0.98, 0.48, -1.25]);
  }

  root.userData.vehicleVisualAuthority = "lektro-88-ap8850sda-user-reference-detailed-v1";
  root.userData.overallNominalMeters = [2.051, 0.99, 5.288];
  root.userData.steeringLayout = "rear-pair";
  root.userData.cradleAuthority = "low-open-wear-plate-horizontal-winch-three-roller-stack";

  return { root, wheels, steeringPivots, cradleLift };
}

export function installDetailedLektro88Visual(rig) {
  const detailed = buildDetailedLektro88Visual();
  rig.visual.visible = false;
  rig.root.add(detailed.root);
  rig.operatorEye.position.fromArray(rig.profile.operatorEye);
  rig.forwardLook.position.fromArray(rig.profile.operatorLook);

  rig.setSteering = (angle) => {
    for (const pivot of detailed.steeringPivots) pivot.rotation.y = -angle;
  };
  rig.rotateWheels = (distance) => {
    for (const wheel of detailed.wheels) {
      const radius = wheel.tire.geometry.parameters.radiusTop || 0.25;
      wheel.tire.rotation.x += distance / radius;
      wheel.rim.rotation.x = wheel.tire.rotation.x;
      wheel.hub.rotation.x = wheel.tire.rotation.x;
    }
  };
  rig.setLiftProgress = (progress) => {
    detailed.cradleLift.position.y = Math.max(0, Math.min(1, progress)) * rig.profile.liftTravel;
  };

  rig.root.userData.authoredVehicleScene = detailed.root;
  rig.root.userData.runtimeVisualSource = "detailed-lektro-88-ap8850sda-v1";
  rig.root.userData.runtimeVisualUrl = "procedural-threejs-detailed";
  rig.root.userData.vehicleRole = rig.profile.role;
  rig.root.userData.vehicleReferenceModel = rig.profile.referenceModel;
  rig.root.userData.operatorStation = "seated-dual-seat-left-helm";
  rig.root.userData.operatorControls = "steering-wheel-pedals-direction-selector-cradle-winch";
  rig.root.userData.steeringLayout = "rear-pair-near-90-degree";
  return rig.root.userData.runtimeVisualSource;
}
