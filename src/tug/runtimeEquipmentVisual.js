import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const AUTHORED_EQUIPMENT = Object.freeze({
  "lektro-88": Object.freeze({
    file: "lektro-88.glb",
    name: "RampReady_LEKTRO88_RevisedV3",
    source: "Aircraft_Tug_REVISED_V3.obj+mtl",
    operatorStation: "seated-operator-camera",
    operatorControls: "authored-model-physics-rig",
    steeringNodes: Object.freeze(["AuthoredSteerPivot_L", "AuthoredSteerPivot_R"]),
  }),
  "standup-tug": Object.freeze({
    file: "standup-tug.glb",
    runtimePath: "models/standup-tug.glb",
    name: "RampReady_StandupRevisedV3",
    source: "Aircraft_Standup_REVISED_V3.3mf",
    operatorStation: "standing-reference-camera",
    operatorControls: "authored-model-physics-rig",
    steeringNodes: Object.freeze(["AuthoredSteerPivot_C"]),
  }),
  "manager-kubota": Object.freeze({
    file: "manager-kubota.glb",
    name: "RampReady_ManagerKubota_Exact",
    source: "RTVManagersKubota.3mf",
    operatorStation: "seated-manager-driver",
    operatorControls: "authored-model-physics-rig",
    steeringNodes: Object.freeze(["AuthoredSteerPivot_L", "AuthoredSteerPivot_R"]),
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

function bindAuthoredSteering(rig, scene, steeringNodeNames = []) {
  const pivots = steeringNodeNames.map((name) => scene.getObjectByName(name));
  if (pivots.some((pivot) => !pivot)) {
    const missing = steeringNodeNames.filter((name, index) => !pivots[index]);
    throw new Error(`Authored vehicle is missing steering pivot(s): ${missing.join(", ")}`);
  }
  rig.root.userData.authoredSteeringPivots = pivots;
  const currentAngle = Number(rig.root.userData.authoredSteeringAngle || 0);
  for (const pivot of pivots) pivot.rotation.y = currentAngle;
}

function installAuthoredVehicle(rig, scene, metadata) {
  // The procedural rig remains only as the invisible physics/anchor rig.
  // The visible vehicle is always the exact supplied/source-derived model.
  bindAuthoredSteering(rig, scene, metadata.steeringNodes);
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
  rig.root.userData.authoredSteeringNodeNames = [...metadata.steeringNodes];
  return metadata.source;
}

export async function installRuntimeEquipmentVisual(rig, equipmentId) {
  const metadata = AUTHORED_EQUIPMENT[equipmentId];
  if (!metadata) throw new Error(`Unsupported runtime equipment visual: ${equipmentId}`);

  const runtimePath = metadata.runtimePath ?? `models/${metadata.file}`;
  const url = `${import.meta.env.BASE_URL}${runtimePath}`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = prepareAuthoredVehicle(gltf.scene, metadata.name);
  let runtimeVisualSource = metadata.source;
  if (equipmentId === "standup-tug") runtimeVisualSource = "authored-standup";

  return installAuthoredVehicle(rig, scene, {
    ...metadata,
    source: runtimeVisualSource,
    url,
  });
}
