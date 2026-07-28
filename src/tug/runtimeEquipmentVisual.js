import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SUPPORTED_EQUIPMENT = new Set(["lektro-88", "standup-tug"]);
const PIEDMONT_RED = new THREE.Color(0xd01f2d);

export function supportsRuntimeEquipmentVisual(equipmentId) {
  return SUPPORTED_EQUIPMENT.has(equipmentId);
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

    // Round black GE-style battery gauge with the illuminated rectangular LCD seen in the PHX tug.
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

function makeStandupControls(rig) {
  const group = new THREE.Group();
  group.name = "RampReady_StandupOperatorControls";

  const redPaint = new THREE.MeshStandardMaterial({ color: PIEDMONT_RED, roughness: 0.72, metalness: 0.08 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.82, metalness: 0.12 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8bdbe, roughness: 0.72, metalness: 0.46 });

  // Dedicated operator-station geometry from the PHX reference photos. The exterior scan
  // remains the source of truth in chase views; this clean station replaces scan fragments
  // only while the camera is physically standing inside the tug.
  const consoleBody = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.72, 0.30), redPaint);
  consoleBody.name = "Standup_OperatorConsoleBody";
  consoleBody.position.set(0.56, 0.91, 0.08);
  consoleBody.castShadow = true;
  consoleBody.receiveShadow = true;
  group.add(consoleBody);

  const consoleTop = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.08, 0.38), redPaint);
  consoleTop.position.set(0.56, 1.31, 0.05);
  consoleTop.castShadow = true;
  group.add(consoleTop);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.36, 0.035), silver);
  panel.name = "Standup_DashboardPanel";
  panel.position.set(0.61, 1.17, -0.095);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const wheel = new THREE.Group();
  wheel.name = "Standup_SteeringWheel";
  wheel.position.set(0.63, 1.16, -0.155);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.019, 12, 48), dark);
  ring.castShadow = true;
  wheel.add(ring);

  for (const angle of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.019, 0.205, 0.019), dark);
    spoke.position.set(Math.cos(angle) * 0.102, Math.sin(angle) * 0.102, 0);
    spoke.rotation.z = angle - Math.PI / 2;
    spoke.castShadow = true;
    wheel.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.064, 24), dark);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.012;
  hub.castShadow = true;
  wheel.add(hub);

  // The real spinner sits near six o'clock in the supplied close-up reference.
  const knobAngle = -Math.PI / 2;
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.102, 18),
    new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.68, metalness: 0.18 }),
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(Math.cos(knobAngle) * 0.198, Math.sin(knobAngle) * 0.198, -0.055);
  knob.castShadow = true;
  wheel.add(knob);
  group.add(wheel);

  const gauge = makeGaugeTexture(100);
  const gaugeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.070, 40),
    new THREE.MeshBasicMaterial({ map: gauge.texture, transparent: true, toneMapped: false }),
  );
  gaugeMesh.name = "Standup_BatteryGauge";
  gaugeMesh.position.set(0.90, 1.12, -0.118);
  group.add(gaugeMesh);

  // The right-hand standing platform and padded guard are visible at the edge of the
  // real driver's peripheral view without blocking the forward sightline.
  const platform = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.72), dark);
  platform.position.set(0.18, 0.20, -0.43);
  platform.receiveShadow = true;
  group.add(platform);

  const guardPost = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.88, 0.055), redPaint);
  guardPost.position.set(-0.10, 0.83, -0.30);
  guardPost.castShadow = true;
  group.add(guardPost);
  const guardPad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.075, 0.10), dark);
  guardPad.position.set(0.08, 1.18, -0.30);
  guardPad.castShadow = true;
  group.add(guardPad);

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
  const select = document.querySelector(".rr-view-select");
  const canvas = document.querySelector("canvas.trainerCanvas");
  if (!select) return;
  const sync = () => {
    const operatorView = select.value === "driver";
    authoredScene.visible = !operatorView;
    if (canvas) canvas.dataset.operatorShell = operatorView ? "clean-photo-station" : "authored-exterior";
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

  rig.visual.visible = false;
  rig.root.add(gltf.scene);
  makeStandupControls(rig);
  connectOperatorViewShellToggle(gltf.scene);
  rig.root.userData.authoredStandupScene = gltf.scene;
  rig.root.userData.runtimeVisualSource = "authored-standup";
  rig.root.userData.runtimeVisualUrl = url;
  rig.root.userData.paintScheme = "piedmont-red-reference";
  rig.root.userData.operatorStation = "right-platform-steering-wheel";
  return "authored-standup";
}
