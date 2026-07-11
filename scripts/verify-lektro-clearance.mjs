import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

function numberFrom(pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Missing ${label} geometry definition.`);
  const value = Number(match[1]);
  if (!Number.isFinite(value)) throw new Error(`Invalid ${label} geometry value.`);
  return value;
}

const cradleZ = numberFrom(/const CRADLE_Z = ([0-9.]+);/, "cradle center");
const bodyDepth = numberFrom(/box\(2\.35, 0\.42, ([0-9.]+), red, 0, 0\.55, -0\.15\)/, "main tug body depth");
const frontAxleZ = numberFrom(/front = cyl\(0\.5, 0\.38, 0x0c0d0f, s \* 1\.12, 0\.47, ([0-9.]+)/, "front axle");
const cradleBridgeZ = numberFrom(/box\(1\.8, 0\.1, 0\.95, black, 0, 0\.22, ([0-9.]+)/, "cradle bridge");
const captureDeckDepth = numberFrom(/box\(1\.7, 0\.12, ([0-9.]+), black, 0, 0\.34, CRADLE_Z\)/, "capture deck depth");

const bodyCenterZ = -0.15;
const bodyFrontZ = bodyCenterZ + bodyDepth / 2;
const captureDeckRearZ = cradleZ - captureDeckDepth / 2;
const bodyToCaptureClearance = captureDeckRearZ - bodyFrontZ;
const axleToCaptureClearance = captureDeckRearZ - frontAxleZ;
const bridgeToCaptureGap = captureDeckRearZ - cradleBridgeZ;

const failures = [];
if (bodyToCaptureClearance < 0.15) failures.push(`main body intrudes into cradle zone (${bodyToCaptureClearance.toFixed(3)} m clearance)`);
if (axleToCaptureClearance < 0.45) failures.push(`front axle is too close to captured nose point (${axleToCaptureClearance.toFixed(3)} m clearance)`);
if (bridgeToCaptureGap < 0.15) failures.push(`cradle bridge reaches into capture deck (${bridgeToCaptureGap.toFixed(3)} m gap)`);
if (cradleZ <= bodyFrontZ) failures.push("cradle center is not ahead of the tug body");

if (failures.length) {
  console.error("RampReady Lektro clearance verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `RampReady Lektro clearance passed: body-to-capture ${bodyToCaptureClearance.toFixed(3)} m, ` +
  `axle-to-capture ${axleToCaptureClearance.toFixed(3)} m, bridge gap ${bridgeToCaptureGap.toFixed(3)} m.`
);
