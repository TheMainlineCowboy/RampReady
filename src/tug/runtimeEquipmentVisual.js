import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SUPPORTED_EQUIPMENT = new Set(["lektro-88", "standup-tug"]);
const PIEDMONT_RED = new THREE.Color(0xd01f2d);

export function supportsRuntimeEquipmentVisual(equipmentId) {
  return SUPPORTED_EQUIPMENT.has(equipmentId);
}

function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  draw(context, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeGaugeTexture(initialPercent = 100) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const render = (percent) => {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    context.clearRect(0, 0, canvas.width, canvas.height);

    context.beginPath();
    context.arc(128, 128, 118, 0, Math.PI * 2);
    context.fillStyle = "#171b1a";
    context.fill();
    context.lineWidth = 9;
    context.strokeStyle = "#555b58";
    context.stroke();

    context.shadowColor = "#9cbf72";
    context.shadowBlur = 14;
    context.fillStyle = "#9cbf72";
    context.fillRect(55, 88, 146, 66);
    context.shadowBlur = 0;
    context.strokeStyle = "#657951";
    context.lineWidth = 4;
    context.strokeRect(55, 88, 146, 66);

    context.fillStyle = "#172016";
    context.font = "700 43px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${value}%`, 128, 121);

    context.font = "700 20px sans-serif";
    context.fillStyle = "#aeb7b0";
    context.fillText("BATTERY", 128, 190);
    texture.needsUpdate = true;
  };

  render(initialPercent);
  return { texture, render };
}

function makeDiamondPlateTexture() {
  return makeCanvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = "#2f3437";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "rgba(195,205,208,0.32)";
    context.lineWidth = 3;
    for (let y = -24; y < height + 24; y += 32) {
      for (let x = -24; x < width + 24; x += 32) {
        context.beginPath();
        context.moveTo(x - 7, y - 3);
        context.lineTo(x + 7, y + 3);
        context.stroke();
        context.beginPath();
        context.moveTo(x + 9, y + 13);
        context.lineTo(x - 5, y + 19);
        context.stroke();
      }
    }
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "rgba(255,255,255,0.10)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.22)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
}

function makeConsoleLabelTexture() {
  return makeCanvasTexture(512, 128, (context, width, height) => {
    context.fillStyle = "#ece7dc";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#1c2124";
    context.lineWidth = 10;
    context.strokeRect(6, 6, width - 12, height - 12);
    context.fillStyle = "#171b1d";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "700 47px Arial, sans-serif";
    context.fillText("PIEDMONT  •  STAND-UP TUG", width / 2, height / 2);
  });
}

function makeTaperedConsoleGeometry() {
  const vertices = new Float32Array([
    -0.38, 0.00, -0.18,
     0.38, 0.00, -0.18,
     0.38, 0.00,  0.18,
    -0.38, 0.00,  0.18,
    -0.31, 0.58, -0.13,
     0.31, 0.58, -0.13,
     0.31, 0.58,  0.10,
    -0.31, 0.58,  0.10,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addBox(parent, name, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTube(parent, name, material, start, end, radius = 0.022) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const delta = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 18), material);
  mesh.name = name;
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeStandupControls(rig) {
  const group = new THREE.Group();
  group.name = "RampReady_StandupOperatorControls";

  const redPaint = new THREE.MeshStandardMaterial({ color: PIEDMONT_RED, roughness: 0.58, metalness: 0.18 });
  const redDark = new THREE.MeshStandardMaterial({ color: 0x8f141d, roughness: 0.68, metalness: 0.14 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.72, metalness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.98, metalness: 0.01 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xaeb6b8, roughness: 0.46, metalness: 0.62 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0xc7cdce, roughness: 0.38, metalness: 0.72 });
  const warningYellow = new THREE.MeshStandardMaterial({ color: 0xf4c300, roughness: 0.58, metalness: 0.08 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4d9, roughness: 0.72, metalness: 0.02 });

  addBox(group, "Standup_ConsolePedestal", new THREE.BoxGeometry(0.56, 0.54, 0.30), redDark, [0.54, 0.54, -0.08]);
  const consoleBody = addBox(group, "Standup_OperatorConsoleBody", makeTaperedConsoleGeometry(), redPaint, [0.54, 0.75, -0.09]);
  consoleBody.userData.reference = "tapered-phx-standup-console";
  addBox(group, "Standup_ConsoleTopLip", new THREE.BoxGeometry(0.72, 0.055, 0.31), redPaint, [0.54, 1.355, -0.11]);
  addBox(group, "Standup_ConsoleLowerKick", new THREE.BoxGeometry(0.64, 0.10, 0.34), redDark, [0.54, 0.28, -0.08]);

  const panel = addBox(
    group,
    "Standup_DashboardPanel",
    new THREE.BoxGeometry(0.61, 0.29, 0.032),
    brushed,
    [0.54, 1.17, -0.235],
    [-0.10, 0, 0],
  );
  panel.userData.reference = "angled-brushed-metal-instrument-panel";

  const labelTexture = makeConsoleLabelTexture();
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.49, 0.105),
    new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false }),
  );
  label.name = "Standup_ConsoleManufacturerLabel";
  label.position.set(0.54, 0.91, -0.247);
  label.rotation.x = -0.06;
  group.add(label);

  const wheel = new THREE.Group();
  wheel.name = "Standup_SteeringWheel";
  wheel.position.set(0.49, 1.16, -0.305);
  wheel.rotation.x = -0.11;

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.015, 14, 52), rubber);
  ring.castShadow = true;
  wheel.add(ring);
  for (const angle of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.126, 0.014), dark);
    spoke.position.set(Math.cos(angle) * 0.063, Math.sin(angle) * 0.063, 0);
    spoke.rotation.z = angle - Math.PI / 2;
    spoke.castShadow = true;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.052, 24), dark);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.012;
  hub.castShadow = true;
  wheel.add(hub);

  const knobAngle = -Math.PI / 2;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.080, 18), dark);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(Math.cos(knobAngle) * 0.123, Math.sin(knobAngle) * 0.123, -0.045);
  knob.castShadow = true;
  wheel.add(knob);
  group.add(wheel);

  addTube(group, "Standup_SteeringColumn", dark, [0.49, 1.16, -0.25], [0.50, 1.08, -0.03], 0.035);
  addBox(group, "Standup_SteeringColumnBoot", new THREE.CylinderGeometry(0.060, 0.078, 0.10, 24), rubber, [0.50, 1.04, -0.015], [Math.PI / 2, 0, 0]);

  const gauge = makeGaugeTexture(100);
  const gaugeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.050, 40),
    new THREE.MeshBasicMaterial({ map: gauge.texture, transparent: true, toneMapped: false }),
  );
  gaugeMesh.name = "Standup_BatteryGauge";
  gaugeMesh.position.set(0.72, 1.17, -0.258);
  gaugeMesh.rotation.set(-0.10, Math.PI, 0);
  group.add(gaugeMesh);

  const selectorBase = addBox(group, "Standup_DirectionSelectorBase", new THREE.CylinderGeometry(0.034, 0.034, 0.020, 24), dark, [0.34, 1.14, -0.263], [Math.PI / 2, 0, 0]);
  selectorBase.userData.control = "forward-reverse";
  addTube(group, "Standup_DirectionSelectorLever", dark, [0.34, 1.15, -0.28], [0.31, 1.25, -0.31], 0.013);
  addBox(group, "Standup_DirectionSelectorKnob", new THREE.SphereGeometry(0.027, 18, 12), rubber, [0.31, 1.25, -0.31]);

  addBox(group, "Standup_EStopCollar", new THREE.CylinderGeometry(0.046, 0.046, 0.020, 24), warningYellow, [0.79, 1.04, -0.254], [Math.PI / 2, 0, 0]);
  addBox(group, "Standup_EStopButton", new THREE.CylinderGeometry(0.037, 0.044, 0.033, 24), redDark, [0.79, 1.04, -0.278], [Math.PI / 2, 0, 0]);
  addBox(group, "Standup_KeySwitch", new THREE.CylinderGeometry(0.022, 0.022, 0.025, 20), dark, [0.69, 1.03, -0.256], [Math.PI / 2, 0, 0]);
  addBox(group, "Standup_KeyBlade", new THREE.BoxGeometry(0.012, 0.050, 0.010), silver, [0.69, 1.055, -0.278], [0, 0, -0.35]);

  const lampMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x32b54a, emissive: 0x0d5117, emissiveIntensity: 0.8, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0xf2c532, emissive: 0x7d5b05, emissiveIntensity: 0.65, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0xd82b2b, emissive: 0x5f0707, emissiveIntensity: 0.55, roughness: 0.35 }),
  ];
  [0.39, 0.45, 0.51].forEach((x, index) => {
    addBox(group, `Standup_StatusLamp_${index}`, new THREE.SphereGeometry(0.018, 16, 10), lampMaterials[index], [x, 1.035, -0.267]);
  });

  const diamondTexture = makeDiamondPlateTexture();
  diamondTexture.wrapS = THREE.RepeatWrapping;
  diamondTexture.wrapT = THREE.RepeatWrapping;
  diamondTexture.repeat.set(3, 3);
  const platformMaterial = new THREE.MeshStandardMaterial({ map: diamondTexture, color: 0x73797b, roughness: 0.52, metalness: 0.54 });
  addBox(group, "Standup_OperatorPlatform", new THREE.BoxGeometry(0.78, 0.055, 0.82), platformMaterial, [0.34, 0.18, -0.72]);
  addBox(group, "Standup_PlatformToePlate", new THREE.BoxGeometry(0.82, 0.12, 0.045), redDark, [0.34, 0.25, -1.12]);

  addTube(group, "Standup_GuardLeftPost", redPaint, [-0.06, 0.25, -0.92], [-0.06, 1.18, -0.92], 0.025);
  addTube(group, "Standup_GuardRightPost", redPaint, [0.05, 0.25, -0.18], [0.05, 1.18, -0.18], 0.025);
  addTube(group, "Standup_GuardUpperRail", redPaint, [-0.06, 1.18, -0.92], [0.05, 1.18, -0.18], 0.025);
  addTube(group, "Standup_GuardLowerRail", redPaint, [-0.06, 0.74, -0.92], [0.05, 0.74, -0.18], 0.021);
  addBox(group, "Standup_GuardPad", new THREE.BoxGeometry(0.16, 0.095, 0.38), rubber, [-0.02, 1.11, -0.55], [0, -0.12, 0]);

  addBox(group, "Standup_DeadmanPedal", new THREE.BoxGeometry(0.24, 0.045, 0.15), dark, [0.46, 0.235, -0.78], [-0.18, 0, 0]);
  addBox(group, "Standup_FloorWarningStripe", new THREE.BoxGeometry(0.72, 0.008, 0.075), warningYellow, [0.34, 0.214, -1.04]);

  for (const x of [0.26, 0.82]) {
    for (const y of [1.02, 1.29]) {
      addBox(group, `Standup_PanelFastener_${x}_${y}`, new THREE.CylinderGeometry(0.008, 0.008, 0.010, 12), dark, [x, y, -0.257], [Math.PI / 2, 0, 0]);
    }
  }
  addBox(group, "Standup_ConsoleWearEdge", new THREE.BoxGeometry(0.66, 0.018, 0.018), white, [0.54, 1.337, -0.267]);

  const originalSetSteering = rig.setSteering.bind(rig);
  rig.setSteering = (angle) => {
    originalSetSteering(angle);
    wheel.rotation.z = angle * 4.2;
  };
  rig.setBatteryPercent = (percent) => gauge.render(percent);
  rig.setBatteryPercent(100);
  rig.root.add(group);
  rig.root.userData.standupControlGroup = group;
  rig.root.userData.standupSteeringWheel = wheel;
  rig.root.userData.standupBatteryGauge = gaugeMesh;
  rig.root.userData.batteryPercent = 100;
  rig.root.userData.operatorStationDetail = "tapered-console-wheel-selector-estop-diamond-plate-guard-v21";
  return group;
}

function applyPiedmontRedFinish(scene) {
  scene.traverse((node) => {
    if (!node.isMesh) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const tinted = materials.map((material) => {
      if (!material?.clone) return material;
      const clone = material.clone();
      const brightness = clone.color ? (clone.color.r + clone.color.g + clone.color.b) / 3 : 1;
      if (clone.color && (clone.map || brightness > 0.42)) {
        clone.color.lerp(PIEDMONT_RED, clone.map ? 0.92 : 0.84);
      }
      clone.roughness = Math.max(0.5, clone.roughness ?? 0.5);
      clone.needsUpdate = true;
      return clone;
    });
    node.material = Array.isArray(node.material) ? tinted : tinted[0];
  });
}

function connectOperatorViewShellToggle(authoredScene) {
  const canvas = document.querySelector("canvas.trainerCanvas");
  let select = document.querySelector('select[aria-label="Camera view"]');
  if (!select) {
    select = [...document.querySelectorAll(".rr-view-select")]
      .find((candidate) => [...candidate.options].some((option) => option.value === "driver"));
  }
  if (!select) return;
  const sync = () => {
    const operatorView = select.value === "driver";
    authoredScene.visible = !operatorView;
    if (canvas) canvas.dataset.operatorShell = operatorView ? "detailed-photo-station-v21" : "authored-exterior";
  };
  select.addEventListener("change", sync);
  sync();
}

export async function installRuntimeEquipmentVisual(rig, equipmentId) {
  if (!supportsRuntimeEquipmentVisual(equipmentId)) {
    throw new Error(`Unsupported runtime equipment visual: ${equipmentId}`);
  }
  if (equipmentId === "lektro-88") {
    rig.root.userData.runtimeVisualSource = "procedural-lektro";
    return "procedural-lektro";
  }

  const url = `${import.meta.env.BASE_URL}models/standup-tug.glb`;
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.name = "RampReady_StandupAuthoredVisual";
  applyPiedmontRedFinish(gltf.scene);
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.geometry.getAttribute("normal")) node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
  });

  rig.operatorEye.position.set(0.58, 1.70, -1.72);
  rig.forwardLook.position.set(0.52, 1.18, 4.7);

  rig.visual.visible = false;
  rig.root.add(gltf.scene);
  makeStandupControls(rig);
  connectOperatorViewShellToggle(gltf.scene);
  rig.root.userData.authoredStandupScene = gltf.scene;
  rig.root.userData.runtimeVisualSource = "authored-standup";
  rig.root.userData.runtimeVisualUrl = url;
  rig.root.userData.paintScheme = "piedmont-red-reference";
  rig.root.userData.operatorStation = "right-platform-detailed-steering-console-v21";
  return "authored-standup";
}
