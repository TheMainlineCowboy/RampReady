import concourseA from "./kphxV181/concourseA.js";
import concourseB from "./kphxV181/concourseB.js";

export const KPHX_V181_PROFILE = Object.freeze({
  packageVersion: "1.8.1",
  sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip",
  anchorGate: "A1",
  sourceJetwayCount: 112,
  terminal4JetwayCount: 58,
  terminal4ParkingCount: 58,
  b15Gates: Object.freeze(["B15L", "B15M"]),
  sourceHeadingDegrees: 270.4908752441406,
  sceneOffset: Object.freeze([0, 0, 6.2]),
  detailLevel: "terminal4-refined-v2",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function seededNoise(x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makeConcreteTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#a5a7a5";
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 4) {
    for (let x = 0; x < 512; x += 4) {
      const shade = 145 + Math.floor(seededNoise(x, y) * 30);
      ctx.fillStyle = `rgba(${shade},${shade},${shade - 2},0.24)`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(54,58,61,0.5)";
  for (const p of [0, 128, 256, 384, 512]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(224,224,215,0.28)";
  for (const p of [64, 192, 320, 448]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
  }

  for (let i = 0; i < 44; i += 1) {
    const x = (i * 149) % 512;
    const y = (i * 233) % 512;
    const rx = 8 + (i % 7) * 5;
    const ry = 3 + (i % 5) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((i % 9) * 0.24);
    const gradient = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
    gradient.addColorStop(0, "rgba(28,31,33,0.20)");
    gradient.addColorStop(1, "rgba(28,31,33,0)");
    ctx.fillStyle = gradient;
    ctx.scale(1, ry / rx);
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  for (let i = 0; i < 12; i += 1) {
    const x = 36 + (i * 83) % 448;
    const y = 40 + (i * 137) % 432;
    ctx.strokeStyle = "rgba(48,51,53,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 34, y);
    ctx.bezierCurveTo(x - 8, y - 10, x + 10, y + 8, x + 38, y - 4);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 26);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePanelTexture(THREE, base, seam, grime) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = seam;
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 96) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,255,255,0.12)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0)");
  gradient.addColorStop(1, grime);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1.5);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function gateTexture(THREE, label) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 112;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111923";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#f5bd1f";
  ctx.lineWidth = 7;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = "#f4f7fa";
  ctx.font = `700 ${label.length > 3 ? 50 : 62}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addInstances(THREE, group, geometry, material, transforms, name, shadows = true) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  transforms.forEach((entry, index) => {
    dummy.position.set(...entry.position);
    dummy.rotation.set(entry.pitch || 0, entry.yaw || 0, entry.roll || 0);
    dummy.scale.set(...entry.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addTerminalConnectors(THREE, group, jetways, material) {
  const transforms = [];
  const used = new Set();
  for (let i = 0; i < jetways.length; i += 1) {
    let nearest = -1;
    let nearestDistance = Infinity;
    for (let j = 0; j < jetways.length; j += 1) {
      if (i === j || jetways[i].l !== jetways[j].l) continue;
      const distance = Math.hypot(jetways[j].x - jetways[i].x, jetways[j].z - jetways[i].z);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = j; }
    }
    if (nearest < 0 || nearestDistance > 58) continue;
    const key = [i, nearest].sort((a, b) => a - b).join(":");
    if (used.has(key)) continue;
    used.add(key);
    const a = jetways[i]; const b = jetways[nearest];
    const dx = b.x - a.x; const dz = b.z - a.z;
    transforms.push({
      position: [(a.x + b.x) / 2, 5.2, (a.z + b.z) / 2],
      yaw: Math.atan2(dx, dz),
      scale: [13.2, 8.2, Math.max(5, nearestDistance + 3)],
    });
  }
  return addInstances(THREE, group, new THREE.BoxGeometry(1, 1, 1), material, transforms, "KPHX_Terminal4_ConnectedConcourse");
}

export function buildKphxV181Terminal4(THREE) {
  const data = {
    parkings: [...concourseA.parkings, ...concourseB.parkings],
    jetways: [...concourseA.jetways, ...concourseB.jetways],
  };
  const parkingByGate = new Map(data.parkings.map((parking) => [parking.g, parking]));
  const group = new THREE.Group();
  group.name = "PHX_KPHX_v181_Terminal4_Detail";
  group.position.fromArray(KPHX_V181_PROFILE.sceneOffset);
  group.rotation.y = THREE.MathUtils.degToRad(180 - KPHX_V181_PROFILE.sourceHeadingDegrees);

  const concrete = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(THREE), color: 0xd1d1cc, roughness: 0.98, metalness: 0 });
  const wallTexture = makePanelTexture(THREE, "#9b8975", "rgba(70,59,49,0.42)", "rgba(45,38,33,0.24)");
  const shellTexture = makePanelTexture(THREE, "#bfc3c4", "rgba(69,74,77,0.34)", "rgba(45,48,50,0.18)");
  const warmWall = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xb09a82, roughness: 0.82, metalness: 0.02 });
  const lowerWall = new THREE.MeshStandardMaterial({ color: 0x75685b, roughness: 0.9, metalness: 0.01 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x29475a, roughness: 0.16, metalness: 0.12, transparent: true, opacity: 0.78 });
  const jetShell = new THREE.MeshStandardMaterial({ map: shellTexture, color: 0xd0d3d2, roughness: 0.58, metalness: 0.18 });
  const jetShellDark = new THREE.MeshStandardMaterial({ color: 0x8f9598, roughness: 0.62, metalness: 0.28 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x3f464b, roughness: 0.46, metalness: 0.58 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x6e6963, roughness: 0.88, metalness: 0.04 });
  const yellow = new THREE.MeshBasicMaterial({ color: 0xffc400 });
  const red = new THREE.MeshBasicMaterial({ color: 0xc12721 });
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f0e8 });

  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(590, 1080), concrete);
  ramp.name = "KPHX_v181_Terminal4_TexturedRamp";
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.set(75, 0.018, 100);
  ramp.receiveShadow = true;
  group.add(ramp);

  const transforms = {
    lower: [], upper: [], roof: [], roofUnits: [], glass: [], rotunda: [],
    bridgeOuter: [], bridgeInner: [], bridgeGlass: [], cabin: [], supports: [],
    wheelBogie: [], lines: [], stops: [], safety: [],
  };

  for (const parking of data.parkings) {
    const heading = THREE.MathUtils.degToRad(parking.h);
    const dx = Math.sin(heading); const dz = Math.cos(heading);
    transforms.lines.push({ position: [parking.x + dx * 18, 0.055, parking.z + dz * 18], yaw: heading, scale: [0.16, 0.035, 36] });
    transforms.stops.push({ position: [parking.x, 0.064, parking.z], yaw: heading, scale: [5.2, 0.04, 0.24] });
    transforms.safety.push({ position: [parking.x - dx * 5, 0.058, parking.z - dz * 5], yaw: heading, scale: [6.8, 0.028, 0.14] });
  }

  for (const jetway of data.jetways) {
    const parking = parkingByGate.get(jetway.g);
    const parkingHeading = THREE.MathUtils.degToRad(parking?.h ?? jetway.h);
    const parkingDx = Math.sin(parkingHeading);
    const parkingDz = Math.cos(parkingHeading);
    let dx = jetway.px - jetway.x; let dz = jetway.pz - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 1) {
      const heading = THREE.MathUtils.degToRad(jetway.h);
      dx = Math.sin(heading); dz = Math.cos(heading); distance = 22;
    }
    const ux = dx / distance; const uz = dz / distance;
    const px = -uz; const pz = ux;
    const yaw = Math.atan2(ux, uz);
    const doorInset = jetway.g === "A1" ? 8.5 : 6.8;
    const usableDistance = Math.max(10, distance - doorInset);
    const bridgeLength = clamp(usableDistance - 5.5, 7, 18.5);
    const baseX = jetway.x - ux * 4.4; const baseZ = jetway.z - uz * 4.4;

    transforms.lower.push({ position: [baseX, 2.35, baseZ], yaw, scale: [17.5, 4.7, 8.5] });
    transforms.upper.push({ position: [baseX, 6.15, baseZ], yaw, scale: [16.8, 3.7, 8] });
    transforms.roof.push({ position: [baseX, 8.25, baseZ], yaw, scale: [18, 0.35, 9] });
    transforms.roofUnits.push({ position: [baseX + px * 3.6, 8.75, baseZ + pz * 3.6], yaw, scale: [3.2, 0.8, 2.4] });
    transforms.glass.push({ position: [jetway.x - ux * 0.9, 6.1, jetway.z - uz * 0.9], yaw, scale: [13.6, 1.75, 0.24] });
    transforms.rotunda.push({ position: [jetway.x, 4.75, jetway.z], yaw, scale: [2.4, 3.2, 2.4] });

    const halfLength = bridgeLength / 2;
    const firstLength = halfLength + 0.7;
    const secondLength = halfLength + 0.7;
    const firstCenter = 2.2 + firstLength / 2;
    const secondCenter = 2.2 + firstLength + secondLength / 2 - 0.7;
    transforms.bridgeOuter.push({ position: [jetway.x + ux * firstCenter, 4.85, jetway.z + uz * firstCenter], yaw, scale: [2.85, 2.65, firstLength] });
    transforms.bridgeInner.push({ position: [jetway.x + ux * secondCenter, 4.72, jetway.z + uz * secondCenter], yaw, scale: [2.58, 2.42, secondLength] });
    transforms.bridgeGlass.push({ position: [jetway.x + ux * (2.2 + bridgeLength / 2) + px * 1.42, 4.95, jetway.z + uz * (2.2 + bridgeLength / 2) + pz * 1.42], yaw, scale: [0.12, 1.06, bridgeLength * 0.88] });

    const endDistance = Math.min(usableDistance, 2.2 + bridgeLength + 0.4);
    const endx = jetway.x + ux * endDistance; const endz = jetway.z + uz * endDistance;
    transforms.cabin.push({ position: [endx, 4.25, endz], yaw, scale: [3.45, 3.05, 3.2] });
    transforms.supports.push({ position: [jetway.x, 2.15, jetway.z], yaw: 0, scale: [0.3, 4.3, 0.3] });
    transforms.supports.push({ position: [endx - ux * 1.2, 1.65, endz - uz * 1.2], yaw: 0, scale: [0.24, 2.9, 0.24] });
    transforms.wheelBogie.push({ position: [endx - ux * 1.2, 0.62, endz - uz * 1.2], yaw, scale: [2.6, 0.72, 1.15] });

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.18), new THREE.MeshBasicMaterial({ map: gateTexture(THREE, jetway.g), transparent: true, side: THREE.DoubleSide }));
    sign.name = `KPHX_GateSign_${jetway.g}`;
    sign.position.set(jetway.x - ux * 2.8, 7.1, jetway.z - uz * 2.8);
    sign.rotation.y = yaw;
    group.add(sign);

    if (parking && (parking.g === "A1" || KPHX_V181_PROFILE.b15Gates.includes(parking.g))) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.8), new THREE.MeshBasicMaterial({ map: gateTexture(THREE, parking.g), transparent: true, side: THREE.DoubleSide }));
      label.name = `KPHX_RampLabel_${parking.g}`;
      label.position.set(parking.x - parkingDx * 9, 0.075, parking.z - parkingDz * 9);
      label.rotation.x = -Math.PI / 2;
      label.rotation.z = -parkingHeading;
      group.add(label);
    }
  }

  addTerminalConnectors(THREE, group, data.jetways, lowerWall);
  const box = new THREE.BoxGeometry(1, 1, 1);
  addInstances(THREE, group, box, lowerWall, transforms.lower, "KPHX_Terminal4_LowerGateModules");
  addInstances(THREE, group, box, warmWall, transforms.upper, "KPHX_Terminal4_UpperGateModules");
  addInstances(THREE, group, box, roof, transforms.roof, "KPHX_Terminal4_RoofParapets");
  addInstances(THREE, group, box, metal, transforms.roofUnits, "KPHX_Terminal4_RoofEquipment");
  addInstances(THREE, group, box, glass, transforms.glass, "KPHX_Terminal4_FacadeGlass");
  addInstances(THREE, group, new THREE.CylinderGeometry(1, 1, 1, 18), jetShellDark, transforms.rotunda, "KPHX_Terminal4_JetwayRotundas");
  addInstances(THREE, group, box, jetShell, transforms.bridgeOuter, "KPHX_Terminal4_JetwayOuterSections");
  addInstances(THREE, group, box, jetShellDark, transforms.bridgeInner, "KPHX_Terminal4_JetwayInnerSections");
  addInstances(THREE, group, box, glass, transforms.bridgeGlass, "KPHX_Terminal4_JetwayGlass");
  addInstances(THREE, group, box, jetShell, transforms.cabin, "KPHX_Terminal4_JetwayCabins");
  addInstances(THREE, group, new THREE.CylinderGeometry(1, 1, 1, 12), metal, transforms.supports, "KPHX_Terminal4_JetwaySupports");
  addInstances(THREE, group, box, metal, transforms.wheelBogie, "KPHX_Terminal4_JetwayWheelBogies");
  addInstances(THREE, group, box, yellow, transforms.lines, "KPHX_Terminal4_GateLeadIns", false);
  addInstances(THREE, group, box, red, transforms.stops, "KPHX_Terminal4_StopBars", false);
  addInstances(THREE, group, box, white, transforms.safety, "KPHX_Terminal4_SafetyBars", false);

  group.userData.environmentSource = "authored-kphx-v181-terminal4";
  group.userData.packageVersion = KPHX_V181_PROFILE.packageVersion;
  group.userData.detailLevel = KPHX_V181_PROFILE.detailLevel;
  group.userData.registration = "A1 exact source anchor; source heading rotated directly onto training aircraft -Z axis";
  group.userData.sourceJetwayCount = KPHX_V181_PROFILE.sourceJetwayCount;
  group.userData.terminal4JetwayCount = data.jetways.length;
  group.userData.terminal4ParkingCount = data.parkings.length;
  group.userData.b15Anchors = data.parkings.filter((parking) => KPHX_V181_PROFILE.b15Gates.includes(parking.g));
  group.userData.trainingCorridor = {
    from: "A1",
    to: KPHX_V181_PROFILE.b15Gates,
    distanceMeters: group.userData.b15Anchors.map((gate) => Math.hypot(gate.x, gate.z)),
  };
  return group;
}
