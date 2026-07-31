import * as THREE from "three";

const A1_WALL = Object.freeze({
  normal: Object.freeze([0.580968, 0, -0.813927]),
  exactPoint: Object.freeze([-3.55299146, 0, -40.60699866]),
  spanMeters: 58,
  heightMeters: 3.34,
});

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeConcreteTexture(seed = 4622) {
  return canvasTexture(1024, 512, (context, width, height) => {
    const random = seededNoise(seed);
    context.fillStyle = "#b8aa96";
    context.fillRect(0, 0, width, height);

    const light = context.createLinearGradient(0, 0, 0, height);
    light.addColorStop(0, "rgba(255,255,255,0.13)");
    light.addColorStop(0.48, "rgba(255,255,255,0.015)");
    light.addColorStop(1, "rgba(65,55,45,0.20)");
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(72,64,56,0.52)";
    context.lineWidth = 5;
    for (let x = 0; x <= width; x += 205) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      context.strokeStyle = "rgba(245,239,228,0.20)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 7, 0);
      context.lineTo(x + 7, height);
      context.stroke();
      context.strokeStyle = "rgba(72,64,56,0.52)";
      context.lineWidth = 5;
    }
    for (const y of [168, 338]) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    for (let index = 0; index < 260; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 2 + random() * 17;
      context.fillStyle = `rgba(63,52,43,${(0.008 + random() * 0.038).toFixed(3)})`;
      context.beginPath();
      context.ellipse(x, y, radius * (1.2 + random() * 1.8), radius, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "rgba(58,48,40,0.16)";
    for (let x = 32; x < width; x += 96) {
      const length = 18 + random() * 84;
      context.fillRect(x, 0, 2 + random() * 4, length);
    }
  });
}

function makeConcreteBump(seed = 8231) {
  return canvasTexture(1024, 512, (context, width, height) => {
    const random = seededNoise(seed);
    context.fillStyle = "rgb(142,142,142)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgb(43,43,43)";
    context.lineWidth = 8;
    for (let x = 0; x <= width; x += 205) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (const y of [168, 338]) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    for (let index = 0; index < 340; index += 1) {
      const shade = 116 + Math.floor(random() * 50);
      context.fillStyle = `rgb(${shade},${shade},${shade})`;
      const size = 1 + random() * 8;
      context.fillRect(random() * width, random() * height, size, size);
    }
  });
}

function makeGateTexture() {
  return canvasTexture(768, 384, (context, width, height) => {
    context.fillStyle = "#111b22";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#e3e7e9";
    context.lineWidth = 18;
    context.strokeRect(12, 12, width - 24, height - 24);
    context.fillStyle = "#f7f9fa";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 62px Arial, sans-serif";
    context.fillText("GATE", width / 2, 76);
    context.font = "800 210px Arial, sans-serif";
    context.fillText("A1", width / 2, 246);
  });
}

function standard(name, color, roughness = 0.8, metalness = 0.04, extra = {}) {
  return new THREE.MeshStandardMaterial({ name, color, roughness, metalness, side: THREE.DoubleSide, ...extra });
}

function addBox(parent, name, material, position, size, quaternion) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, name, material, start, end, radius = 0.035) {
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 16), material);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function point(frontPlane, tangent, normal, offset, y, outward = 0) {
  return frontPlane.clone().addScaledVector(tangent, offset).addScaledVector(normal, outward).setY(y);
}

function addReadableGateSign(parent, frontPlane, tangent, normal, quaternion) {
  const texture = makeGateTexture();
  const backing = standard("Terminal 4 A1 readable gate sign housing", 0x2d363a, 0.55, 0.42);
  addBox(parent, "Terminal4_A1_ReadableGateSignHousing_V22", backing, point(frontPlane, tangent, normal, 2.85, 2.55, 0.34), [1.38, 0.78, 0.14], quaternion);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.20, 0.62),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }),
  );
  sign.name = "Terminal4_A1_ReadableGateSign_V22";
  sign.position.copy(point(frontPlane, tangent, normal, 2.85, 2.55, 0.425));
  sign.quaternion.copy(quaternion);
  sign.renderOrder = 5;
  parent.add(sign);
}

export function installTerminal4A1ExtendedFacadeV22(group) {
  if (!group?.isGroup) throw new Error("A1 extended facade requires the source-placed Terminal 4 jetway group");
  const existing = group.getObjectByName("Terminal4_A1_ExtendedRampFacade_V22");
  if (existing) return existing;

  const root = new THREE.Group();
  root.name = "Terminal4_A1_ExtendedRampFacade_V22";

  const normal = new THREE.Vector3(...A1_WALL.normal).normalize();
  const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
  const exactWall = new THREE.Vector3(...A1_WALL.exactPoint);
  const frontPlane = exactWall.clone().addScaledVector(normal, 0.22);
  const yaw = Math.atan2(normal.x, normal.z);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

  const concreteMap = makeConcreteTexture();
  const concreteBump = makeConcreteBump();
  const facadeMaterial = standard("Terminal 4 A1 weathered precast facade v22", 0xffffff, 0.92, 0.01, {
    map: concreteMap,
    bumpMap: concreteBump,
    bumpScale: 0.035,
  });
  facadeMaterial.polygonOffset = true;
  facadeMaterial.polygonOffsetFactor = -1;
  facadeMaterial.polygonOffsetUnits = -1;

  const darkerConcrete = facadeMaterial.clone();
  darkerConcrete.name = "Terminal 4 A1 alternate weathered precast facade v22";
  darkerConcrete.color.setHex(0xd2c7b8);

  const joint = standard("Terminal 4 A1 deep precast joint v22", 0x5f5851, 0.86, 0.04);
  const plinth = standard("Terminal 4 A1 dark ramp plinth v22", 0x4d4c49, 0.94, 0.02);
  const rail = standard("Terminal 4 A1 galvanized wall protection v22", 0x697174, 0.55, 0.48);
  const door = standard("Terminal 4 A1 service door v22", 0x626a6d, 0.66, 0.24);
  const frame = standard("Terminal 4 A1 door and vent frame v22", 0x424a4d, 0.58, 0.44);
  const vent = standard("Terminal 4 A1 ventilation grille v22", 0x30383b, 0.58, 0.48);
  const cabinet = standard("Terminal 4 A1 utility cabinet v22", 0xa99e8f, 0.82, 0.1);
  const cabinetDoor = standard("Terminal 4 A1 utility cabinet door v22", 0x62696b, 0.64, 0.32);
  const conduit = standard("Terminal 4 A1 galvanized conduit v22", 0x6a7376, 0.52, 0.52);
  const lampHousing = standard("Terminal 4 A1 wall lamp housing v22", 0x323a3d, 0.48, 0.5);
  const lampLens = standard("Terminal 4 A1 wall lamp lens v22", 0xf3ddb3, 0.28, 0.02, {
    emissive: 0xffbd68,
    emissiveIntensity: 0.72,
  });
  const bollard = standard("Terminal 4 A1 yellow safety bollard v22", 0xe3ad20, 0.62, 0.16);

  const bays = [
    { offset: -26.0, width: 4.7 },
    { offset: -21.2, width: 4.5 },
    { offset: -16.45, width: 4.6 },
    { offset: -11.65, width: 4.45 },
    { offset: -7.15, width: 4.2 },
    { offset: -3.85, width: 2.2 },
    { offset: 3.85, width: 2.2 },
    { offset: 7.15, width: 4.2 },
    { offset: 11.65, width: 4.45 },
    { offset: 16.45, width: 4.6 },
    { offset: 21.2, width: 4.5 },
    { offset: 26.0, width: 4.7 },
  ];

  bays.forEach((bay, index) => {
    addBox(
      root,
      `Terminal4_A1_ExtendedFacadeBay_${index}_V22`,
      index % 4 === 1 ? darkerConcrete : facadeMaterial,
      point(frontPlane, tangent, normal, bay.offset, 1.73, 0.02),
      [bay.width, A1_WALL.heightMeters, 0.16],
      quaternion,
    );
  });

  addBox(root, "Terminal4_A1_ExtendedFacadePlinth_V22", plinth, point(frontPlane, tangent, normal, 0, 0.40, 0.14), [A1_WALL.spanMeters, 0.72, 0.16], quaternion);
  addBox(root, "Terminal4_A1_ExtendedFacadeProtectionRail_V22", rail, point(frontPlane, tangent, normal, 0, 1.16, 0.28), [A1_WALL.spanMeters - 1.2, 0.13, 0.13], quaternion);
  addBox(root, "Terminal4_A1_ExtendedFacadeUpperBand_V22", rail, point(frontPlane, tangent, normal, 0, 3.37, 0.19), [A1_WALL.spanMeters, 0.15, 0.12], quaternion);

  const jointOffsets = [-28.35, -23.55, -18.82, -14.08, -9.4, -5.05, -2.55, 2.55, 5.05, 9.4, 14.08, 18.82, 23.55, 28.35];
  jointOffsets.forEach((offset, index) => {
    addBox(root, `Terminal4_A1_ExtendedPanelJoint_${index}_V22`, joint, point(frontPlane, tangent, normal, offset, 1.73, 0.21), [0.085, 3.22, 0.055], quaternion);
  });

  const doors = [
    { offset: -23.1, width: 1.28, height: 2.12 },
    { offset: -12.2, width: 1.18, height: 2.04 },
    { offset: 10.9, width: 1.34, height: 2.16 },
    { offset: 22.7, width: 1.10, height: 2.02 },
  ];
  doors.forEach((entry, index) => {
    const center = point(frontPlane, tangent, normal, entry.offset, entry.height / 2 + 0.05, 0.34);
    addBox(root, `Terminal4_A1_ExtendedDoorFrame_${index}_V22`, frame, center, [entry.width + 0.20, entry.height + 0.20, 0.12], quaternion);
    addBox(root, `Terminal4_A1_ExtendedServiceDoor_${index}_V22`, door, center.clone().addScaledVector(normal, 0.08), [entry.width, entry.height, 0.07], quaternion);
    addBox(root, `Terminal4_A1_ExtendedDoorHandle_${index}_V22`, frame, point(frontPlane, tangent, normal, entry.offset + entry.width * 0.32, 1.10, 0.47), [0.055, 0.18, 0.035], quaternion);
  });

  const vents = [
    { offset: -18.2, y: 2.10, width: 1.65, height: 0.48 },
    { offset: -7.7, y: 2.34, width: 1.18, height: 0.42 },
    { offset: 7.4, y: 2.12, width: 1.52, height: 0.48 },
    { offset: 17.8, y: 2.30, width: 1.30, height: 0.42 },
  ];
  vents.forEach((entry, index) => {
    const center = point(frontPlane, tangent, normal, entry.offset, entry.y, 0.35);
    addBox(root, `Terminal4_A1_ExtendedVentFrame_${index}_V22`, frame, center, [entry.width + 0.17, entry.height + 0.15, 0.11], quaternion);
    addBox(root, `Terminal4_A1_ExtendedVent_${index}_V22`, vent, center.clone().addScaledVector(normal, 0.075), [entry.width, entry.height, 0.07], quaternion);
    for (let slat = -0.36; slat <= 0.36; slat += 0.18) {
      addBox(root, `Terminal4_A1_ExtendedVentSlat_${index}_${slat.toFixed(2)}_V22`, frame, center.clone().addScaledVector(tangent, slat * entry.width).addScaledVector(normal, 0.13), [0.028, entry.height * 0.76, 0.025], quaternion);
    }
  });

  const cabinets = [
    { offset: -15.0, width: 0.82, height: 1.44 },
    { offset: -5.3, width: 0.72, height: 1.28 },
    { offset: 5.4, width: 0.78, height: 1.38 },
    { offset: 15.2, width: 0.88, height: 1.50 },
  ];
  cabinets.forEach((entry, index) => {
    const center = point(frontPlane, tangent, normal, entry.offset, entry.height / 2 + 0.22, 0.48);
    addBox(root, `Terminal4_A1_ExtendedUtilityCabinet_${index}_V22`, cabinet, center, [entry.width, entry.height, 0.38], quaternion);
    addBox(root, `Terminal4_A1_ExtendedUtilityCabinetDoor_${index}_V22`, cabinetDoor, center.clone().addScaledVector(normal, 0.22), [entry.width * 0.76, entry.height * 0.78, 0.04], quaternion);
  });

  const pipeRuns = [-20.4, -9.2, 8.9, 20.0];
  pipeRuns.forEach((offset, index) => {
    const start = point(frontPlane, tangent, normal, offset, 0.45, 0.43);
    const end = point(frontPlane, tangent, normal, offset, 3.28, 0.43);
    addTube(root, `Terminal4_A1_ExtendedDownspout_${index}_V22`, conduit, start, end, 0.038);
    for (const y of [1.1, 2.2, 3.05]) {
      addBox(root, `Terminal4_A1_ExtendedDownspoutBracket_${index}_${y}_V22`, frame, point(frontPlane, tangent, normal, offset, y, 0.39), [0.18, 0.10, 0.08], quaternion);
    }
  });

  const lampOffsets = [-25.4, -16.6, -10.3, -4.7, 4.8, 10.1, 16.7, 25.2];
  lampOffsets.forEach((offset, index) => {
    addBox(root, `Terminal4_A1_ExtendedWallLampHousing_${index}_V22`, lampHousing, point(frontPlane, tangent, normal, offset, 2.96, 0.39), [0.48, 0.25, 0.28], quaternion);
    addBox(root, `Terminal4_A1_ExtendedWallLampLens_${index}_V22`, lampLens, point(frontPlane, tangent, normal, offset, 2.94, 0.56), [0.34, 0.13, 0.045], quaternion);
  });

  [-24.2, -21.8, 11.0, 13.0, 21.7, 24.0].forEach((offset, index) => {
    addBox(root, `Terminal4_A1_ExtendedBollard_${index}_V22`, bollard, point(frontPlane, tangent, normal, offset, 0.56, 0.92), [0.19, 1.05, 0.19], quaternion);
    addBox(root, `Terminal4_A1_ExtendedBollardFoot_${index}_V22`, plinth, point(frontPlane, tangent, normal, offset, 0.08, 0.92), [0.46, 0.16, 0.46], quaternion);
  });

  addReadableGateSign(root, frontPlane, tangent, normal, quaternion);

  root.userData.authority = "exact-BGATE1-source-plane-extended-weathered-ramp-facade-v22";
  root.userData.spanMeters = A1_WALL.spanMeters;
  root.userData.facadeBayCount = bays.length;
  root.userData.serviceDoorCount = doors.length;
  root.userData.ventCount = vents.length;
  root.userData.utilityCabinetCount = cabinets.length;
  root.userData.wallLampCount = lampOffsets.length;
  root.userData.readableGateSign = "A1";
  group.add(root);
  group.userData.terminal4A1ExtendedFacadeAuthority = root.userData.authority;
  return root;
}
