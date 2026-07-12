import { readFile } from "node:fs/promises";

const trainerPath = new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url);
const source = await readFile(trainerPath, "utf8");

function requireNumber(pattern, label) {
  const match = source.match(pattern);
  if (!match) {
    console.error(`Lektro proportion verification failed: missing ${label}.`);
    process.exit(1);
  }
  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    console.error(`Lektro proportion verification failed: invalid ${label}.`);
    process.exit(1);
  }
  return value;
}

const bodyWidth = requireNumber(/box\((\d+(?:\.\d+)?), 0\.42, 5\.5, red, 0, 0\.55, -0\.15\)/, "main body width");
const bodyLength = requireNumber(/box\(2\.35, 0\.42, (\d+(?:\.\d+)?), red, 0, 0\.55, -0\.15\)/, "main body length");
const cradleZ = requireNumber(/const CRADLE_Z = (-?\d+(?:\.\d+)?);/, "cradle center position");
const bridgeZ = requireNumber(/box\(1\.8, 0\.1, 0\.95, black, 0, 0\.22, (-?\d+(?:\.\d+)?), -0\.08\)/, "cradle bridge position");
const frontAxleZ = requireNumber(/const front = cyl\(0\.5, 0\.38, 0x0c0d0f, s \* 1\.12, 0\.47, (-?\d+(?:\.\d+)?),/, "front axle position");
const cradleWidth = requireNumber(/box\((\d+(?:\.\d+)?), 0\.12, 0\.9, black, 0, 0\.34, CRADLE_Z\)/, "cradle tray width");
const guideOffset = requireNumber(/box\(0\.16, 0\.56, 0\.85, yellow, s \* (\d+(?:\.\d+)?), 0\.55, CRADLE_Z/, "cradle guide offset");

const bodyRatio = bodyLength / bodyWidth;
if (bodyRatio < 2.1 || bodyRatio > 2.6) {
  console.error(`Lektro proportion verification failed: body length/width ratio ${bodyRatio.toFixed(2)} is outside the expected compact towbarless range.`);
  process.exit(1);
}

const axleToCradle = cradleZ - frontAxleZ;
if (axleToCradle < 1.0 || axleToCradle > 1.8) {
  console.error(`Lektro proportion verification failed: cradle is ${axleToCradle.toFixed(2)} m ahead of the front axle; expected 1.0-1.8 m.`);
  process.exit(1);
}

if (bridgeZ >= cradleZ || cradleZ - bridgeZ > 1.0) {
  console.error("Lektro proportion verification failed: cradle bridge is detached from the capture tray.");
  process.exit(1);
}

if (cradleWidth < 1.55 || cradleWidth > 1.9) {
  console.error(`Lektro proportion verification failed: cradle tray width ${cradleWidth.toFixed(2)} m is outside the expected nose-gear capture range.`);
  process.exit(1);
}

if (guideOffset * 2 >= cradleWidth || guideOffset < 0.5) {
  console.error("Lektro proportion verification failed: cradle guides do not leave a realistic centered nose-wheel channel.");
  process.exit(1);
}

console.log(`Lektro proportion verification passed: body ${bodyLength.toFixed(2)} x ${bodyWidth.toFixed(2)} m, axle-to-cradle ${axleToCradle.toFixed(2)} m, tray ${cradleWidth.toFixed(2)} m.`);
