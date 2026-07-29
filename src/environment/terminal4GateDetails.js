import concourseA from "./kphxV181/concourseA.js";

export const TERMINAL4_GATE_DETAIL_PROFILE = Object.freeze({
  gates: Object.freeze(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  sceneOffsetZ: 6.2,
  detailLevel: "terminal4-gate-signage-service-bays-and-safety-fixtures-v2",
});

function jetwayByGate(gateName) {
  const jetway = concourseA.jetways.find((entry) => entry.g === gateName);
  if (!jetway) throw new Error(`Terminal 4 gate detail jetway ${gateName} is missing from KPHX source records`);
  return jetway;
}

function createGateSignTexture(THREE, gateName) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Terminal 4 gate sign canvas is unavailable");
  context.fillStyle = "#102b48";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#d6dde2";
  context.lineWidth = 10;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 142px Arial, sans-serif";
  context.fillText(gateName, 256, 108);
  context.font = "700 29px Arial, sans-serif";
  context.fillText("AMERICAN EAGLE", 256, 210);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function createMaterials(THREE) {
  return {
    terminal: new THREE.MeshStandardMaterial({ color: 0xa49c91, roughness: 0.88, metalness: 0.015 }),
    terminalAccent: new THREE.MeshStandardMaterial({ color: 0x77736e, roughness: 0.84, metalness: 0.04 }),
    interior: new THREE.MeshStandardMaterial({ color: 0x343536, roughness: 0.93, metalness: 0.01 }),
    floor: new THREE.MeshStandardMaterial({ color: 0x676766, roughness: 0.94, metalness: 0.01 }),
    door: new THREE.MeshStandardMaterial({ color: 0x73787a, roughness: 0.78, metalness: 0.24 }),
    doorSlat: new THREE.MeshStandardMaterial({ color: 0x4d5255, roughness: 0.74, metalness: 0.28 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xc4c7c6, roughness: 0.5, metalness: 0.46 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf3bd1f, roughness: 0.7, metalness: 0.08 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.92, metalness: 0.02 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8212b, roughness: 0.66, metalness: 0.08 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f1eb, roughness: 0.76, metalness: 0.04 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x567887,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
    light: new THREE.MeshStandardMaterial({
      color: 0xffe4a3,
      emissive: 0xffc766,
      emissiveIntensity: 1.8,
      roughness: 0.32,
      metalness: 0.08,
    }),
  };
}

function finishMesh(mesh, detailType) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.userData.terminal4GateDetail = detailType;
  return mesh;
}

function buildGateSign(THREE, gateName, materials) {
  const group = new THREE.Group();
  group.name = `PHX_${gateName}_GateSign`;
  const backing = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(4.1, 2.04, 0.18), materials.black), "gate-sign-backing");
  backing.position.z = -0.05;
  group.add(backing);
  const signMaterial = new THREE.MeshBasicMaterial({ map: createGateSignTexture(THREE, gateName), toneMapped: false });
  const face = finishMesh(new THREE.Mesh(new THREE.PlaneGeometry(3.86, 1.8), signMaterial), "gate-sign-face");
  face.position.z = 0.055;
  group.add(face);
  const bracket = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.12, 0.18), materials.frame), "gate-sign-bracket");
  bracket.position.set(0, -1.56, -0.05);
  group.add(bracket);
  return group;
}

function buildServiceBay(THREE, materials) {
  const group = new THREE.Group();
  group.name = "PHX_TerminalServiceBay";

  // A full lower-facade module sits directly in the previously empty terminal bay.
  // Its shallow interior, back wall and floor prevent the browser from rendering a
  // featureless black void while keeping believable service depth.
  const facade = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(10.4, 4.0, 0.42), materials.terminal), "service-bay-facade");
  facade.position.z = -0.42;
  group.add(facade);

  const interior = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(6.55, 3.2, 3.0), materials.interior), "service-bay-interior-depth");
  interior.position.set(-1.15, -0.18, 1.2);
  group.add(interior);
  const interiorFloor = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(6.7, 0.12, 3.25), materials.floor), "service-bay-interior-floor");
  interiorFloor.position.set(-1.15, -1.72, 1.3);
  group.add(interiorFloor);

  const doorFrame = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.35, 0.32), materials.frame), "service-bay-door-frame");
  doorFrame.position.set(-1.15, -0.08, 0.11);
  group.add(doorFrame);
  const door = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(5.95, 2.92, 0.12), materials.door), "service-bay-door");
  door.position.set(-1.15, -0.13, 0.31);
  group.add(door);
  for (let slat = -7; slat <= 7; slat += 1) {
    const rib = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.025, 0.035), materials.doorSlat), "service-bay-door-slat");
    rib.position.set(-1.15, slat * 0.185 - 0.13, 0.39);
    group.add(rib);
  }

  const personnelDoorFrame = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(1.65, 3.0, 0.28), materials.frame), "service-personnel-door-frame");
  personnelDoorFrame.position.set(3.7, -0.25, 0.12);
  group.add(personnelDoorFrame);
  const personnelDoor = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.72, 0.12), materials.terminalAccent), "service-personnel-door");
  personnelDoor.position.set(3.7, -0.27, 0.31);
  group.add(personnelDoor);
  const window = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.58, 0.035), materials.glass), "service-personnel-door-window");
  window.position.set(3.7, 0.35, 0.39);
  group.add(window);
  const handle = finishMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 12), materials.frame), "service-personnel-door-handle");
  handle.rotation.x = Math.PI / 2;
  handle.position.set(4.15, -0.28, 0.43);
  group.add(handle);

  const curb = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(10.75, 0.24, 0.78), materials.terminal), "service-bay-curb");
  curb.position.set(0, -2.02, 0.22);
  group.add(curb);
  const canopy = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.22, 0.92), materials.terminalAccent), "service-bay-canopy");
  canopy.position.set(0, 2.05, 0.22);
  group.add(canopy);

  for (const x of [-3.25, 0.95, 3.7]) {
    const lightHousing = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.26), materials.black), "service-bay-light-housing");
    lightHousing.position.set(x, 1.87, 0.43);
    group.add(lightHousing);
    const light = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), materials.light), "service-bay-light");
    light.position.set(x, 1.81, 0.59);
    group.add(light);
  }
  return group;
}

function buildFireCabinet(THREE, materials) {
  const group = new THREE.Group();
  group.name = "PHX_FireCabinet";
  const body = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.25, 0.3), materials.red), "fire-cabinet");
  group.add(body);
  const crossVertical = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.035), materials.white), "fire-cabinet-marking");
  crossVertical.position.z = 0.17;
  group.add(crossVertical);
  const crossHorizontal = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.035), materials.white), "fire-cabinet-marking");
  crossHorizontal.position.z = 0.17;
  group.add(crossHorizontal);
  return group;
}

function buildBollard(THREE, materials) {
  const group = new THREE.Group();
  const post = finishMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.15, 16), materials.yellow), "jetway-bollard");
  post.position.y = 0.58;
  group.add(post);
  for (const y of [0.38, 0.72]) {
    const stripe = finishMesh(new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.12, 16), materials.black), "jetway-bollard-stripe");
    stripe.position.y = y;
    group.add(stripe);
  }
  return group;
}

function buildWheelStop(THREE, materials) {
  const group = new THREE.Group();
  const stop = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.38), materials.yellow), "jetway-wheel-stop");
  stop.position.y = 0.12;
  group.add(stop);
  for (const x of [-0.42, 0, 0.42]) {
    const stripe = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.235, 0.395), materials.black), "jetway-wheel-stop-stripe");
    stripe.position.set(x, 0.125, 0);
    stripe.rotation.z = 0.35;
    group.add(stripe);
  }
  return group;
}

function placeGateDetails(THREE, gateName, jetway, materials) {
  const dx = jetway.px - jetway.x;
  const dz = jetway.pz - jetway.z;
  const distance = Math.max(1, Math.hypot(dx, dz));
  const outwardX = dx / distance;
  const outwardZ = dz / distance;
  const yaw = Math.atan2(outwardX, outwardZ);

  const group = new THREE.Group();
  group.name = `PHX_${gateName}_TerminalServiceDetails`;
  group.position.set(jetway.x, 0, jetway.z + TERMINAL4_GATE_DETAIL_PROFILE.sceneOffsetZ);
  group.rotation.y = yaw;
  group.userData.gate = gateName;
  group.userData.placementAuthority = "decoded KPHX jetway root and parking vector";

  const serviceBay = buildServiceBay(THREE, materials);
  serviceBay.position.set(0, 2.02, -1.3);
  group.add(serviceBay);

  const sign = buildGateSign(THREE, gateName, materials);
  sign.position.set(-3.2, 5.45, 0.82);
  group.add(sign);

  const cabinet = buildFireCabinet(THREE, materials);
  cabinet.position.set(-5.0, 1.08, 0.1);
  group.add(cabinet);

  for (const x of [-1.55, 1.55]) {
    const bollard = buildBollard(THREE, materials);
    bollard.position.set(x, 0, 2.15);
    group.add(bollard);
  }
  for (const x of [-1.35, 1.35]) {
    const stop = buildWheelStop(THREE, materials);
    stop.position.set(x, 0, 3.6);
    group.add(stop);
  }
  return group;
}

export async function installTerminal4GateDetails(THREE, environment) {
  if (!environment?.isGroup) throw new Error("KPHX environment group is required for Terminal 4 gate details");
  const materials = createMaterials(THREE);
  const group = new THREE.Group();
  group.name = "PHX_Terminal4_GateServiceDetails";
  for (const gateName of TERMINAL4_GATE_DETAIL_PROFILE.gates) {
    group.add(placeGateDetails(THREE, gateName, jetwayByGate(gateName), materials));
  }
  let meshCount = 0;
  group.traverse((node) => {
    if (node.isMesh) meshCount += 1;
  });
  group.userData.gateCount = TERMINAL4_GATE_DETAIL_PROFILE.gates.length;
  group.userData.meshCount = meshCount;
  group.userData.detailLevel = TERMINAL4_GATE_DETAIL_PROFILE.detailLevel;
  environment.add(group);
  environment.userData.terminal4GateDetails = group;
  environment.userData.terminal4GateDetailGateCount = group.userData.gateCount;
  environment.userData.terminal4GateDetailMeshCount = group.userData.meshCount;
  environment.userData.terminal4GateDetailLevel = group.userData.detailLevel;
  return group;
}
