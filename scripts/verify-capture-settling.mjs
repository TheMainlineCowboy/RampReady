import { readFile } from "node:fs/promises";

const trainer = await readFile(new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url), "utf8");

function requireNumber(pattern, label) {
  const match = trainer.match(pattern);
  if (!match) throw new Error(`Capture-settling verification failed: could not resolve ${label}.`);
  const value = Number(match[1]);
  if (!Number.isFinite(value)) throw new Error(`Capture-settling verification failed: ${label} is not finite.`);
  return value;
}

const connectDistance = requireNumber(/const CONNECT_DISTANCE = ([0-9.]+);/, "connection distance");
const correctionRate = requireNumber(/const maxCaptureCorrection = ([0-9.]+) \* dt;/, "capture correction rate");
const snapThreshold = requireNumber(/captureOffset < ([0-9.]+)\) sim\.towOffsetLocal\.set\(0, 0, 0\);/, "capture snap threshold");

const requiredSnippets = [
  "sim.towOffsetLocal = captureState.delta.clone().applyAxisAngle(Y_AXIS, -sim.tug.rotation.y);",
  "const captureOffset = sim.towOffsetLocal.length();",
  "else sim.towOffsetLocal.multiplyScalar((captureOffset - maxCaptureCorrection) / captureOffset);",
  "const towOffset = sim.towOffsetLocal.clone().applyAxisAngle(Y_AXIS, sim.tug.rotation.y);",
];

for (const snippet of requiredSnippets) {
  const count = trainer.split(snippet).length - 1;
  if (count !== 1) {
    throw new Error(`Capture-settling verification failed: expected one runtime occurrence, found ${count}: ${snippet}`);
  }
}

if (connectDistance <= 0 || connectDistance > 0.5) {
  throw new Error(`Capture-settling verification failed: connection distance ${connectDistance.toFixed(3)} m is outside the 0-0.5 m capture envelope.`);
}
if (correctionRate < 0.24 || correctionRate > 0.35) {
  throw new Error(`Capture-settling verification failed: correction rate ${correctionRate.toFixed(3)} m/s is outside the 0.24-0.35 m/s stability envelope.`);
}
if (snapThreshold <= 0 || snapThreshold > 0.005) {
  throw new Error(`Capture-settling verification failed: snap threshold ${snapThreshold.toFixed(4)} m is too large or invalid.`);
}

const worstCaseSettleSeconds = Math.max(0, connectDistance - snapThreshold) / correctionRate;
if (worstCaseSettleSeconds > 1.75) {
  throw new Error(`Capture-settling verification failed: worst-case connection offset needs ${worstCaseSettleSeconds.toFixed(2)} s to seat, exceeding 1.75 s.`);
}

console.log(`Capture settling passed: ${connectDistance.toFixed(2)} m maximum offset seats in ${worstCaseSettleSeconds.toFixed(2)} s at ${correctionRate.toFixed(2)} m/s without teleporting.`);
