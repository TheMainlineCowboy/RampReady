import { appendFile, readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

const trackedRequirements = [
  ["physical drive direction", "const signedDirection = drive.direction;"],
  ["frame-rate-stable idle floor", "if (Math.abs(sim.velocity) < 0.01 && usefulThrottle === 0) sim.velocity = 0;"],
  ["FWD pushback stop target", "const STOP_Z = 52;"],
  ["FWD remaining-distance calculation", "const stopRemaining = STOP_Z - sim.aircraft.position.z;"],
  ["FWD completion gate", "if (towActive && sim.aircraft.position.z >= STOP_Z - 0.5) {"],
  ["full pushback-route ramp", "new THREE.PlaneGeometry(90, 140)"],
  ["full pushback-route centerline", "new THREE.PlaneGeometry(0.16, 130)"],
  ["bounded capture correction", "const maxCaptureCorrection = 0.28 * dt;"],
  ["wheelbase-constrained tow yaw", "const requestedYawStep = lateralNoseTravel / 11.2;"],
  ["attachment history reset", "sim.lastAttachedNose = null;"],
];

const missing = trackedRequirements
  .filter(([, marker]) => !source.includes(marker))
  .map(([label]) => label);

const state = missing.length === 0 ? "tracked source complete" : "build-time transformation still required";
const detail = missing.length === 0
  ? "All verified towing, capture, route, and ramp markers are committed directly in RampReadyTrainerStable.jsx."
  : `Missing from tracked trainer source: ${missing.join(", ")}.`;

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `### RampReady source architecture\n- State: **${state}**\n- ${detail}\n`,
    "utf8",
  );
}

console.log(`RampReady source architecture: ${state}.`);
console.log(detail);

// This reporter intentionally remains non-failing while the migration is in progress.
// The production build's prepared-runtime verifiers remain the safety gate until the
// corrected implementation is committed directly to the trainer source.
