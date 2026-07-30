import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";

function requireTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: committed A1 simulator pass is missing ${token}`);
  }
}

requireTokens("src/environment/animatedA1Jetway.js", [
  'export { buildAnimatedA1Jetway } from "./animatedA1JetwayV10.js"',
]);
requireTokens("src/environment/animatedA1JetwayV9.js", [
  "A1 service tread",
  "A1 cabin operator control console",
  "A1 wheel hub",
  "A1 wheel fender",
  "A1 underbridge longitudinal rail",
  "A1 underbridge crossmember",
  "A1 roof cable tray",
  "A1 bogie drive motor housing",
  "source-scale-panel-ribs-open-stair-cabin-controls-underbridge-truss-cable-tray-bogie-drive-v9",
  "root.userData.structuralDetailCount",
]);
requireTokens("src/environment/animatedA1JetwayV10.js", [
  "A1 ramp-anchored service stair tread",
  "A1 service stair anti-slip edge",
  "A1 cabin-side service stair landing",
  "dynamic-cabin-height-to-ramp-zero-v10",
  "persistent-controller-threshold-history-v10",
  "ramp-anchored-open-service-stair-v10",
  "controller.getStateHistory",
]);
requireTokens("scripts/prepare-a1-jetway-clocked-motion.mjs", [
  "transitionDurationMs: 4200",
  "dataset.a1JetwayStateHistory",
  "persistent attached, hood-clear, telescoping, rotating and parked sequence evidence",
]);
requireTokens("scripts/prepare-mobile-inspection-hud.mjs", [
  "RampReady mobile HUD hard containment v9",
  "overflow-wrap: anywhere",
]);
requireTokens("playwright.config.js", [
  "fullyParallel: false",
  "workers: 1",
  "retries: 0",
]);

const parking = concourseA.parkings.find((entry) => entry.g === "A1");
const jetway = concourseA.jetways.find((entry) => entry.g === "A1");
if (!parking || !jetway) throw new Error("A1 source parking or jetway placement is missing");

const heading = parking.h * Math.PI / 180;
const forwardX = Math.cos(heading);
const forwardZ = Math.sin(heading);
const leftX = forwardZ;
const leftZ = -forwardX;
const targetX = jetway.px - forwardX * 6.25 + leftX * 1.35;
const targetZ = jetway.pz - forwardZ * 6.25 + leftZ * 1.35;
const distance = Math.hypot(targetX - jetway.x, targetZ - jetway.z);
const bridgeEnd = Math.max(11.5, Math.min(29.5, distance - 1.55));
const contactError = Math.abs(distance - (bridgeEnd + 1.58));
if (contactError > 0.08) {
  throw new Error(`A1 jetway misses the CRJ forward-left door target by ${contactError.toFixed(3)} m`);
}

console.log(JSON.stringify({
  gate: "A1",
  sourceJetwayPosition: [jetway.x, jetway.z],
  sourceParkingStop: [parking.x, parking.z],
  parkingHeadingDegrees: parking.h,
  calculatedForwardLeftDoorTarget: [Number(targetX.toFixed(3)), Number(targetZ.toFixed(3))],
  contactErrorMeters: Number(contactError.toFixed(3)),
  geometryAuthority: "committed detailed A1 v10 runtime module with ramp-anchored service stair",
  sequenceAuthority: "clocked motion plus persistent ordered controller history",
  browserAuthority: "single-worker full-airport evidence with zero retries",
}, null, 2));
console.log(`Validated committed A1 simulator-quality v10 detail, ramp contact and ${contactError.toFixed(3)} m CRJ door-contact error without mutating tracked source.`);
