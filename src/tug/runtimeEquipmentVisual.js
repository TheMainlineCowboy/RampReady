import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const AUTHORED_EQUIPMENT = Object.freeze({
  "lektro-88": Object.freeze({
    file: "lektro-88.glb",
    name: "RampReady_LEKTRO88_UserAuthored",
    source: "user-authored-lektro-88-model",
    operatorStation: "seated-operator-camera",
    operatorControls: "authored-model-physics-rig",
  }),
  "standup-tug": Object.freeze({
    file: "standup-tug.glb",
    name: "RampReady_StandupRevisedV3",
    source: "user-authored-standup-model",
    operatorStation: "standing-reference-camera",
    operatorControls: "authored-model-physics-rig",
  }),
  "manager-kubota": Object.freeze({
    file: "manager-kubota.glb",
    name: "RampReady_ManagerKubota_UserAuthored",
    source: "user-authored-manager-kubota-model",
    operatorStation: "seated-manager-driver",
    operatorControls: "authored-model-physics-rig",
  }),
});

const SUPPORTED_EQUIPMENT = new Set(Object.keys(AUTHORED_EQUIPMENT));

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
  // The procedural rig remains only as the invisible physics/anchor rig.
  // The visible vehicle is always the supplied/source-derived authored model.
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
  const metadata = AUTHORED_EQUIPMENT[equipmentId];
  if (!metadata) throw new Error(`Unsupported runtime equipment visual: ${equipmentId}`);

  const url = `${import.meta.env.BASE_URL}models/${metadata.file}`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = prepareAuthoredVehicle(gltf.scene, metadata.name);

  return installAuthoredVehicle(rig, scene, {
    ...metadata,
    url,
  });
}
