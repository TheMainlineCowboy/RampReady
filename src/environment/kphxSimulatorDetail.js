import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

export const KPHX_SIMULATOR_DETAIL_PROFILE = Object.freeze({
  source: "unmlobo-kphx 1.8.1 exact Terminal 4 jetway and stand coordinates",
  airportSource: "TheMainlineCowboy/SkyHarborPhx source-authored Terminal 4 and PHXPhoto.bgl",
  anchorGate: "A1",
  terminal4Jetways: 58,
  localRampTextureResolution: 2048,
  localRampCoverageMeters: Object.freeze([300, 390]),
  detailLevel: "simulator-detail-a1-v1",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function noise(x, y, seed = 0) {
  const value = Math.sin((x + seed * 17.17) * 12.9898 + (y - seed * 8.73) * 78.233) * 43758.5453123;
  return value - Math.floor(value);
}

function makeRampMaps(THREE) {
  const size = KPHX_SIMULATOR_DETAIL_PROFILE.localRampTextureResolution;
  const canvas = document.createElement("canvas");
  const bumpCanvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  bumpCanvas.width = bumpCanvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: false });
  const bump = bumpCanvas.getContext("2d", { alpha: false });

  ctx.fillStyle = "#aaa9a4";
  ctx.fillRect(0, 0, size, size);
  bump.fillStyle = "#888";
  bump.fillRect(0, 0, size, size);

  const image = ctx.createImageData(size, size);
  const bumpImage = bump.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const fine = noise(x * 0.7, y * 0.7, 1);
      const medium = noise(Math.floor(x / 7), Math.floor(y / 7), 2);
      const broad = noise(Math.floor(x / 43), Math.floor(y / 43), 3);
      const shade = Math.round(157 + fine * 15 + medium * 12 + broad * 9);
      const index = (y * size + x) * 4;
      image.data[index] = shade + 3;
      image.data[index + 1] = shade + 2;
      image.data[index + 2] = shade;
      image.data[index + 3] = 255;
      const height = Math.round(105 + fine * 70 + medium * 42);
      bumpImage.data[index] = height;
      bumpImage.data[index + 1] = height;
      bumpImage.data[index + 2] = height;
      bumpImage.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  bump.putImageData(bumpImage, 0, 0);

  // Large, irregular slab joints rather than a repeated square grid.
  const verticals = [0, 171, 354, 548, 731, 925, 1128, 1322, 1516, 1710, 1894, 2048];
  const horizontals = [0, 146, 301, 462, 626, 802, 969, 1140, 1317, 1488, 1667, 1852, 2048];
  ctx.lineCap = "round";
  for (const [positions, vertical] of [[verticals, true], [horizontals, false]]) {
    for (let index = 1; index < positions.length - 1; index += 1) {
      const position = positions[index];
      ctx.strokeStyle = "rgba(43,45,46,0.62)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(position, 0);
        for (let y = 0; y <= size; y += 64) ctx.lineTo(position + (noise(index, y, 5) - 0.5) * 3.5, y);
      } else {
        ctx.moveTo(0, position);
        for (let x = 0; x <= size; x += 64) ctx.lineTo(x, position + (noise(x, index, 7) - 0.5) * 3.5);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(226,225,216,0.28)";
      ctx.lineWidth = 2;
      ctx.stroke();

      bump.strokeStyle = "#252525";
      bump.lineWidth = 5;
      bump.beginPath();
      if (vertical) { bump.moveTo(position, 0); bump.lineTo(position, size); }
      else { bump.moveTo(0, position); bump.lineTo(size, position); }
      bump.stroke();
    }
  }

  // Tire rubber, hydraulic stains, patch repairs and fine cracks.
  for (let index = 0; index < 95; index += 1) {
    const x = noise(index, 2, 9) * size;
    const y = noise(index, 5, 11) * size;
    const rx = 8 + noise(index, 8, 13) * 46;
    const ry = 4 + noise(index, 9, 17) * 22;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, Math.max(rx, ry));
    gradient.addColorStop(0, `rgba(31,34,35,${0.05 + noise(index, 7, 19) * 0.11})`);
    gradient.addColorStop(1, "rgba(31,34,35,0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(rx, ry), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (let index = 0; index < 28; index += 1) {
    const x = noise(index, 13, 23) * size;
    const y = noise(index, 21, 29) * size;
    const w = 38 + noise(index, 34, 31) * 130;
    const h = 22 + noise(index, 55, 37) * 84;
    ctx.fillStyle = `rgba(100,101,98,${0.16 + noise(index, 89, 41) * 0.13})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(58,59,57,0.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  }
  for (let index = 0; index < 160; index += 1) {
    const x = noise(index, 8, 43) * size;
    const y = noise(index, 11, 47) * size;
    const length = 8 + noise(index, 15, 53) * 48;
    const angle = noise(index, 19, 59) * Math.PI * 2;
    ctx.strokeStyle = `rgba(47,49,50,${0.08 + noise(index, 23, 61) * 0.15})`;
    ctx.lineWidth = 0.7 + noise(index, 31, 67) * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  const color = new THREE.CanvasTexture(canvas);
  color.name = "PHX A1 high-resolution ramp albedo";
  color.colorSpace = THREE.SRGBColorSpace;
  color.wrapS = color.wrapT = THREE.ClampToEdgeWrapping;
  color.anisotropy = 12;
  color.minFilter = THREE.LinearMipmapLinearFilter;
  color.magFilter = THREE.LinearFilter;
  color.needsUpdate = true;

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.name = "PHX A1 high-resolution ramp micro-surface";
  bumpTexture.wrapS = bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.anisotropy = 8;
  bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTexture.magFilter = THREE.LinearFilter;
  bumpTexture.needsUpdate = true;
  return { color, bump: bumpTexture };
}

function createChamferedGeometry(THREE, width = 1, height = 1, depth = 1, chamfer = 0.11) {
  const halfW = width / 2;
  const halfH = height / 2;
  const c = Math.min(chamfer, halfW * 0.45, halfH * 0.45);
  const shape = new THREE.Shape();
  shape.moveTo(-halfW + c, -halfH);
  shape.lineTo(halfW - c, -halfH);
  shape.lineTo(halfW, -halfH + c);
  shape.lineTo(halfW, halfH - c);
  shape.lineTo(halfW - c, halfH);
  shape.lineTo(-halfW + c, halfH);
  shape.lineTo(-halfW, halfH - c);
  shape.lineTo(-halfW, -halfH + c);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function canvasPanelTexture(THREE, base = "#c8cbcc", seam = "#777d80") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(255,255,255,0.24)");
  gradient.addColorStop(0.52, "rgba(255,255,255,0)");
  gradient.addColorStop(1, "rgba(34,39,42,0.16)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = seam;
  ctx.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  for (let y = 32; y < canvas.height; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 1);
  texture.anisotropy = 8;
  return texture;
}

function gateTexture(THREE, label) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111820";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#eeb51b";
  ctx.lineWidth = 13;
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  ctx.fillStyle = "#f5f7f8";
  ctx.font = `700 ${label.length > 3 ? 100 : 126}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addInstances(THREE, group, geometry, material, transforms, name, castShadow = true) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  for (let index = 0; index < transforms.length; index += 1) {
    const transform = transforms[index];
    dummy.position.set(...transform.position);
    dummy.rotation.set(transform.pitch || 0, transform.yaw || 0, transform.roll || 0);
    dummy.scale.set(...(transform.scale || [1, 1, 1]));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function computeJetway(jetway, parking, isA1 = false) {
  let dx = jetway.px - jetway.x;
  let dz = jetway.pz - jetway.z;
  let distance = Math.hypot(dx, dz);
  if (distance < 1) {
    const heading = jetway.h * Math.PI / 180;
    dx = Math.sin(heading);
    dz = Math.cos(heading);
    distance = 24;
  }
  const ux = dx / distance;
  const uz = dz / distance;
  const rightX = -uz;
  const rightZ = ux;
  const yaw = Math.atan2(ux, uz);
  const bridgeStart = 2.1;
  const endDistance = clamp(distance - (isA1 ? 4.9 : 5.8), 14.5, 23.5);
  const bridgeLength = Math.max(11, endDistance - bridgeStart);
  const rotundaY = 4.65;
  const cabinY = isA1 ? 3.25 : 3.45;
  const pitch = Math.atan2(rotundaY - cabinY, bridgeLength);
  const firstLength = bridgeLength * 0.59;
  const secondLength = bridgeLength * 0.52;
  const firstCenter = bridgeStart + firstLength / 2;
  const secondCenter = bridgeStart + firstLength + secondLength / 2 - 0.8;
  const firstY = rotundaY - (rotundaY - cabinY) * (firstCenter / bridgeLength);
  const secondY = rotundaY - (rotundaY - cabinY) * (secondCenter / bridgeLength);
  const endX = jetway.x + ux * endDistance;
  const endZ = jetway.z + uz * endDistance;
  return {
    parking,
    ux, uz, rightX, rightZ, yaw, pitch, bridgeLength, firstLength, secondLength,
    firstCenter, secondCenter, firstY, secondY, endDistance, endX, endZ,
    rotundaY, cabinY,
  };
}

function addA1FineDetail(THREE, group, jetway, detail, materials) {
  const { ux, uz, rightX, rightZ, yaw, pitch, bridgeLength, endX, endZ, cabinY, rotundaY } = detail;
  const frame = new THREE.Group();
  frame.name = "KPHX_A1_Jetway_FineDetail";
  frame.position.y = 0;
  group.add(frame);

  // Structural ribs and telescoping guide tracks.
  const ribMaterial = materials.darkMetal;
  const ribCount = Math.max(8, Math.floor(bridgeLength / 1.35));
  for (let index = 1; index < ribCount; index += 1) {
    const t = index / ribCount;
    const distance = 2.1 + bridgeLength * t;
    const y = rotundaY - (rotundaY - cabinY) * t;
    const rib = new THREE.Mesh(createChamferedGeometry(THREE, 2.86, 2.58, 0.055, 0.18), ribMaterial);
    rib.position.set(jetway.x + ux * distance, y, jetway.z + uz * distance);
    rib.rotation.set(pitch, yaw, 0);
    rib.castShadow = true;
    frame.add(rib);
  }
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, bridgeLength * 0.91), materials.darkMetal);
    rail.position.set(
      jetway.x + ux * (2.1 + bridgeLength * 0.5) + rightX * side * 1.27,
      rotundaY - (rotundaY - cabinY) * 0.5 - 1.13,
      jetway.z + uz * (2.1 + bridgeLength * 0.5) + rightZ * side * 1.27,
    );
    rail.rotation.set(pitch, yaw, 0);
    rail.castShadow = true;
    frame.add(rail);
  }

  // Windows along both sides, with mullions and interior darkness.
  const windowCount = Math.max(6, Math.floor(bridgeLength / 1.7));
  for (const side of [-1, 1]) {
    for (let index = 0; index < windowCount; index += 1) {
      const t = (index + 0.5) / windowCount;
      const distance = 2.5 + bridgeLength * 0.82 * t;
      const y = rotundaY - (rotundaY - cabinY) * t + 0.24;
      const window = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.72), materials.glass);
      window.position.set(
        jetway.x + ux * distance + rightX * side * 1.38,
        y,
        jetway.z + uz * distance + rightZ * side * 1.38,
      );
      window.rotation.y = yaw + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      window.rotation.z = side > 0 ? -pitch : pitch;
      window.castShadow = false;
      frame.add(window);
    }
  }

  // Cabin windshield, door collar bellows and side access door.
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.92), materials.glassDark);
  windshield.position.set(endX + ux * 1.51, cabinY + 0.42, endZ + uz * 1.51);
  windshield.rotation.y = yaw;
  frame.add(windshield);
  for (let index = 0; index < 7; index += 1) {
    const bellow = new THREE.Mesh(createChamferedGeometry(THREE, 2.28 - index * 0.045, 1.92 - index * 0.035, 0.085, 0.20), materials.rubber);
    bellow.position.set(endX + ux * (1.52 + index * 0.09), cabinY, endZ + uz * (1.52 + index * 0.09));
    bellow.rotation.y = yaw;
    frame.add(bellow);
  }
  const accessDoor = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.46), materials.door);
  accessDoor.position.set(endX + rightX * 1.61, cabinY - 0.16, endZ + rightZ * 1.61);
  accessDoor.rotation.y = yaw - Math.PI / 2;
  frame.add(accessDoor);

  // Realistic dual-wheel bogie and hydraulic lift assembly.
  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.18, 20);
  for (const side of [-1, 1]) {
    for (const longitudinal of [-0.42, 0.42]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.tire);
      wheel.position.set(
        endX - ux * 1.04 + rightX * side * 0.83 + ux * longitudinal,
        0.34,
        endZ - uz * 1.04 + rightZ * side * 0.83 + uz * longitudinal,
      );
      wheel.rotation.set(Math.PI / 2, yaw, 0);
      wheel.castShadow = true;
      frame.add(wheel);
    }
  }
  for (const side of [-1, 1]) {
    const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, cabinY - 0.65, 16), materials.hydraulic);
    cylinder.position.set(endX - ux * 1.1 + rightX * side * 0.72, (cabinY - 0.35) / 2, endZ - uz * 1.1 + rightZ * side * 0.72);
    cylinder.castShadow = true;
    frame.add(cylinder);
  }

  // PCA duct and 400 Hz cable are visible operational details at ramp level.
  const hoseCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(endX + rightX * 1.1, cabinY - 0.85, endZ + rightZ * 1.1),
    new THREE.Vector3(endX + rightX * 1.7 - ux * 0.8, 1.55, endZ + rightZ * 1.7 - uz * 0.8),
    new THREE.Vector3(endX + rightX * 2.1 - ux * 1.8, 0.42, endZ + rightZ * 2.1 - uz * 1.8),
    new THREE.Vector3(endX + rightX * 2.3 - ux * 3.0, 0.25, endZ + rightZ * 2.3 - uz * 3.0),
  ]);
  const hose = new THREE.Mesh(new THREE.TubeGeometry(hoseCurve, 32, 0.16, 12, false), materials.hose);
  hose.castShadow = true;
  frame.add(hose);
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(endX - rightX * 1.0, cabinY - 0.95, endZ - rightZ * 1.0),
    new THREE.Vector3(endX - rightX * 1.45 - ux * 0.7, 1.2, endZ - rightZ * 1.45 - uz * 0.7),
    new THREE.Vector3(endX - rightX * 1.7 - ux * 2.0, 0.18, endZ - rightZ * 1.7 - uz * 2.0),
  ]);
  frame.add(new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 24, 0.035, 8, false), materials.cable));

  // A1 gate equipment cabinet, bollards and stairs/handrails.
  const cabinet = new THREE.Mesh(createChamferedGeometry(THREE, 1.25, 1.62, 0.72, 0.08), materials.cabinet);
  cabinet.position.set(jetway.x + rightX * 3.9 - ux * 1.5, 0.82, jetway.z + rightZ * 3.9 - uz * 1.5);
  cabinet.rotation.y = yaw;
  cabinet.castShadow = true;
  frame.add(cabinet);
  for (const side of [-1, 1]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.05, 16), materials.yellow);
    bollard.position.set(jetway.x + rightX * (3.2 + side * 0.68) - ux * 1.0, 0.525, jetway.z + rightZ * (3.2 + side * 0.68) - uz * 1.0);
    bollard.castShadow = true;
    frame.add(bollard);
  }
  const stairGroup = new THREE.Group();
  stairGroup.position.set(endX - rightX * 2.35 - ux * 0.35, 0, endZ - rightZ * 2.35 - uz * 0.35);
  stairGroup.rotation.y = yaw;
  frame.add(stairGroup);
  for (let step = 0; step < 8; step += 1) {
    const tread = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.12, 0.34), materials.galvanized);
    tread.position.set(0, 0.13 + step * 0.31, -step * 0.30);
    tread.castShadow = true;
    stairGroup.add(tread);
  }
  for (const side of [-0.55, 0.55]) {
    const railCurve = new THREE.LineCurve3(new THREE.Vector3(side, 0.45, 0.2), new THREE.Vector3(side, 2.85, -2.25));
    stairGroup.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 12, 0.035, 8, false), materials.galvanized));
  }

  frame.userData.a1FineDetailMeshes = frame.children.length;
}

export function buildKphxSimulatorDetail(THREE) {
  const parkings = [...concourseA.parkings, ...concourseB.parkings];
  const jetways = [...concourseA.jetways, ...concourseB.jetways];
  const parkingByGate = new Map(parkings.map((parking) => [parking.g, parking]));
  const group = new THREE.Group();
  group.name = "PHX_KPHX_SimulatorDetail";
  group.position.set(0, 0, 6.2);

  const rampMaps = makeRampMaps(THREE);
  const rampMaterial = new THREE.MeshStandardMaterial({
    map: rampMaps.color,
    bumpMap: rampMaps.bump,
    bumpScale: 0.055,
    color: 0xffffff,
    roughness: 0.96,
    metalness: 0,
  });
  const ramp = new THREE.Mesh(
    new THREE.PlaneGeometry(...KPHX_SIMULATOR_DETAIL_PROFILE.localRampCoverageMeters, 1, 1),
    rampMaterial,
  );
  ramp.name = "KPHX_A1_HighResolutionRampSurface";
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.set(0, -0.010, 48);
  ramp.receiveShadow = true;
  ramp.renderOrder = -12;
  group.add(ramp);

  const shellTexture = canvasPanelTexture(THREE);
  const shell = new THREE.MeshStandardMaterial({ map: shellTexture, color: 0xffffff, roughness: 0.48, metalness: 0.26 });
  const shellDark = new THREE.MeshStandardMaterial({ map: canvasPanelTexture(THREE, "#9ca3a6", "#62686b"), color: 0xffffff, roughness: 0.54, metalness: 0.34 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x434a4e, roughness: 0.40, metalness: 0.72 });
  const galvanized = new THREE.MeshStandardMaterial({ color: 0x9fa7aa, roughness: 0.43, metalness: 0.63 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x446e82, roughness: 0.12, metalness: 0.04, transparent: true, opacity: 0.72, transmission: 0.08, depthWrite: false });
  const glassDark = new THREE.MeshPhysicalMaterial({ color: 0x183b4a, roughness: 0.10, metalness: 0.05, transparent: true, opacity: 0.84, depthWrite: false });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1f2224, roughness: 0.88, metalness: 0.02 });
  const tire = new THREE.MeshStandardMaterial({ color: 0x17191a, roughness: 0.94, metalness: 0.01 });
  const hydraulic = new THREE.MeshStandardMaterial({ color: 0x6d7476, roughness: 0.34, metalness: 0.80 });
  const hose = new THREE.MeshStandardMaterial({ color: 0x2e3335, roughness: 0.88, metalness: 0.02 });
  const cable = new THREE.MeshStandardMaterial({ color: 0xe0a300, roughness: 0.72, metalness: 0.06 });
  const cabinet = new THREE.MeshStandardMaterial({ color: 0xd8d5c9, roughness: 0.64, metalness: 0.28 });
  const door = new THREE.MeshStandardMaterial({ color: 0x9ca3a5, roughness: 0.52, metalness: 0.42 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.60, metalness: 0.10 });

  const transforms = {
    rotunda: [], outer: [], inner: [], cabin: [], collar: [], support: [], bogie: [], wheels: [],
  };
  let a1Detail = null;
  for (const jetway of jetways) {
    const parking = parkingByGate.get(jetway.g);
    const detail = computeJetway(jetway, parking, jetway.g === "A1");
    const {
      ux, uz, rightX, rightZ, yaw, pitch, firstLength, secondLength,
      firstCenter, secondCenter, firstY, secondY, endX, endZ, cabinY, rotundaY,
    } = detail;
    transforms.rotunda.push({ position: [jetway.x, rotundaY, jetway.z], yaw, scale: [1.55, 2.75, 1.55] });
    transforms.outer.push({ position: [jetway.x + ux * firstCenter, firstY, jetway.z + uz * firstCenter], yaw, pitch, scale: [1, 1, firstLength] });
    transforms.inner.push({ position: [jetway.x + ux * secondCenter, secondY, jetway.z + uz * secondCenter], yaw, pitch, scale: [0.91, 0.90, secondLength] });
    transforms.cabin.push({ position: [endX, cabinY, endZ], yaw, scale: [1, 1, 1] });
    transforms.collar.push({ position: [endX + ux * 1.62, cabinY, endZ + uz * 1.62], yaw, scale: [1, 1, 0.22] });
    transforms.support.push({ position: [endX - ux * 1.0, cabinY * 0.5 - 0.1, endZ - uz * 1.0], scale: [0.22, Math.max(1.8, cabinY - 0.45), 0.22] });
    transforms.bogie.push({ position: [endX - ux * 1.0, 0.56, endZ - uz * 1.0], yaw, scale: [2.25, 0.45, 1.10] });
    for (const side of [-1, 1]) {
      transforms.wheels.push({ position: [endX - ux * 1.0 + rightX * side * 0.86, 0.34, endZ - uz * 1.0 + rightZ * side * 0.86], yaw, pitch: Math.PI / 2, scale: [1, 1, 1] });
    }

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(jetway.g === "A1" ? 3.15 : 2.3, jetway.g === "A1" ? 1.35 : 0.98),
      new THREE.MeshBasicMaterial({ map: gateTexture(THREE, jetway.g), transparent: true, side: THREE.DoubleSide }),
    );
    sign.name = `KPHX_GateSign_${jetway.g}`;
    sign.position.set(jetway.x - ux * 2.25, 6.1, jetway.z - uz * 2.25);
    sign.rotation.y = yaw;
    group.add(sign);

    if (jetway.g === "A1") a1Detail = { jetway, detail };
  }

  addInstances(THREE, group, new THREE.CylinderGeometry(1, 1, 1, 24), shellDark, transforms.rotunda, "KPHX_T4_JetwayRotundas");
  addInstances(THREE, group, createChamferedGeometry(THREE, 2.78, 2.48, 1, 0.20), shell, transforms.outer, "KPHX_T4_JetwayOuterTunnels");
  addInstances(THREE, group, createChamferedGeometry(THREE, 2.54, 2.27, 1, 0.18), shellDark, transforms.inner, "KPHX_T4_JetwayInnerTunnels");
  addInstances(THREE, group, createChamferedGeometry(THREE, 3.18, 2.72, 2.9, 0.30), shell, transforms.cabin, "KPHX_T4_JetwayCabins");
  addInstances(THREE, group, createChamferedGeometry(THREE, 2.35, 1.98, 1, 0.25), rubber, transforms.collar, "KPHX_T4_JetwayDoorCollars");
  addInstances(THREE, group, new THREE.BoxGeometry(1, 1, 1), hydraulic, transforms.support, "KPHX_T4_JetwayLiftColumns");
  addInstances(THREE, group, createChamferedGeometry(THREE, 1, 1, 1, 0.10), darkMetal, transforms.bogie, "KPHX_T4_JetwayBogies");
  addInstances(THREE, group, new THREE.CylinderGeometry(0.31, 0.31, 0.20, 18), tire, transforms.wheels, "KPHX_T4_JetwayWheels");

  if (a1Detail) addA1FineDetail(THREE, group, a1Detail.jetway, a1Detail.detail, {
    darkMetal, galvanized, glass, glassDark, rubber, tire, hydraulic, hose, cable, cabinet, door, yellow,
  });

  // Tall apron light poles and real ramp-scale fixtures increase depth cues.
  const lightLocations = [
    [-68, -58], [22, -63], [103, -62], [181, -59],
    [-55, -185], [39, -189], [125, -190], [205, -183],
  ];
  for (const [x, z] of lightLocations) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.20, 19, 18), galvanized);
    pole.position.set(x, 9.5, z);
    pole.castShadow = true;
    group.add(pole);
    const head = new THREE.Mesh(createChamferedGeometry(THREE, 2.7, 0.42, 0.72, 0.08), darkMetal);
    head.position.set(x, 19.15, z);
    group.add(head);
    for (const side of [-0.75, 0, 0.75]) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), new THREE.MeshBasicMaterial({ color: 0xfff4d0, side: THREE.DoubleSide }));
      lamp.position.set(x + side, 19.05, z - 0.38);
      lamp.rotation.x = -0.18;
      group.add(lamp);
    }
  }

  group.userData.environmentSource = "kphx-simulator-detail";
  group.userData.detailLevel = KPHX_SIMULATOR_DETAIL_PROFILE.detailLevel;
  group.userData.jetwayCount = jetways.length;
  group.userData.a1FineDetailMeshes = group.getObjectByName("KPHX_A1_Jetway_FineDetail")?.userData.a1FineDetailMeshes || 0;
  group.userData.rampTextureResolution = KPHX_SIMULATOR_DETAIL_PROFILE.localRampTextureResolution;
  group.userData.rampCoverageMeters = KPHX_SIMULATOR_DETAIL_PROFILE.localRampCoverageMeters;
  return group;
}
