import fs from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_PATH = "public/models/airport-jetway/Airport_Jetway.glb";
const PARTS = ["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"];
const LEGACY_TERMINAL_CENTER_Y_METERS = 4.35;
const CURRENT_FLEET_GROUND_CORRECTION_METERS = -0.06;

const bytes = fs.readFileSync(MODEL_PATH);
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const gltf = await new Promise((resolve, reject) => {
  new GLTFLoader().parse(arrayBuffer, "", resolve, reject);
});
const scene = gltf.scene;
scene.updateMatrixWorld(true);

const rotunda = scene.getObjectByName("Rotunda");
const cab = scene.getObjectByName("Cab");
if (!rotunda || !cab) throw new Error("Exact Airport_Jetway.glb is missing Rotunda or Cab");

const rotundaCenterBefore = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
const cabCenterBefore = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
const longitudinal = cabCenterBefore.clone().sub(rotundaCenterBefore);
longitudinal.y = 0;
if (longitudinal.lengthSq() < 1) throw new Error("Exact jetway source longitudinal axis is invalid");
longitudinal.normalize();
const axisCorrectionRadians = -Math.atan2(longitudinal.x, longitudinal.z);
scene.rotation.y = axisCorrectionRadians;
scene.updateMatrixWorld(true);

const rotundaCenterAfterYaw = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
const sourceBoundsAfterYaw = new THREE.Box3().setFromObject(scene);
scene.position.set(
  -rotundaCenterAfterYaw.x,
  -sourceBoundsAfterYaw.min.y,
  -rotundaCenterAfterYaw.z,
);
scene.updateMatrixWorld(true);

const boundsFor = (name) => {
  const part = scene.getObjectByName(name);
  if (!part) throw new Error(`Exact Airport_Jetway.glb is missing ${name}`);
  const box = new THREE.Box3().setFromObject(part);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    minYNormalized: box.min.y,
    maxYNormalized: box.max.y,
    centerYNormalized: center.y,
    minYLiveAfterGroundCorrection: box.min.y + CURRENT_FLEET_GROUND_CORRECTION_METERS,
    maxYLiveAfterGroundCorrection: box.max.y + CURRENT_FLEET_GROUND_CORRECTION_METERS,
    centerYLiveAfterGroundCorrection: center.y + CURRENT_FLEET_GROUND_CORRECTION_METERS,
    heightMeters: size.y,
  };
};

const normalizedBounds = new THREE.Box3().setFromObject(scene);
const parts = Object.fromEntries(PARTS.map((name) => [name, boundsFor(name)]));
const report = {
  authority: "exact-airport-jetway-vertical-geometry-inspection-v1",
  modelPath: MODEL_PATH,
  axisCorrectionRadians,
  overall: {
    minYNormalized: normalizedBounds.min.y,
    maxYNormalized: normalizedBounds.max.y,
    minYLiveAfterGroundCorrection: normalizedBounds.min.y + CURRENT_FLEET_GROUND_CORRECTION_METERS,
    maxYLiveAfterGroundCorrection: normalizedBounds.max.y + CURRENT_FLEET_GROUND_CORRECTION_METERS,
  },
  legacyTerminalCenterYMeters: LEGACY_TERMINAL_CENTER_Y_METERS,
  currentFleetGroundCorrectionMeters: CURRENT_FLEET_GROUND_CORRECTION_METERS,
  exactRotundaCenterVsLegacyTerminalCenterMeters:
    parts.Rotunda.centerYLiveAfterGroundCorrection - LEGACY_TERMINAL_CENTER_Y_METERS,
  parts,
};

console.log(`[RampReady] Exact jetway vertical geometry ${JSON.stringify(report)}`);
