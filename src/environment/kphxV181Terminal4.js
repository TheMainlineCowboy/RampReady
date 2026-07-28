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
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function makeConcreteTexture(THREE) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#9b9d9d";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let x = 0; x < 256; x += 4) {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const shade = 142 + Math.floor((n - Math.floor(n)) * 20);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
      ctx.fillRect(x, y, 4, 4);
    }
  }
  ctx.strokeStyle = "rgba(70,73,76,0.42)";
  ctx.lineWidth = 2;
  for (const p of [0, 64, 128, 192, 256]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(220,222,218,0.25)";
  ctx.lineWidth = 1;
  for (const p of [32, 96, 160, 224]) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke();
  }
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 73) % 256;
    const y = (i * 119) % 256;
    const r = 5 + (i % 5) * 3;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, r);
    gradient.addColorStop(0, "rgba(45,48,50,0.16)");
    gradient.addColorStop(1, "rgba(45,48,50,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 38);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function gateTexture(THREE, label) {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 112;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#121923";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#f5bd1f";
  ctx.lineWidth = 8;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = "white";
  ctx.font = `700 ${label.length > 3 ? 54 : 64}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addInstances(THREE, group, geometry, material, transforms, name) {
  if (!transforms.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const dummy = new THREE.Object3D();
  transforms.forEach((entry, index) => {
    dummy.position.set(...entry.position);
    dummy.rotation.set(0, entry.yaw || 0, 0);
    dummy.scale.set(...entry.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildKphxV181Terminal4(THREE) {
  const data = {
    parkings: [...concourseA.parkings, ...concourseB.parkings],
    jetways: [...concourseA.jetways, ...concourseB.jetways],
  };
  const group = new THREE.Group();
  group.name = "PHX_KPHX_v181_Terminal4_Detail";
  group.position.fromArray(KPHX_V181_PROFILE.sceneOffset);
  group.rotation.y = THREE.MathUtils.degToRad(-KPHX_V181_PROFILE.sourceHeadingDegrees);

  const concrete = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(THREE), color: 0xd0d0cc, roughness: 0.96, metalness: 0 });
  const warmWall = new THREE.MeshStandardMaterial({ color: 0xa18a71, roughness: 0.84, metalness: 0.02 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x304a5f, roughness: 0.22, metalness: 0.08, transparent: true, opacity: 0.72 });
  const jetShell = new THREE.MeshStandardMaterial({ color: 0xc4c6c5, roughness: 0.68, metalness: 0.12 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x555b60, roughness: 0.58, metalness: 0.48 });
  const yellow = new THREE.MeshBasicMaterial({ color: 0xffc400 });
  const red = new THREE.MeshBasicMaterial({ color: 0xb62924 });

  const ramp = new THREE.Mesh(new THREE.PlaneGeometry(560, 1040), concrete);
  ramp.name = "KPHX_v181_Terminal4_TexturedRamp";
  ramp.rotation.x = -Math.PI / 2;
  ramp.position.set(78, 0.018, 102);
  ramp.receiveShadow = true;
  group.add(ramp);

  const transforms = { terminal: [], glass: [], bridge: [], bridgeGlass: [], cabin: [], supports: [], lines: [], stops: [] };
  for (const parking of data.parkings) {
    const heading = THREE.MathUtils.degToRad(parking.h);
    const dx = Math.sin(heading); const dz = Math.cos(heading);
    transforms.lines.push({ position: [parking.x + dx * 14, 0.045, parking.z + dz * 14], yaw: heading, scale: [0.2, 0.035, 28] });
    transforms.stops.push({ position: [parking.x, 0.052, parking.z], yaw: heading, scale: [4.4, 0.04, 0.24] });
  }

  for (const jetway of data.jetways) {
    let dx = jetway.px - jetway.x; let dz = jetway.pz - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 1) { const h = THREE.MathUtils.degToRad(jetway.h); dx = Math.sin(h); dz = Math.cos(h); distance = 22; }
    const ux = dx / distance; const uz = dz / distance;
    const px = -uz; const pz = ux;
    const yaw = Math.atan2(ux, uz);
    const bridgeLength = clamp(distance - 6, 7, 19);
    transforms.terminal.push({ position: [jetway.x - ux * 4, 4, jetway.z - uz * 4], yaw, scale: [16, 8, 7] });
    transforms.glass.push({ position: [jetway.x - ux * 0.7, 6, jetway.z - uz * 0.7], yaw, scale: [13.5, 2.2, 0.28] });
    const bx = jetway.x + ux * bridgeLength / 2; const bz = jetway.z + uz * bridgeLength / 2;
    transforms.bridge.push({ position: [bx, 4.7, bz], yaw, scale: [3, 2.8, bridgeLength] });
    transforms.bridgeGlass.push({ position: [bx + px * 1.51, 4.9, bz + pz * 1.51], yaw, scale: [0.14, 1.25, bridgeLength * 0.9] });
    const endx = jetway.x + ux * bridgeLength; const endz = jetway.z + uz * bridgeLength;
    transforms.cabin.push({ position: [endx, 4.3, endz], yaw, scale: [4, 3.4, 3.5] });
    transforms.supports.push({ position: [jetway.x, 1.9, jetway.z], yaw: 0, scale: [0.32, 3.8, 0.32] });
    transforms.supports.push({ position: [endx, 1.3, endz], yaw: 0, scale: [0.22, 2.4, 0.22] });

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.95), new THREE.MeshBasicMaterial({ map: gateTexture(THREE, jetway.g), transparent: true, side: THREE.DoubleSide }));
    sign.name = `KPHX_GateSign_${jetway.g}`;
    sign.position.set(jetway.x + ux * 0.2, 6.2, jetway.z + uz * 0.2);
    sign.rotation.y = yaw;
    group.add(sign);
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  addInstances(THREE, group, box, warmWall, transforms.terminal, "KPHX_Terminal4_GateModules");
  addInstances(THREE, group, box, glass, transforms.glass, "KPHX_Terminal4_FacadeGlass");
  addInstances(THREE, group, box, jetShell, transforms.bridge, "KPHX_Terminal4_JetwayBridges");
  addInstances(THREE, group, box, glass, transforms.bridgeGlass, "KPHX_Terminal4_JetwayGlass");
  addInstances(THREE, group, box, jetShell, transforms.cabin, "KPHX_Terminal4_JetwayCabins");
  addInstances(THREE, group, new THREE.CylinderGeometry(1, 1, 1, 10), metal, transforms.supports, "KPHX_Terminal4_JetwaySupports");
  addInstances(THREE, group, box, yellow, transforms.lines, "KPHX_Terminal4_GateLeadIns");
  addInstances(THREE, group, box, red, transforms.stops, "KPHX_Terminal4_StopBars");

  group.userData.environmentSource = "authored-kphx-v181-terminal4";
  group.userData.packageVersion = KPHX_V181_PROFILE.packageVersion;
  group.userData.sourceJetwayCount = KPHX_V181_PROFILE.sourceJetwayCount;
  group.userData.terminal4JetwayCount = data.jetways.length;
  group.userData.terminal4ParkingCount = data.parkings.length;
  group.userData.b15Anchors = data.parkings.filter((parking) => KPHX_V181_PROFILE.b15Gates.includes(parking.g));
  return group;
}
