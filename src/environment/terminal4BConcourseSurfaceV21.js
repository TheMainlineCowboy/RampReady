import * as THREE from "three";

function seededNoise(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
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
  return texture;
}

function makeFacadeTexture(base, joint, stain, seed) {
  return canvasTexture(1024, 1024, (context, width, height) => {
    const random = seededNoise(seed);
    context.fillStyle = base;
    context.fillRect(0, 0, width, height);

    const vertical = context.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, "rgba(255,255,255,0.10)");
    vertical.addColorStop(0.48, "rgba(255,255,255,0.01)");
    vertical.addColorStop(1, "rgba(50,42,35,0.16)");
    context.fillStyle = vertical;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = joint;
    context.lineWidth = 5;
    for (let x = 0; x <= width; x += 256) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      context.strokeStyle = "rgba(255,255,255,0.18)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 6, 0);
      context.lineTo(x + 6, height);
      context.stroke();
      context.strokeStyle = joint;
      context.lineWidth = 5;
    }
    for (const y of [330, 670]) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    for (let index = 0; index < 190; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 5 + random() * 34;
      const alpha = 0.008 + random() * 0.034;
      context.fillStyle = `${stain}${alpha.toFixed(3)})`;
      context.beginPath();
      context.ellipse(x, y, radius * 1.8, radius, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "rgba(62,56,49,0.16)";
    for (let x = 28; x < width; x += 128) {
      const drip = 18 + random() * 95;
      context.fillRect(x, 0, 3 + random() * 4, drip);
    }

    const lower = context.createLinearGradient(0, height * 0.72, 0, height);
    lower.addColorStop(0, "rgba(72,66,59,0)");
    lower.addColorStop(1, "rgba(72,66,59,0.28)");
    context.fillStyle = lower;
    context.fillRect(0, height * 0.72, width, height * 0.28);
  });
}

function makeFacadeBump(seed) {
  return canvasTexture(1024, 1024, (context, width, height) => {
    const random = seededNoise(seed);
    context.fillStyle = "rgb(140,140,140)";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgb(42,42,42)";
    context.lineWidth = 8;
    for (let x = 0; x <= width; x += 256) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (const y of [330, 670]) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    for (let index = 0; index < 260; index += 1) {
      const shade = 118 + Math.floor(random() * 40);
      context.fillStyle = `rgb(${shade},${shade},${shade})`;
      const size = 2 + random() * 10;
      context.fillRect(random() * width, random() * height, size, size);
    }
  });
}

function makeGateSignTexture(gate) {
  return canvasTexture(768, 384, (context, width, height) => {
    context.fillStyle = "#121b22";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#d6dde1";
    context.lineWidth = 18;
    context.strokeRect(12, 12, width - 24, height - 24);
    context.fillStyle = "#f6f8f9";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 58px Arial, sans-serif";
    context.fillText("GATE", width / 2, 72);
    context.font = "800 190px Arial, sans-serif";
    context.fillText(gate, width / 2, 238);
  });
}

function makeWarningStripeTexture() {
  return canvasTexture(512, 128, (context, width, height) => {
    context.fillStyle = "#e9e2d4";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#c6232f";
    for (let x = -height; x < width + height; x += 120) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 62, 0);
      context.lineTo(x + height + 62, height);
      context.lineTo(x + height, height);
      context.closePath();
      context.fill();
    }
  });
}

function addBox(parent, name, material, position, size, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, name, material, start, end, radius = 0.035) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const delta = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 16), material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function applyFacadeMaterial(mesh, map, bumpMap, repeat) {
  const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const material = source.clone();
  material.name = `${source.name || mesh.name} textured surface v21`;
  material.map = map.clone();
  material.map.wrapS = THREE.RepeatWrapping;
  material.map.wrapT = THREE.RepeatWrapping;
  material.map.repeat.set(...repeat);
  material.map.needsUpdate = true;
  material.bumpMap = bumpMap.clone();
  material.bumpMap.wrapS = THREE.RepeatWrapping;
  material.bumpMap.wrapT = THREE.RepeatWrapping;
  material.bumpMap.repeat.set(...repeat);
  material.bumpMap.needsUpdate = true;
  material.bumpScale = 0.035;
  material.color.setHex(0xffffff);
  material.roughness = 0.9;
  material.metalness = 0.01;
  material.needsUpdate = true;
  mesh.material = material;
}

function addGateSign(root, gate, x, z) {
  const texture = makeGateSignTexture(gate);
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.02, 0.58), material);
  sign.name = `Terminal4_${gate}_ReadableGateSign_V21`;
  sign.position.set(x + 1.42, 5.18, z - 1.52);
  sign.rotation.y = Math.PI / 2;
  root.add(sign);

  const housing = new THREE.MeshStandardMaterial({ color: 0x30383c, roughness: 0.55, metalness: 0.42 });
  addBox(root, `Terminal4_${gate}_ReadableGateSignHousing_V21`, housing, [x + 1.38, 5.18, z - 1.52], [0.12, 0.70, 1.15]);
  sign.position.x = x + 1.455;
}

export function installTerminal4BConcourseSurfaceV21(root, bounds) {
  if (!root?.isGroup) throw new Error("Terminal 4 B-concourse surface pass requires the rebuilt pier group");
  const existing = root.getObjectByName("Terminal4_BConcourse_SurfaceDetail_V21");
  if (existing) return existing;

  const detail = new THREE.Group();
  detail.name = "Terminal4_BConcourse_SurfaceDetail_V21";

  const lowerTexture = makeFacadeTexture("#b9aa96", "rgba(82,73,64,0.50)", "rgba(55,45,38,", 2117);
  const upperTexture = makeFacadeTexture("#d1c4b2", "rgba(95,85,74,0.42)", "rgba(65,54,44,", 3129);
  const lowerBump = makeFacadeBump(4111);
  const upperBump = makeFacadeBump(5113);

  root.traverse((node) => {
    if (!node.isMesh) return;
    if (["Terminal4_BConcourse_MainLowerVolume", "Terminal4_B15Pier_LowerVolume"].includes(node.name)) {
      const repeat = node.name.includes("Main") ? [20, 2] : [3, 18];
      applyFacadeMaterial(node, lowerTexture, lowerBump, repeat);
    } else if (["Terminal4_BConcourse_MainUpperVolume", "Terminal4_B15Pier_UpperVolume"].includes(node.name)) {
      const repeat = node.name.includes("Main") ? [20, 1] : [3, 18];
      applyFacadeMaterial(node, upperTexture, upperBump, repeat);
    } else if (node.name.includes("_Relief_") || node.name.includes("VestibuleSide")) {
      applyFacadeMaterial(node, lowerTexture, lowerBump, [2, 1]);
    }
  });

  const { b15XMax, mainXMin, mainXMax, mainZMin, mainZMax } = bounds;
  addGateSign(detail, "B15L", b15XMax, 527.23);
  addGateSign(detail, "B15M", b15XMax, 551.03);

  const pipe = new THREE.MeshStandardMaterial({ color: 0x626c70, roughness: 0.54, metalness: 0.5 });
  const bracket = new THREE.MeshStandardMaterial({ color: 0x3f474a, roughness: 0.62, metalness: 0.42 });
  const cabinet = new THREE.MeshStandardMaterial({ color: 0xb6afa3, roughness: 0.76, metalness: 0.12 });
  const cabinetDoor = new THREE.MeshStandardMaterial({ color: 0x687174, roughness: 0.62, metalness: 0.38 });
  const lampHousing = new THREE.MeshStandardMaterial({ color: 0x30383c, roughness: 0.52, metalness: 0.46 });
  const lampLens = new THREE.MeshStandardMaterial({
    color: 0xffe2ad,
    emissive: 0xffb35a,
    emissiveIntensity: 0.75,
    roughness: 0.32,
    metalness: 0.02,
  });

  for (const z of [503, 516, 539, 563]) {
    addTube(detail, `Terminal4_B15_Downspout_${z}_V21`, pipe, [b15XMax + 0.36, 0.45, z], [b15XMax + 0.36, 6.85, z], 0.045);
    for (const y of [1.2, 3.4, 5.6]) {
      addBox(detail, `Terminal4_B15_DownspoutBracket_${z}_${y}_V21`, bracket, [b15XMax + 0.30, y, z], [0.10, 0.12, 0.20]);
    }
  }

  addTube(detail, "Terminal4_B15_UtilityConduitHorizontal_V21", pipe, [b15XMax + 0.38, 1.85, 511], [b15XMax + 0.38, 1.85, 566], 0.026);
  for (const z of [519.5, 543.5, 560.5]) {
    addTube(detail, `Terminal4_B15_UtilityConduitDrop_${z}_V21`, pipe, [b15XMax + 0.38, 0.65, z], [b15XMax + 0.38, 1.85, z], 0.026);
  }

  for (const [name, z] of [["L", 518.6], ["M", 542.7], ["North", 560.8]]) {
    addBox(detail, `Terminal4_B15_UtilityCabinet_${name}_V21`, cabinet, [b15XMax + 0.46, 1.02, z], [0.72, 1.62, 0.86]);
    addBox(detail, `Terminal4_B15_UtilityCabinetDoor_${name}_V21`, cabinetDoor, [b15XMax + 0.84, 1.02, z], [0.04, 1.36, 0.68]);
    addBox(detail, `Terminal4_B15_UtilityCabinetHandle_${name}_V21`, bracket, [b15XMax + 0.87, 1.02, z - 0.23], [0.04, 0.18, 0.035]);
  }

  for (const [gate, z] of [["B15L", 527.23], ["B15M", 551.03]]) {
    addBox(detail, `Terminal4_${gate}_PortalLampHousing_V21`, lampHousing, [b15XMax + 1.42, 6.08, z], [0.22, 0.30, 0.66]);
    addBox(detail, `Terminal4_${gate}_PortalLampLens_V21`, lampLens, [b15XMax + 1.55, 6.06, z], [0.055, 0.19, 0.48]);
  }

  const stripeTexture = makeWarningStripeTexture();
  stripeTexture.repeat.set(2, 1);
  const stripeMaterial = new THREE.MeshStandardMaterial({ map: stripeTexture, roughness: 0.72, metalness: 0.06 });
  for (const z of [527.23, 551.03]) {
    addBox(detail, `Terminal4_B15_PortalCollisionStripe_${z}_V21`, stripeMaterial, [b15XMax + 1.28, 2.82, z], [0.16, 0.26, 3.95]);
  }

  const serviceLocations = [
    [mainXMin + 18, mainZMin - 0.34],
    [mainXMin + 79, mainZMax + 0.34],
    [mainXMin + 156, mainZMin - 0.34],
    [mainXMax - 24, mainZMax + 0.34],
  ];
  serviceLocations.forEach(([x, z], index) => {
    addBox(detail, `Terminal4_BConcourse_ServiceBox_${index}_V21`, cabinet, [x, 1.1, z], [1.05, 1.72, 0.45]);
    addBox(detail, `Terminal4_BConcourse_ServiceBoxDoor_${index}_V21`, cabinetDoor, [x, 1.1, z + Math.sign(z - (mainZMin + mainZMax) / 2) * 0.24], [0.88, 1.46, 0.035]);
    addBox(detail, `Terminal4_BConcourse_WallLampHousing_${index}_V21`, lampHousing, [x, 2.72, z], [0.56, 0.26, 0.28]);
  });

  detail.userData.authority = "textured-weathered-B-concourse-readable-gate-signs-utilities-v21";
  detail.userData.readableGateSigns = Object.freeze(["B15L", "B15M"]);
  detail.userData.downspoutCount = 4;
  detail.userData.utilityCabinetCount = 3;
  detail.userData.surfaceTextureMode = "procedural-weathered-panel-map-and-bump";
  root.add(detail);
  return detail;
}
