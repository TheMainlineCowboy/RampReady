import concourseA from "./kphxV181/concourseA.js";

export const TERMINAL4_GATE_DETAIL_PROFILE = Object.freeze({
  gates: Object.freeze(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]),
  sceneOffsetZ: 6.2,
  detailLevel: "terminal4-gate-signage-service-bays-and-safety-fixtures-v1",
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
  context.font = "700 30px Arial, sans-serif";
  context.letterSpacing = "4px";
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
    concrete: new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.9, metalness: 0.01 }),
    door: new THREE.MeshStandardMaterial({ color: 0x73787a, roughness: 0.78, metalness: 0.24 }),
    doorSlat: new THREE.MeshStandardMaterial({ color: 0x4d5255, roughness: 0.74, metalness: 0.28 }),
    frame: new THREE.MeshStandardMaterial({ color: 0xc4c7c6, roughness: 0.5, metalness: 0.46 }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xf3bd1f, roughness: 0.7, metalness: 0.08 }),
    black: new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.92, metalness: 0.02 }),
    red: new THREE.MeshStandardMaterial({ color: 0xc8212b, roughness: 0.66, metalness: 0.08 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f1eb, roughness: 0.76, metalness: 0.04 }),
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
  const backing = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(3.45, 1.72, 0.16), materials.black), "gate-sign-backing");
  backing.position.z = -0.05;
  group.add(backing);
  const signMaterial = new THREE.MeshBasicMaterial({ map: createGateSignTexture(THREE, gateName), toneMapped: false });
  const face = finishMesh(new THREE.Mesh(new THREE.PlaneGeometry(3.25, 1.52), signMaterial), "gate-sign-face");
  face.position.z = 0.045;
  group.add(face);
  const bracket = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), materials.frame), "gate-sign-bracket");
  bracket.position.set(0, -1.32, -0.05);
  group.add(bracket);
  return group;
}

function buildServiceBay(THREE, materials) {
  const group = new THREE.Group();
  group.name = "PHX_TerminalServiceBay";
  const surround = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(5.15, 3.55, 0.28), materials.concrete), "service-bay-surround");
  group.add(surround);
  const door = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(4.55, 3.02, 0.12), materials.door), "service-bay-door");
  door.position.z = 0.16;
  group.add(door);
  for (let slat = -7; slat <= 7; slat += 1) {
    const rib = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(4.42, 0.025, 0.035), materials.doorSlat), "service-bay-door-slat");
    rib.position.set(0, slat * 0.19, 0.24);
    group.add(rib);
  }
  const curb = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(5.45, 0.22, 0.72), materials.concrete), "service-bay-curb");
  curb.position.set(0, -1.76, 0.22);
  group.add(curb);
  const lightHousing = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.26), materials.black), "service-bay-light-housing");
  lightHousing.position.set(0, 1.98, 0.2);
  group.add(lightHousing);
  const light = finishMesh(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.08), materials.light), "service-bay-light");
  light.position.set(0, 1.93, 0.38);
  group.add(light);
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

  const sign = buildGateSign(THREE, gateName, materials);
  sign.position.set(-3.8, 5.15, 1.15);
  group.add(sign);

  const serviceBay = buildServiceBay(THREE, materials);
  serviceBay.position.set(5.7, 1.92, -2.1);
  group.add(serviceBay);

  const cabinet = buildFireCabinet(THREE, materials);
  cabinet.position.set(-5.2, 1.05, -0.7);
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
