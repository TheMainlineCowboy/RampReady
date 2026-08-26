import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { installDetailedLektro88Visual } from "./lektro88DetailedVisual.js";
import { installDetailedManagerKubotaVisual } from "./managerKubotaDetailedVisual.js";

const SUPPORTED_EQUIPMENT = new Set(["lektro-88", "standup-tug", "manager-kubota"]);

export function supportsRuntimeEquipmentVisual(equipmentId) {
  return SUPPORTED_EQUIPMENT.has(equipmentId);
}

function prepareAuthoredVehicle(scene, name) {
  scene.name = name;
  scene.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.geometry.getAttribute("normal")) node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = true;
  });
  return scene;
}

function installAuthoredVehicle(rig, scene, metadata) {
  rig.visual.visible = false;
  rig.root.add(scene);
  rig.operatorEye.position.fromArray(rig.profile.operatorEye);
  rig.forwardLook.position.fromArray(rig.profile.operatorLook);
  rig.root.userData.authoredVehicleScene = scene;
  rig.root.userData.runtimeVisualSource = metadata.source;
  rig.root.userData.runtimeVisualUrl = metadata.url;
  rig.root.userData.vehicleRole = rig.profile.role;
  rig.root.userData.vehicleReferenceModel = rig.profile.referenceModel;
  rig.root.userData.operatorStation = metadata.operatorStation;
  rig.root.userData.operatorControls = metadata.operatorControls;
  return metadata.source;
}

export async function installRuntimeEquipmentVisual(rig, equipmentId) {
  if (!supportsRuntimeEquipmentVisual(equipmentId)) {
    throw new Error(`Unsupported runtime equipment visual: ${equipmentId}`);
  }

  if (equipmentId === "lektro-88") {
    return installDetailedLektro88Visual(rig);
  }

  if (equipmentId === "manager-kubota") {
    return installDetailedManagerKubotaVisual(rig);
  }

  const url = `${import.meta.env.BASE_URL}models/standup-tug.glb`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = prepareAuthoredVehicle(gltf.scene, "RampReady_StandupRevisedV3");

  return installAuthoredVehicle(rig, scene, {
    source: "authored-standup-v3",
    url,
    operatorStation: "standing-reference-camera",
    operatorControls: "supplied-v3-controls-not-final",
  });
}
