import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  installRuntimeEquipmentVisual as installLegacyRuntimeEquipmentVisual,
  supportsRuntimeEquipmentVisual as supportsLegacyRuntimeEquipmentVisual,
} from "./runtimeEquipmentVisual.js";

const AP88_EQUIPMENT_ID = "lektro-88";
const AP88_MODEL_PATH = "models/lektro-ap88-r4.glb";
const MAX_STEER = THREE.MathUtils.degToRad(60);
const STEERING_WHEEL_RATIO = 3.3333333333;
const LIFT_ARM_MAX = THREE.MathUtils.degToRad(-7.6);
const CRADLE_PLATFORM_MAX = THREE.MathUtils.degToRad(-12.8);
const STEER_WHEEL_RADIUS = 0.265;
const DRIVE_WHEEL_RADIUS = 0.304;

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const clampSteer = (value) => Math.max(-MAX_STEER, Math.min(MAX_STEER, Number(value) || 0));

function requiredNode(scene, name) {
  const node = scene.getObjectByName(name);
  if (!node) throw new Error(`AP88 R4 is missing runtime node ${name}`);
  return node;
}

function configureMeshQuality(scene) {
  scene.traverse((node) => {
    if (!node.isMesh) return;
    if (!node.geometry.getAttribute("normal")) node.geometry.computeVertexNormals();
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) material.map.anisotropy = Math.max(material.map.anisotropy || 1, 8);
      if (material.normalMap) material.normalMap.anisotropy = Math.max(material.normalMap.anisotropy || 1, 8);
      material.needsUpdate = true;
    }
  });
}

function installAp88Bindings(rig, scene) {
  const steerPivots = [
    requiredNode(scene, "AP88_STEER_L_STEER"),
    requiredNode(scene, "AP88_STEER_R_STEER"),
  ];
  const steerSpin = [
    requiredNode(scene, "AP88_STEER_L_SPIN"),
    requiredNode(scene, "AP88_STEER_R_SPIN"),
  ];
  const driveSpin = [
    requiredNode(scene, "AP88_DRIVE_L_SPIN"),
    requiredNode(scene, "AP88_DRIVE_R_SPIN"),
  ];
  const steeringWheel = requiredNode(scene, "AP88_STEERING_WHEEL");
  const liftArm = requiredNode(scene, "AP88_LIFT_ARM");
  const cradlePlatform = requiredNode(scene, "AP88_CRADLE_PLATFORM");
  const winch = requiredNode(scene, "AP88_WINCH");
  const beacon = requiredNode(scene, "AP88_BEACON");

  const base = {
    steer: steerPivots.map((node) => node.rotation.y),
    steeringWheel: steeringWheel.rotation.z,
    liftArm: liftArm.rotation.x,
    cradlePlatform: cradlePlatform.rotation.x,
    winch: winch.rotation.z,
    beacon: beacon.rotation.y,
  };
  let wheelTravel = 0;
  let liftProgress = 0;

  rig.setSteering = (angle) => {
    const command = clampSteer(angle);
    // RampReady's AP88 capture end is +Z. The authored AP88 steering axle is
    // physically behind the operator after the model's 180-degree runtime yaw,
    // so it counter-steers exactly like the existing rear-steer dynamics model.
    const physical = -command;
    steerPivots.forEach((pivot, index) => { pivot.rotation.y = base.steer[index] + physical; });
    steeringWheel.rotation.z = base.steeringWheel + command * STEERING_WHEEL_RATIO;
    rig.root.userData.ap88SteerRadians = command;
  };

  rig.rotateWheels = (distance) => {
    const travel = Number(distance) || 0;
    wheelTravel += travel;
    const steerRadians = wheelTravel / STEER_WHEEL_RADIUS;
    const driveRadians = wheelTravel / DRIVE_WHEEL_RADIUS;
    for (const wheel of steerSpin) wheel.rotation.x = steerRadians;
    for (const wheel of driveSpin) wheel.rotation.x = driveRadians;
    rig.root.userData.ap88WheelTravelMeters = wheelTravel;
  };

  rig.setLiftProgress = (progress) => {
    liftProgress = clamp01(progress);
    liftArm.rotation.x = base.liftArm + LIFT_ARM_MAX * liftProgress;
    cradlePlatform.rotation.x = base.cradlePlatform + CRADLE_PLATFORM_MAX * liftProgress;
    winch.rotation.z = base.winch - liftProgress * Math.PI * 6;
    rig.root.userData.ap88LiftProgress = liftProgress;
  };

  rig.updateVisual = (_dt, nowMs) => {
    beacon.rotation.y = base.beacon + ((Number(nowMs) || 0) / 1000) * Math.PI * 2;
    rig.root.userData.ap88BeaconActive = true;
  };

  rig.root.userData.ap88RuntimeNodes = {
    steering: steerPivots.map((node) => node.name),
    wheelSpin: [...steerSpin, ...driveSpin].map((node) => node.name),
    steeringWheel: steeringWheel.name,
    liftArm: liftArm.name,
    cradlePlatform: cradlePlatform.name,
    winch: winch.name,
    beacon: beacon.name,
  };
  rig.setSteering(0);
  rig.setLiftProgress(0);
}

async function installAp88RuntimeVisual(rig) {
  const url = `${import.meta.env.BASE_URL}${AP88_MODEL_PATH}`;
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  scene.name = "RampReady_LEKTRO_AP88_R4";
  // The source AP88 capture end is -Z; RampReady's capture direction is +Z.
  // A proper 180-degree yaw preserves handedness and avoids any reflection.
  scene.rotation.y = Math.PI;
  scene.position.y = 0.006;
  configureMeshQuality(scene);
  installAp88Bindings(rig, scene);

  rig.visual.visible = false;
  rig.root.add(scene);
  rig.captureAnchor.position.set(0, 0.08, 2.69);
  rig.operatorEye.position.set(0.44, 1.40, -1.90);
  rig.forwardLook.position.set(0.44, 1.12, 4.4);

  rig.root.userData.authoredAp88Scene = scene;
  rig.root.userData.runtimeVisualSource = "authored-lektro-ap88-r4";
  rig.root.userData.runtimeVisualUrl = url;
  rig.root.userData.ap88ModelSha256 = "24e6eb2dfdd5cfd3ef4bee1b2ecb2e517e9cff55613aba90abee2f9360d60c73";
  rig.root.userData.ap88ModelBytes = 1308512;
  rig.root.userData.ap88Articulation = "live-steering-wheelroll-cradle-winch-beacon";
  rig.root.userData.ap88SeatLayout = "two-seats-one-steering-wheel";
  return "authored-lektro-ap88-r4";
}

export function supportsRuntimeEquipmentVisual(equipmentId) {
  return equipmentId === AP88_EQUIPMENT_ID || supportsLegacyRuntimeEquipmentVisual(equipmentId);
}

export async function installRuntimeEquipmentVisual(rig, equipmentId) {
  if (equipmentId === AP88_EQUIPMENT_ID) return installAp88RuntimeVisual(rig);
  return installLegacyRuntimeEquipmentVisual(rig, equipmentId);
}
