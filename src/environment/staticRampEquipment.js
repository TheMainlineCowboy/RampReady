import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installA1SimulatorApron } from "./a1SimulatorApron.js";
import concourseA from "./kphxV181/concourseA.js";

export const STATIC_RAMP_EQUIPMENT_PROFILE = Object.freeze({
  tugGates: Object.freeze(["A2", "A4", "A6"]),
  conedGates: Object.freeze(["A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  beltLoaderGates: Object.freeze(["A1", "A2", "A4", "A6", "A8"]),
  baggageCartGates: Object.freeze(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  gpuGates: Object.freeze(["A1", "A3", "A5", "A7"]),
  towbarGates: Object.freeze(["A2", "A6", "A8"]),
  chockedGates: Object.freeze(["A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  tugSource: "models/standup-tug.glb",
  sceneOffsetZ: 6.2,
  detailLevel: "authored-and-procedural-terminal4-ramp-equipment-v2",
});

function gateByName(name) {
  const gate = concourseA.parkings.find((parking) => parking.g === name);
  if (!gate) throw new Error(`Ramp equipment gate ${name} is missing from KPHX source parking records`);
  return gate;
}

function applyPiedmontFinish(THREE, scene) {
  const piedmontRed = new THREE.Color(0xd01f2d);
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    const materials = originals.map((original) => {
      const material = original?.clone?.() ?? new THREE.MeshStandardMaterial();
      const brightness = material.color ? (material.color.r + material.color.g + material.color.b) / 3 : 1;
      if (material.color && (material.map || brightness > 0.42)) material.color.lerp(piedmontRed, material.map ? 0.92 : 0.84);
      material.roughness = Math.max(0.5, material.roughness ?? 0.5);
      material.needsUpdate = true;
      return material;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData.staticRampEquipment = true;
  });
}

function gateFrame(gate) {
  const yaw = (270 - gate.h) * Math.PI / 180;
  const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  return { yaw, forward, right };
}

function placeAtGate(object, gate, forwardOffset, rightOffset, yawOffset = 0, height = 0.045) {
  const { yaw, forward, right } = gateFrame(gate);
  object.position.set(
    gate.x + forward.x * forwardOffset + right.x * rightOffset,
    height,
    gate.z + STATIC_RAMP_EQUIPMENT_PROFILE.sceneOffsetZ + forward.z * forwardOffset + right.z * rightOffset,
  );
  object.rotation.y = yaw + yawOffset;
  object.userData.gate = gate.g;
  object.userData.placementAuthority = "decoded KPHX ADEX parking frame";
  return object;
}

function createRampMaterials(THREE) {
  return Object.freeze({
    red: new THREE.MeshStandardMaterial({ color: 0xc9202d, roughness: 0.66, metalness: 0.14 }),
    redDark: new THREE.MeshStandardMaterial({ color: 0x8d151e, roughness: 0.72, metalness: 0.12 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.9, metalness: 0.02 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.97, metalness: 0 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xbfc4c3, roughness: 0.48, metalness: 0.52 }),
    aluminum: new THREE.MeshStandardMaterial({ color: 0x8e9699, roughness: 0.58, metalness: 0.38 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf1eee7, roughness: 0.75, metalness: 0.04 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf3b51b, roughness: 0.76, metalness: 0.04 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xf06a1a, roughness: 0.82, metalness: 0.02 }),
    tarp: new THREE.MeshStandardMaterial({ color: 0xb8b7ae, roughness: 0.94, metalness: 0.01 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x6d8d9a,
      roughness: 0.18,
      metalness: 0.08,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    }),
  });
}

function finishGroup(group, sourceType) {
  group.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
    node.userData.staticRampEquipment = true;
    node.userData.rampEquipmentType = sourceType;
  });
  group.userData.rampEquipmentType = sourceType;
  return group;
}

function addWheel(THREE, group, materials, x, y, z, radius = 0.22, width = 0.14) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 18), materials.rubber);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, y, z);
  group.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.38, radius * 0.38, width + 0.012, 16), materials.silver);
  hub.rotation.z = Math.PI / 2;
  hub.position.copy(wheel.position);
  group.add(hub);
}

function buildSafetyCone(THREE, materials) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.42), materials.rubber);
  base.position.y = 0.028;
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.17, 0.38, 18), materials.orange);
  lower.position.y = 0.27;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.09, 0.095, 18), materials.white);
  band.position.y = 0.39;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.06, 0.24, 18), materials.orange);
  tip.position.y = 0.555;
  group.add(base, lower, band, tip);
  group.name = "PHX_RampSafetyCone";
  return finishGroup(group, "safety-cone");
}

function addGateCones(THREE, materials, group, gate) {
  const { yaw, forward, right } = gateFrame(gate);
  const patterns = [
    { forward: -7.2, right: -9.3 },
    { forward: -7.2, right: 9.3 },
    { forward: 8.4, right: -8.8 },
    { forward: 8.4, right: 8.8 },
  ];
  for (const offset of patterns) {
    const cone = buildSafetyCone(THREE, materials);
    cone.position.set(
      gate.x + forward.x * offset.forward + right.x * offset.right,
      0.045,
      gate.z + STATIC_RAMP_EQUIPMENT_PROFILE.sceneOffsetZ + forward.z * offset.forward + right.z * offset.right,
    );
    cone.rotation.y = yaw;
    cone.userData.gate = gate.g;
    group.add(cone);
  }
}

function buildBaggageCartTrain(THREE, materials) {
  const train = new THREE.Group();
  train.name = "PHX_BaggageCartTrain";
  for (let cartIndex = 0; cartIndex < 3; cartIndex += 1) {
    const cart = new THREE.Group();
    cart.position.z = cartIndex * 2.7;
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 1.18), materials.redDark);
    chassis.position.y = 0.42;
    cart.add(chassis);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.08, 1.02), materials.aluminum);
    floor.position.y = 0.58;
    cart.add(floor);
    for (const x of [-0.92, 0.92]) {
      for (const z of [-0.49, 0.49]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.86, 0.045), materials.silver);
        post.position.set(x, 1.02, z);
        cart.add(post);
      }
    }
    for (const z of [-0.5, 0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.05, 0.05), materials.silver);
      rail.position.set(0, 1.42, z);
      cart.add(rail);
    }
    for (const x of [-0.93, 0.93]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), materials.silver);
      rail.position.set(x, 1.42, 0);
      cart.add(rail);
    }
    if (cartIndex !== 1) {
      const tarp = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.08, 1.08), materials.tarp);
      tarp.position.y = 1.49;
      cart.add(tarp);
      const baggage = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.52, 0.72), materials.red);
      baggage.position.y = 0.86;
      cart.add(baggage);
    } else {
      for (let bag = 0; bag < 5; bag += 1) {
        const luggage = new THREE.Mesh(new THREE.BoxGeometry(0.42 + (bag % 2) * 0.12, 0.34, 0.28), bag % 2 ? materials.black : materials.red);
        luggage.position.set(-0.62 + (bag % 3) * 0.58, 0.78 + Math.floor(bag / 3) * 0.3, -0.22 + (bag % 2) * 0.42);
        luggage.rotation.y = (bag - 2) * 0.08;
        cart.add(luggage);
      }
    }
    for (const x of [-0.78, 0.78]) {
      for (const z of [-0.49, 0.49]) addWheel(THREE, cart, materials, x, 0.24, z, 0.18, 0.12);
    }
    if (cartIndex < 2) {
      const drawbar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.82, 12), materials.silver);
      drawbar.rotation.x = Math.PI / 2;
      drawbar.position.set(0, 0.39, 1.57);
      cart.add(drawbar);
    }
    train.add(cart);
  }
  return finishGroup(train, "baggage-cart-train");
}

function buildBeltLoader(THREE, materials) {
  const loader = new THREE.Group();
  loader.name = "PHX_BeltLoader";
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.34, 3.2), materials.red);
  chassis.position.y = 0.52;
  loader.add(chassis);
  const engineCover = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 1.05), materials.redDark);
  engineCover.position.set(0, 0.98, -0.72);
  loader.add(engineCover);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.48, 0.04), materials.glass);
  windshield.position.set(0, 1.25, -1.26);
  loader.add(windshield);
  for (const x of [-0.92, 0.92]) {
    for (const z of [-1.15, 1.05]) addWheel(THREE, loader, materials, x, 0.33, z, 0.31, 0.18);
  }

  const conveyor = new THREE.Group();
  conveyor.position.set(0, 1.38, 0.72);
  conveyor.rotation.x = -0.29;
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 4.4), materials.black);
  conveyor.add(belt);
  for (const x of [-0.72, 0.72]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 4.46), materials.red);
    rail.position.set(x, 0.18, 0);
    conveyor.add(rail);
  }
  for (let roller = -4; roller <= 4; roller += 1) {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.18, 14), materials.silver);
    cylinder.rotation.z = Math.PI / 2;
    cylinder.position.set(0, 0.09, roller * 0.48);
    conveyor.add(cylinder);
  }
  loader.add(conveyor);

  for (const x of [-0.61, 0.61]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.7, 12), materials.silver);
    strut.position.set(x, 1.05, 1.08);
    strut.rotation.x = 0.58;
    loader.add(strut);
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 18), materials.orange);
  beacon.position.set(0.82, 1.54, -0.73);
  loader.add(beacon);
  return finishGroup(loader, "belt-loader");
}

function buildGpuCart(THREE, materials) {
  const gpu = new THREE.Group();
  gpu.name = "PHX_GroundPowerUnit";
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.22, 1.45), materials.redDark);
  chassis.position.y = 0.38;
  gpu.add(chassis);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 1.25, 1.2), materials.red);
  body.position.set(0, 1.05, 0);
  gpu.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 1.32), materials.white);
  top.position.y = 1.72;
  gpu.add(top);
  for (let vent = -3; vent <= 3; vent += 1) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.025), materials.black);
    slat.position.set(vent * 0.19, 1.08, -0.615);
    gpu.add(slat);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.035), materials.black);
  panel.position.set(0.45, 1.35, 0.62);
  gpu.add(panel);
  const cableCoil = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 10, 32), materials.black);
  cableCoil.position.set(-0.48, 0.98, 0.63);
  gpu.add(cableCoil);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-0.5, 0.5]) addWheel(THREE, gpu, materials, x, 0.25, z, 0.22, 0.14);
  }
  const towEye = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), materials.silver);
  towEye.rotation.x = Math.PI / 2;
  towEye.position.set(0, 0.38, 1.02);
  gpu.add(towEye);
  return finishGroup(gpu, "ground-power-unit");
}

function buildTowbar(THREE, materials) {
  const towbar = new THREE.Group();
  towbar.name = "PHX_Towbar";
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 4.4, 14), materials.yellow);
  shaft.rotation.x = Math.PI / 2;
  shaft.position.y = 0.34;
  towbar.add(shaft);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.22, 0.5), materials.yellow);
  head.position.set(0, 0.34, -2.24);
  towbar.add(head);
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 10, 24), materials.silver);
  eye.rotation.x = Math.PI / 2;
  eye.position.set(0, 0.34, 2.28);
  towbar.add(eye);
  addWheel(THREE, towbar, materials, -0.38, 0.22, -0.45, 0.18, 0.12);
  addWheel(THREE, towbar, materials, 0.38, 0.22, -0.45, 0.18, 0.12);
  return finishGroup(towbar, "towbar");
}

function buildChockPair(THREE, materials) {
  const pair = new THREE.Group();
  pair.name = "PHX_WheelChockPair";
  for (const x of [-0.72, 0.72]) {
    const chock = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.38, 3), materials.yellow);
    chock.rotation.z = Math.PI / 2;
    chock.rotation.x = Math.PI / 6;
    chock.position.set(x, 0.23, 0);
    pair.add(chock);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), materials.black);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(0, 0.12, 0.24);
    pair.add(rope);
  }
  return finishGroup(pair, "wheel-chocks");
}

export async function installStaticRampEquipment(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for static ramp equipment");
  const url = `${import.meta.env.BASE_URL}${STATIC_RAMP_EQUIPMENT_PROFILE.tugSource}`;
  const [{ scene: tugTemplate }, apron] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    installA1SimulatorApron(THREE, environment),
  ]);
  applyPiedmontFinish(THREE, tugTemplate);
  const materials = createRampMaterials(THREE);

  const group = new THREE.Group();
  group.name = "PHX_StaticRampEquipmentPopulation";
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.tugGates) {
    const gate = gateByName(gateName);
    const tug = tugTemplate.clone(true);
    placeAtGate(tug, gate, 12.5, 2.4, Math.PI, 0.04);
    tug.name = `PHX_StaticStandup_${gate.g}`;
    group.add(tug);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.conedGates) addGateCones(THREE, materials, group, gateByName(gateName));
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.beltLoaderGates) {
    const loader = buildBeltLoader(THREE, materials);
    placeAtGate(loader, gateByName(gateName), -4.5, 12.6, Math.PI / 2);
    group.add(loader);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.baggageCartGates) {
    const carts = buildBaggageCartTrain(THREE, materials);
    placeAtGate(carts, gateByName(gateName), -13.5, -14.5, Math.PI / 2);
    group.add(carts);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.gpuGates) {
    const gpu = buildGpuCart(THREE, materials);
    placeAtGate(gpu, gateByName(gateName), -8.5, 16.2, Math.PI / 2);
    group.add(gpu);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.towbarGates) {
    const towbar = buildTowbar(THREE, materials);
    placeAtGate(towbar, gateByName(gateName), -14.5, 7.4, Math.PI / 2);
    group.add(towbar);
  }
  for (const gateName of STATIC_RAMP_EQUIPMENT_PROFILE.chockedGates) {
    const chocks = buildChockPair(THREE, materials);
    placeAtGate(chocks, gateByName(gateName), 3.8, 0, 0, 0.04);
    group.add(chocks);
  }

  group.userData.authoredTugCount = STATIC_RAMP_EQUIPMENT_PROFILE.tugGates.length;
  group.userData.safetyConeCount = STATIC_RAMP_EQUIPMENT_PROFILE.conedGates.length * 4;
  group.userData.beltLoaderCount = STATIC_RAMP_EQUIPMENT_PROFILE.beltLoaderGates.length;
  group.userData.baggageCartTrainCount = STATIC_RAMP_EQUIPMENT_PROFILE.baggageCartGates.length;
  group.userData.gpuCount = STATIC_RAMP_EQUIPMENT_PROFILE.gpuGates.length;
  group.userData.towbarCount = STATIC_RAMP_EQUIPMENT_PROFILE.towbarGates.length;
  group.userData.chockPairCount = STATIC_RAMP_EQUIPMENT_PROFILE.chockedGates.length;
  group.userData.totalObjectCount = group.children.length;
  group.userData.detailLevel = STATIC_RAMP_EQUIPMENT_PROFILE.detailLevel;
  group.userData.apronDetailLevel = apron.userData.detailLevel;
  group.userData.apronTextureResolution = apron.userData.textureResolution;
  environment.add(group);
  environment.userData.staticRampEquipment = group;
  environment.userData.staticRampAuthoredTugCount = group.userData.authoredTugCount;
  environment.userData.staticRampSafetyConeCount = group.userData.safetyConeCount;
  environment.userData.staticRampBeltLoaderCount = group.userData.beltLoaderCount;
  environment.userData.staticRampBaggageCartTrainCount = group.userData.baggageCartTrainCount;
  environment.userData.staticRampGpuCount = group.userData.gpuCount;
  environment.userData.staticRampTowbarCount = group.userData.towbarCount;
  environment.userData.staticRampChockPairCount = group.userData.chockPairCount;
  environment.userData.staticRampEquipmentObjectCount = group.userData.totalObjectCount;
  environment.userData.staticRampEquipmentDetailLevel = group.userData.detailLevel;
  environment.userData.staticRampApronDetailLevel = group.userData.apronDetailLevel;
  environment.userData.staticRampApronTextureResolution = group.userData.apronTextureResolution;
  return group;
}
