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
  detailLevel: "terminal4-refined-v3",
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
  ctx.fillStyle = "#aeb0ad";
  ctx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y += 4) {
    for (let x = 0; x < 512; x += 4) {
      const shade = 150 + Math.floor(seededNoise(x, y) * 25);
      ctx.fillStyle = `rgba(${shade},${shade},${shade - 3},0.22)`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(58,61,63,0.46)";
  for (const p of [0, 128, 256, 384, 512]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(512, p); ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(235,235,228,0.30)";
  for (const p of [64, 192, 320, 448]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 512); ctx.stroke();
  }

  for (let i = 0; i < 38; i += 1) {
    const x = (i * 149) % 512;
    const y = (i * 233) % 512;
    const radius = 8 + (i % 6) * 4;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, radius);
    gradient.addColorStop(0, "rgba(38,40,42,0.16)");
    gradient.addColorStop(1, "rgba(38,40,42,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
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
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "rgba(255,255,255,0.13)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0)");
  gradient.addColorStop(1, grime);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.2, 1.25);
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

function addTerminalConnectors(THREE, group, jetways, materials) {
  const transforms = { lower: [], upper: [], glass: [], roof: [], mullions: [] };
  const used = new Set();

  for (let i = 0; i < jetways.length; i += 1) {
    let nearest = -1;
    let nearestDistance = Infinity;
    for (let j = 0; j < jetways.length; j += 1) {
      if (i === j || jetways[i].l !== jetways[j].l) continue;
      const distance = Math.hypot(jetways[j].x - jetways[i].x, jetways[j].z - jetways[i].z);
      if (distance < nearestDistance) { nearestDistance = distance; nearest = j; }
    }
    if (nearest < 0 || nearestDistance > 52) continue;

    const key = [i, nearest].sort((a, b) => a - b).join(":");
    if (used.has(key)) continue;
    used.add(key);

    const a = jetways[i]; const b = jetways[nearest];
    const dx = b.x - a.x; const dz = b.z - a.z;
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    const yaw = Math.atan2(dx, dz);
    const length = Math.max(8, nearestDistance + 2);

    transforms.lower.push({ position: [midX, 1.45, midZ], yaw, scale: [9.6, 2.9, length] });
    transforms.glass.push({ position: [midX, 3.55, midZ], yaw, scale: [9.85, 1.15, length + 0.15] });
    transforms.upper.push({ position: [midX, 5.45, midZ], yaw, scale: [9.55, 2.65, length] });
    transforms.roof.push({ position: [midX, 6.95, midZ], yaw, scale: [10.1, 0.28, length + 0.25] });

    const mullionCount = Math.max(2, Math.floor(length / 8));
    for (let m = 1; m < mullionCount; m += 1) {
      const t = m / mullionCount - 0.5;
      transforms.mullions.push({
        position: [midX + Math.sin(yaw) * length * t, 3.55, midZ + Math.cos(yaw) * length * t],
        yaw,
        scale: [10.05, 1.22, 0.12],
      });
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  addInstances(THREE, group, box, materials.lower, transforms.lower, "KPHX_Terminal4_ConcourseLower");
  addInstances(THREE, group, box, materials.glass, transforms.glass, "KPHX_Terminal4_ConcourseGlassBand");
  addInstances(THREE, group, box, materials.upper, transforms.upper, "KPHX_Terminal4_ConcourseUpper");
  addInstances(THREE, group, box, materials.roof, transforms.roof, "KPHX_Terminal4_ConcourseRoof");
  addInstances(THREE, group, box, materials.metal, transforms.mullions, "KPHX_Terminal4_WindowMullions");
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

  const concrete = new THREE.MeshStandardMaterial({
    map: makeConcreteTexture(THREE),
    color: 0xffffff,
    roughness: 0.98,
    metalness: 0,
  });
  const wallTexture = makePanelTexture(THREE, "#b7aa98", "rgba(91,79,66,0.34)", "rgba(55,47,40,0.18)");
  const lowerTexture = makePanelTexture(THREE, "#948778", "rgba(61,55,49,0.34)", "rgba(36,33,30,0.20)");
  const shellTexture = makePanelTexture(THREE, "#c4c7c8", "rgba(69,74,77,0.30)", "rgba(45,48,50,0.14)");
  const warmWall = new THREE.MeshStandardMaterial({ map: wallTexture, color: 0xffffff, roughness: 0.84, metalness: 0.01 });
  const lowerWall = new THREE.MeshStandardMaterial({ map: lowerTexture, color: 0xffffff, roughness: 0.92, metalness: 0.01 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x426b82, roughness: 0.18, metalness: 0.12, transparent: true, opacity: 0.74 });
  const jetShell = new THREE.MeshStandardMaterial({ map: shellTexture, color: 0xffffff, roughness: 0.56, metalness: 0.18 });
  const jetShellDark = new THREE.MeshStandardMaterial({ color: 0x8c9498, roughness: 0.60, metalness: 0.28 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x40484d, roughness: 0.46, metalness: 0.58 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x837b72, roughness: 0.88, metalness: 0.03 });
  const yellow = new THREE.MeshBasicMaterial({ color: 0xffc400 });
  const white = new THREE.MeshBasicMaterial({ color: 0xf2f0e8 });
  const black = new THREE.MeshStandardMaterial({ color: 0x202427, roughness: 0.72, metalness: 0.20 });

  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(590, 1080), concrete);
  ramp.name = "KPHX_v181_Terminal4_TexturedRamp";
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.set(75, 0.018, 100);
  ramp.receiveShadow = true;
  group.add(ramp);

  const transforms = {
    lower: [], upper: [], roof: [], roofUnits: [], glass: [], rotunda: [],
    bridgeOuter: [], bridgeInner: [], bridgeGlass: [], cabin: [], collars: [],
    supports: [], wheelBogie: [], lines: [], stopTees: [], safety: [],
  };

  for (const parking of data.parkings) {
    const heading = THREE.MathUtils.degToRad(parking.h);
    const dx = Math.sin(heading); const dz = Math.cos(heading);

    transforms.lines.push({
      position: [parking.x + dx * 22, 0.052, parking.z + dz * 22],
      yaw: heading,
      scale: [0.15, 0.028, 44],
    });

    if (parking.g !== "A1") {
      transforms.stopTees.push({
        position: [parking.x - dx * 1.8, 0.060, parking.z - dz * 1.8],
        yaw: heading,
        scale: [4.4, 0.026, 0.16],
      });
      transforms.safety.push({
        position: [parking.x - dx * 7.5, 0.058, parking.z - dz * 7.5],
        yaw: heading,
        scale: [6.2, 0.024, 0.12],
      });
    }
  }

  for (const jetway of data.jetways) {
    const parking = parkingByGate.get(jetway.g);
    const parkingHeading = THREE.MathUtils.degToRad(parking?.h ?? jetway.h);
    const parkingDx = Math.sin(parkingHeading);
    const parkingDz = Math.cos(parkingHeading);

    let dx = jetway.px - jetway.x;
    let dz = jetway.pz - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 1) {
      const heading = THREE.MathUtils.degToRad(jetway.h);
      dx = Math.sin(heading);
      dz = Math.cos(heading);
      distance = 22;
    }

    const ux = dx / distance;
    const uz = dz / distance;
    const px = -uz;
    const pz = ux;
    const yaw = Math.atan2(ux, uz);

    const isA1 = jetway.g === "A1";
    const doorInset = isA1 ? 10.8 : 8.0;
    const targetDistance = clamp(distance - doorInset, 12, 19);
    const bridgeStart = 2.0;
    const bridgeLength = clamp(targetDistance - bridgeStart, 8.5, 17);
    const rotundaY = 4.55;
    const cabinY = isA1 ? 2.95 : 3.25;
    const drop = rotundaY - cabinY;
    const pitch = Math.atan2(drop, bridgeLength);

    const baseX = jetway.x - ux * 2.8;
    const baseZ = jetway.z - uz * 2.8;
    transforms.lower.push({ position: [baseX, 1.55, baseZ], yaw, scale: [9.2, 3.1, 5.4] });
    transforms.upper.push({ position: [baseX, 5.1, baseZ], yaw, scale: [8.8, 2.55, 5] });
    transforms.roof.push({ position: [baseX, 6.55, baseZ], yaw, scale: [9.4, 0.28, 5.6] });
    transforms.roofUnits.push({ position: [baseX + px * 2.3, 7.02, baseZ + pz * 2.3], yaw, scale: [2.1, 0.65, 1.7] });
    transforms.glass.push({ position: [baseX + ux * 2.45, 3.55, baseZ + uz * 2.45], yaw, scale: [8.9, 1.05, 0.18] });
    transforms.rotunda.push({ position: [jetway.x, rotundaY, jetway.z], yaw, scale: [2.25, 2.85, 2.25] });

    const firstLength = bridgeLength * 0.56;
    const secondLength = bridgeLength * 0.50;
    const firstCenterDistance = bridgeStart + firstLength / 2;
    const secondCenterDistance = bridgeStart + firstLength + secondLength / 2 - 0.65;
    const firstY = rotundaY - drop * (firstCenterDistance / bridgeLength);
    const secondY = rotundaY - drop * (secondCenterDistance / bridgeLength);

    transforms.bridgeOuter.push({
      position: [jetway.x + ux * firstCenterDistance, firstY, jetway.z + uz * firstCenterDistance],
      yaw, pitch, scale: [2.75, 2.45, firstLength],
    });
    transforms.bridgeInner.push({
      position: [jetway.x + ux * secondCenterDistance, secondY, jetway.z + uz * secondCenterDistance],
      yaw, pitch, scale: [2.48, 2.22, secondLength],
    });
    transforms.bridgeGlass.push({
      position: [
        jetway.x + ux * (bridgeStart + bridgeLength / 2) + px * 1.36,
        rotundaY - drop * 0.5 + 0.08,
        jetway.z + uz * (bridgeStart + bridgeLength / 2) + pz * 1.36,
      ],
      yaw, pitch, scale: [0.11, 0.92, bridgeLength * 0.84],
    });

    const endDistance = bridgeStart + bridgeLength;
    const endx = jetway.x + ux * endDistance;
    const endz = jetway.z + uz * endDistance;
    transforms.cabin.push({ position: [endx, cabinY, endz], yaw, scale: [3.15, 2.65, 2.85] });
    transforms.collars.push({ position: [endx + ux * 1.48, cabinY, endz + uz * 1.48], yaw, scale: [2.65, 2.35, 0.42] });
    transforms.supports.push({
      position: [endx - ux * 0.9, cabinY / 2 - 0.15, endz - uz * 0.9],
      yaw: 0,
      scale: [0.22, Math.max(1.8, cabinY - 0.45), 0.22],
    });
    transforms.wheelBogie.push({
      position: [endx - ux * 0.9, 0.55, endz - uz * 0.9],
      yaw,
      scale: [2.3, 0.62, 1.0],
    });

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 1.05),
      new THREE.MeshBasicMaterial({ map: gateTexture(THREE, jetway.g), transparent: true, side: THREE.DoubleSide }),
    );
    sign.name = `KPHX_GateSign_${jetway.g}`;
    sign.position.set(baseX - ux * 1.3, 5.9, baseZ - uz * 1.3);
    sign.rotation.y = yaw;
    group.add(sign);

    if (parking && (parking.g === "A1" || KPHX_V181_PROFILE.b15Gates.includes(parking.g))) {
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 2.35),
        new THREE.MeshBasicMaterial({ map: gateTexture(THREE, parking.g), transparent: true, side: THREE.DoubleSide }),
      );
      label.name = `KPHX_RampLabel_${parking.g}`;
      label.position.set(parking.x - parkingDx * 12, 0.074, parking.z - parkingDz * 12);
      label.rotation.x = -Math.PI / 2;
      label.rotation.z = -parkingHeading;
      group.add(label);
    }
  }

  addTerminalConnectors(THREE, group, data.jetways, {
    lower: lowerWall,
    upper: warmWall,
    glass,
    roof,
    metal,
  });

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
  addInstances(THREE, group, box, black, transforms.collars, "KPHX_Terminal4_JetwayDoorCollars");
  addInstances(THREE, group, new THREE.CylinderGeometry(1, 1, 1, 12), metal, transforms.supports, "KPHX_Terminal4_JetwaySupports");
  addInstances(THREE, group, box, metal, transforms.wheelBogie, "KPHX_Terminal4_JetwayWheelBogies");
  addInstances(THREE, group, box, yellow, transforms.lines, "KPHX_Terminal4_GateLeadIns", false);
  addInstances(THREE, group, box, yellow, transforms.stopTees, "KPHX_Terminal4_StopTees", false);
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
