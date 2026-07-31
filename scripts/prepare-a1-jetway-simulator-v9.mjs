import fs from "node:fs";
import concourseA from "../src/environment/kphxV181/concourseA.js";

function requireTokens(path, tokens) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: committed A1 simulator pass is missing ${token}`);
  }
}

requireTokens("src/environment/animatedA1Jetway.js", [
  'import { buildAnimatedA1Jetway as buildV12 } from "./animatedA1JetwayV12.js"',
  "const root = buildV12(THREE, materials, layout)",
  "independent-source-scale-rotunda-telescope-lift-hood-bogie-runtime-assembly-v11",
  "phx-reference-light-corrugated-metal-yellow-safety-undercarriage-v12",
  "root.userData.visualModelVersion = 12",
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
  "dynamic-cabin-height-to-ramp-zero-v10",
  "persistent-controller-threshold-history-v10",
  "controller.getStateHistory",
]);
requireTokens("src/environment/animatedA1JetwayV11.js", [
  "A1 clean open stair tread",
  "A1 clean continuous handrail",
  "A1 clean stair stringer",
  "A1 compact cabin-side stair landing",
  "dynamic-open-tread-cabin-threshold-fit-v11",
  "clean-dynamic-open-tread-round-rail-service-stair-v11",
  "thresholdGapMeters",
  "currentCabinHeightMeters",
]);
requireTokens("src/environment/animatedA1JetwayV12.js", [
  "A1 PHX light corrugated outer shell V12",
  "A1 PHX corrugated cladding detail V12",
  "A1 PHX cabin raised roof cap",
  "A1 PHX compact yellow handrail",
  "A1 PHX hydraulic hose segment",
  "phx-light-corrugated-shell-yellow-undercarriage-compact-stair-cabin-roof-rail-hose-bundle-v12",
  "phx-reference-light-corrugated-metal-yellow-safety-undercarriage-v12",
  "compact-phx-open-tread-yellow-rail-v12",
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
  geometryAuthority: "committed PHX-reference A1 v12 visual module with light corrugated shells, yellow safety undercarriage, compact open-tread stairs and hydraulic detail",
  animationAuthority: "v11 clocked motion plus persistent ordered controller history",
  browserAuthority: "single-worker exact-production full-airport evidence with zero retries",
}, null, 2));
console.log(`Validated committed A1 simulator visual v12, preserved v11 motion, clean ramp contact and ${contactError.toFixed(3)} m CRJ door-contact error without mutating tracked source.`);
