import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SUPPORTED_EQUIPMENT = new Set(["lektro-88", "standup-tug"]);

export function supportsRuntimeEquipmentVisual(equipmentId) {
  return SUPPORTED_EQUIPMENT.has(equipmentId);
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
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.geometry.getAttribute("normal")) node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
  });

  rig.visual.visible = false;
  rig.root.add(gltf.scene);
  rig.root.userData.runtimeVisualSource = "authored-standup";
  rig.root.userData.runtimeVisualUrl = url;
  return "authored-standup";
}
