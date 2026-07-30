import fs from "node:fs";
import * as THREE from "three";
import { buildAnimatedA1Jetway } from "../src/environment/animatedA1Jetway.js";

function requireTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: animated A1 verification is missing ${token}`);
  }
  return source;
}

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const runtimeCommand = packageJson.scripts?.["prepare:terminal4-runtime"] || "";
const generatorIndex = runtimeCommand.indexOf("prepare-terminal4-runtime.mjs");
const animationIndex = runtimeCommand.indexOf("prepare-a1-jetway-departure-animation.mjs");
if (!(generatorIndex >= 0 && animationIndex > generatorIndex)) {
  throw new Error("A1 animation preparation must run after the Terminal 4 component generator");
}

requireTokens("src/environment/sourcePlacedTerminal4Jetways.js", [
  'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js"',
  'if (jetway.g === "A1")',
  "const animatedA1Jetway = buildAnimatedA1Jetway",
  "group.userData.a1JetwayController",
  "group.userData.a1JetwayAnimationAuthority",
]);
requireTokens("src/environment/authoredTerminal4Visual.js", [
  "authoredTerminal4A1JetwayController",
  "authoredTerminal4A1JetwayAnimationAuthority",
]);
requireTokens("src/components/RampReadyStandupTrainerTerminal4.jsx", [
  "const jetwayRef = useRef",
  "Jetway departure sequence active",
  "a1JetwayController?.setDeployment",
  "const jetway = jetwayRef.current",
  "Jetway parked clear",
  "dataset.a1JetwayDeployment",
  "dataset.a1JetwayState",
]);

const material = () => new THREE.MeshStandardMaterial({ color: 0xffffff });
const materials = {
  shell: material(),
  innerShell: material(),
  cabin: material(),
  trim: material(),
  glass: material(),
  light: material(),
  bellows: material(),
  warning: material(),
  metal: material(),
  tire: material(),
  stair: material(),
};
const animated = buildAnimatedA1Jetway(THREE, materials, {
  x: 0,
  z: 0,
  yaw: 0.3,
  bridgeStart: 1.75,
  bridgeEnd: 24,
  rotundaY: 4.35,
  cabinY: 2.95,
});
const controller = animated.userData.controller;
if (!controller) throw new Error("Animated A1 controller was not created");
if (animated.userData.sourceScale !== 1) throw new Error("Animated A1 bridge must remain at source scale 1.00");

const samples = [];
for (const deployment of [1, 0.7, 0.5, 0.15, 0]) {
  controller.setDeployment(deployment);
  const contact = controller.getContactPosition();
  if (!contact.every(Number.isFinite)) throw new Error(`A1 contact point is invalid at deployment ${deployment}`);
  samples.push({ deployment, state: controller.getState(), contact });
}
const expectedStates = ["attached", "hood-clear", "telescoping", "rotating-to-park", "parked"];
for (let index = 0; index < expectedStates.length; index += 1) {
  if (samples[index].state !== expectedStates[index]) {
    throw new Error(`A1 deployment ${samples[index].deployment} produced ${samples[index].state}, expected ${expectedStates[index]}`);
  }
}
const attachedContact = samples[0].contact;
const parkedContact = samples.at(-1).contact;
const travel = Math.hypot(attachedContact[0] - parkedContact[0], attachedContact[2] - parkedContact[2]);
if (!(travel > 5)) throw new Error(`A1 animated contact head moved only ${travel.toFixed(2)} m`);
if (controller.getDeployment() !== 0) throw new Error("A1 controller did not retain parked deployment");

console.log(JSON.stringify({
  animationAuthority: animated.userData.animationAuthority,
  sourceScale: animated.userData.sourceScale,
  contactTravelMeters: Number(travel.toFixed(3)),
  samples,
}, null, 2));
console.log("Verified animated A1 departure sequence: attached, hood clear, telescope in, rotate to park, then release tug approach.");
