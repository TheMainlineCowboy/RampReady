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
    context.beginPath();
    context.arc(128, 128, 118, 0, Math.PI * 2);
    context.fillStyle = "#101615";
    context.fill();
    context.lineWidth = 10;
    context.strokeStyle = "#343b39";
    context.stroke();

    context.fillStyle = "#9cff8b";
    context.shadowColor = "#64ff62";
    context.shadowBlur = 18;
    context.font = "700 62px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`${value}%`, 128, 132);
    context.shadowBlur = 0;
    context.font = "700 22px sans-serif";
    context.fillStyle = "#a7b4ad";
    context.fillText("BATTERY", 128, 188);
    texture.needsUpdate = true;
  };

  render(initialPercent);
  return { texture, render };
}

function makeStandupControls(rig) {
  const group = new THREE.Group();
  group.name = "RampReady_StandupOperatorControls";

  // The real PHX unit has the silver panel and wheel offset to the driver's left,
  // leaving the standing platform and forward sightline open on the right.
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.38, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xb8bdbe, roughness: 0.72, metalness: 0.46 }),
  );
  panel.name = "Standup_DashboardPanel";
  panel.position.set(0.04, 1.10, -0.01);
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  const wheel = new THREE.Group();
  wheel.name = "Standup_SteeringWheel";
  wheel.position.set(0.01, 1.14, -0.075);

  const black = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.82, metalness: 0.12 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.022, 12, 48), black);
  ring.castShadow = true;
  wheel.add(ring);

  for (const angle of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.023, 0.275, 0.023), black);
    spoke.position.set(Math.cos(angle) * 0.137, Math.sin(angle) * 0.137, 0);
    spoke.rotation.z = angle - Math.PI / 2;
    spoke.castShadow = true;
    wheel.add(spoke);
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 24), black);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = -0.012;
  hub.castShadow = true;
  wheel.add(hub);

  const knobAngle = -Math.PI / 2.7;
  const knob = new THREE.Mesh(
    new THREE.CylinderGeometry(0.027, 0.027, 0.105, 18),
    new THREE.MeshStandardMaterial({ color: 0x24272a, roughness: 0.68, metalness: 0.18 }),
  );
  knob.rotation.x = Math.PI / 2;
  knob.position.set(Math.cos(knobAngle) * 0.258, Math.sin(knobAngle) * 0.258, -0.06);
  knob.castShadow = true;
  wheel.add(knob);
  group.add(wheel);

  const gauge = makeGaugeTexture(100);
  const gaugeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.078, 40),
    new THREE.MeshBasicMaterial({ map: gauge.texture, transparent: true, toneMapped: false }),
  );
  gaugeMesh.name = "Standup_BatteryGauge";
  gaugeMesh.position.set(-0.22, 1.05, -0.035);
  group.add(gaugeMesh);

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
  rig.root.userData.runtimeVisualSource = "authored-standup";
  rig.root.userData.runtimeVisualUrl = url;
  rig.root.userData.paintScheme = "piedmont-red-reference";
  rig.root.userData.operatorStation = "right-platform-steering-wheel";
  return "authored-standup";
}
