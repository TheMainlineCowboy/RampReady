import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

  // The sit-down LEKTRO 88 physics profile is now based on the AP8850SDA-class
  // dimensions and performance envelope. Its detailed authored visual is the
  // next vehicle asset pass, so the existing procedural body remains visible.
  if (equipmentId === "lektro-88") {
    rig.root.userData.runtimeVisualSource = "procedural-lektro-88-ap8850-physics";
    rig.root.userData.vehicleRole = rig.profile.role;
    rig.root.userData.vehicleReferenceModel = rig.profile.referenceModel;
    return rig.root.userData.runtimeVisualSource;
  }

  const isInspectionVehicle = equipmentId === "manager-kubota";
  // The stand-up build materializes the verified authored payload at this stable
  // public URL. Keep that release contract intact while the revised-V3 source is
  // staged behind the same verified runtime identity.
  const modelFile = isInspectionVehicle ? "manager-kubota.glb" : "standup-tug.glb";
  const url = `${import.meta.env.BASE_URL}models/${modelFile}`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = prepareAuthoredVehicle(
    gltf.scene,
    isInspectionVehicle ? "RampReady_ManagerKubotaRTV" : "RampReady_StandupRevisedV3",
  );

  if (isInspectionVehicle) {
    return installAuthoredVehicle(rig, scene, {
      source: "user-manager-kubota-rtv",
      url,
      operatorStation: "seated-manager-driver",
      operatorControls: "supplied-kubota-interior",
    });
  }

  // Revised V3 is the user's geometry authority. Do not recolor it and do not
  // add the old synthetic wheel/console/guard overlay. The stable runtime source
  // label is retained for production/live-verification compatibility.
  return installAuthoredVehicle(rig, scene, {
    source: "authored-standup",
    url,
    operatorStation: "standing-reference-camera",
    operatorControls: "supplied-v3-controls-not-final",
  });
}
