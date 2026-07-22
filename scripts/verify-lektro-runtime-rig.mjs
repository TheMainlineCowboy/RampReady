import * as THREE from "three";
import { LEKTRO_RIG_PROFILE, createProceduralLektroRig, validateTugRig } from "../src/tug/lektroRig.js";

const rig = createProceduralLektroRig(THREE);
const failures = validateTugRig(rig);

if (rig.root.name !== "RampReady_LektroRig") failures.push(`unexpected root name ${rig.root.name}`);
if (rig.captureAnchor.name !== "CaptureAnchor") failures.push("capture anchor is not explicitly named");
if (rig.operatorEye.name !== "OperatorEye") failures.push("operator eye is not explicitly named");
if (rig.cradleLift.name !== "CradleLift") failures.push("cradle group is not explicitly named");

const localCapture = rig.captureAnchor.position;
if (Math.abs(localCapture.z - LEKTRO_RIG_PROFILE.cradleOffset) > 1e-9) {
  failures.push(`capture anchor offset ${localCapture.z} does not match profile ${LEKTRO_RIG_PROFILE.cradleOffset}`);
}

rig.root.position.set(4, 0, 7);
rig.root.rotation.y = Math.PI / 2;
const captureWorld = rig.getCaptureWorld(new THREE.Vector3());
const expectedWorld = new THREE.Vector3(
  4 + LEKTRO_RIG_PROFILE.cradleOffset,
  LEKTRO_RIG_PROFILE.captureAnchor[1],
  7,
);
if (captureWorld.distanceTo(expectedWorld) > 1e-6) {
  failures.push(`capture world transform incorrect: ${captureWorld.toArray()} expected ${expectedWorld.toArray()}`);
}

rig.setSteering(0.31);
for (const pivot of rig.steeringPivots) {
  if (Math.abs(pivot.rotation.y - 0.31) > 1e-9) failures.push(`${pivot.name} did not receive steering angle`);
}

const wheelRotations = rig.rollingWheels.map((wheel) => wheel.rotation.x);
rig.rotateWheels(1.5);
rig.rollingWheels.forEach((wheel, index) => {
  if (Math.abs(wheel.rotation.x - wheelRotations[index]) < 0.1) failures.push(`${wheel.name} did not roll`);
});

rig.setLiftProgress(0.5);
if (Math.abs(rig.cradleLift.position.y - LEKTRO_RIG_PROFILE.liftTravel * 0.5) > 1e-9) failures.push("half lift progress is incorrect");
rig.setLiftProgress(3);
if (Math.abs(rig.cradleLift.position.y - LEKTRO_RIG_PROFILE.liftTravel) > 1e-9) failures.push("lift progress was not clamped high");
rig.setLiftProgress(-2);
if (Math.abs(rig.cradleLift.position.y) > 1e-9) failures.push("lift progress was not clamped low");

const anchorNames = new Set();
rig.root.traverse((node) => { if (node.name) anchorNames.add(node.name); });
for (const required of ["CaptureAnchor", "OperatorEye", "OperatorLook", "FrontSteer_L", "FrontSteer_R", "CradleLift"]) {
  if (!anchorNames.has(required)) failures.push(`missing required named node ${required}`);
}

if (failures.length) {
  console.error("RampReady Lektro runtime-rig verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`RampReady Lektro runtime-rig verification passed: ${rig.rollingWheels.length} wheels, ${rig.steeringPivots.length} steering pivots, capture ${rig.profile.cradleOffset.toFixed(2)} m, lift ${rig.profile.liftTravel.toFixed(2)} m.`);
