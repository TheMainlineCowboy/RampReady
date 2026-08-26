import * as THREE from "three";
import {
  LEKTRO_RIG_PROFILE,
  STANDUP_RIG_PROFILE,
  MANAGER_KUBOTA_RIG_PROFILE,
  createProceduralLektroRig,
  validateTugRig,
} from "../src/tug/lektroRig.js";

const failures = [];

function verifyRig(id, expectedProfile, expectedLayout, expectedWheels, expectedSteerPivots, expectedSteerPrefix) {
  const rig = createProceduralLektroRig(THREE, id);
  failures.push(...validateTugRig(rig).map((failure) => `${id}: ${failure}`));
  if (rig.profile !== expectedProfile) failures.push(`${id}: wrong physics profile`);
  if (rig.profile.steeringLayout !== expectedLayout) failures.push(`${id}: expected ${expectedLayout}, got ${rig.profile.steeringLayout}`);
  if (rig.rollingWheels.length !== expectedWheels) failures.push(`${id}: expected ${expectedWheels} rolling wheels`);
  if (rig.steeringPivots.length !== expectedSteerPivots) failures.push(`${id}: expected ${expectedSteerPivots} steering pivots`);
  if (rig.captureAnchor.name !== "CaptureAnchor") failures.push(`${id}: capture anchor not named`);
  if (rig.operatorEye.name !== "OperatorEye") failures.push(`${id}: operator eye not named`);

  rig.setSteering(0.31);
  for (const pivot of rig.steeringPivots) {
    if (!pivot.name.startsWith(expectedSteerPrefix)) failures.push(`${id}: unexpected steer pivot ${pivot.name}`);
    const expected = rig.profile.steeringMode === "rear" ? -0.31 : 0.31;
    if (Math.abs(pivot.rotation.y - expected) > 1e-9) failures.push(`${id}: ${pivot.name} received wrong steering sign`);
  }

  const before = rig.rollingWheels.map((wheel) => wheel.rotation.x);
  rig.rotateWheels(1.2);
  rig.rollingWheels.forEach((wheel, index) => {
    if (Math.abs(wheel.rotation.x - before[index]) < 0.1) failures.push(`${id}: ${wheel.name} did not roll`);
  });
  return rig;
}

const lektro = verifyRig("lektro-88", LEKTRO_RIG_PROFILE, "rear-pair", 4, 2, "RearSteer_");
const standup = verifyRig("standup-tug", STANDUP_RIG_PROFILE, "rear-single", 3, 1, "RearSteer_");
const kubota = verifyRig("manager-kubota", MANAGER_KUBOTA_RIG_PROFILE, "front-pair", 4, 2, "FrontSteer_");

if (lektro.profile.maxSteerAngle < THREE.MathUtils.degToRad(80)) failures.push("LEKTRO rear steering does not reach near-90-degree lock");
if (standup.profile.maxSteerAngle < THREE.MathUtils.degToRad(80)) failures.push("stand-up rear steering does not reach near-90-degree lock");
if (standup.steeringPivots[0]?.name !== "RearSteer_C") failures.push("stand-up must use one center rear steering wheel");
if (kubota.profile.steeringMode !== "front") failures.push("manager Kubota must remain front steering");

lektro.setLiftProgress(0.5);
if (Math.abs(lektro.cradleLift.position.y - LEKTRO_RIG_PROFILE.liftTravel * 0.5) > 1e-9) failures.push("LEKTRO lift travel is incorrect");
standup.setLiftProgress(0.5);
if (Math.abs(standup.cradleLift.position.y - STANDUP_RIG_PROFILE.liftTravel * 0.5) > 1e-9) failures.push("stand-up lift travel is incorrect");

if (failures.length) {
  console.error("RampReady vehicle runtime-rig verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RampReady vehicle runtime-rig verification passed: LEKTRO 88 dual rear steer, stand-up single center rear steer, and manager Kubota front steer are all active with their correct wheel layouts.");
