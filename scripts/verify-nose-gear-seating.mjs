import { readFile } from "node:fs/promises";

const trainer = await readFile(new URL("../src/components/RampReadyTrainerStable.jsx", import.meta.url), "utf8");
const aircraft = await readFile(new URL("../src/components/aircraft/crj700Model.js", import.meta.url), "utf8");
const noseGear = await readFile(new URL("../src/components/aircraft/crj700NoseGear.js", import.meta.url), "utf8");

function requireNumber(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Nose-gear seating verification failed: could not resolve ${label}.`);
  const value = Number(match[1]);
  if (!Number.isFinite(value)) throw new Error(`Nose-gear seating verification failed: ${label} is not finite.`);
  return value;
}

const sceneScale = requireNumber(trainer, /aircraft\.scale\.set\(([-\d.]+),\s*[-\d.]+,\s*[-\d.]+\)/, "scene aircraft scale");
const modelScale = requireNumber(aircraft, /const PROCEDURAL_INTERNAL_SCALE = ([-\d.]+);/, "procedural landing-gear scale");
if (!aircraft.includes("group.scale.setScalar(PROCEDURAL_INTERNAL_SCALE)")) {
  throw new Error("Nose-gear seating verification failed: procedural landing gear is not using the declared internal scale.");
}
if (!aircraft.includes("retainedProceduralChildren.add") || !aircraft.includes("retainedProceduralChildren.has(child)")) {
  throw new Error("Nose-gear seating verification failed: retained procedural landing-gear path is missing.");
}
if (!aircraft.includes("buildCRJ700NoseGear(THREE)") || !aircraft.includes("retain(detailedNoseGear)")) {
  throw new Error("Nose-gear seating verification failed: detailed CRJ700 nose gear is not retained after real-model load.");
}
if (!noseGear.includes("preserveTowKinematics = true") || !noseGear.includes("noseGearCaptureOrigin = [0, 0, 0]")) {
  throw new Error("Nose-gear seating verification failed: detailed nose gear does not preserve the established tow-capture origin.");
}
const effectiveScale = sceneScale * modelScale;

const deckMatch = trainer.match(/box\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*black,\s*0,\s*([-\d.]+),\s*CRADLE_Z\)\)/);
if (!deckMatch) throw new Error("Nose-gear seating verification failed: capture deck geometry was not found.");
const deckWidth = Number(deckMatch[1]);
const deckHeight = Number(deckMatch[2]);
const deckCenterY = Number(deckMatch[4]);
const deckTop = deckCenterY + deckHeight / 2;

const wheelMatch = noseGear.match(/cylinder\(([-\d.]+),\s*[-\d.]+,\s*([-\d.]+),\s*tire[^\n]*\);[\s\S]*?wheel\.position\.set\(side \* ([-\d.]+),\s*([-\d.]+),\s*[-\d.]+\)/);
if (!wheelMatch) throw new Error("Nose-gear seating verification failed: detailed retained CRJ nose-wheel geometry was not found.");
const wheelRadius = Number(wheelMatch[1]) * effectiveScale;
const wheelDepth = Number(wheelMatch[2]) * effectiveScale;
const wheelCenterX = Number(wheelMatch[3]) * effectiveScale;
const wheelCenterY = Number(wheelMatch[4]) * effectiveScale;
const wheelBottom = wheelCenterY - wheelRadius;
const wheelTop = wheelCenterY + wheelRadius;
const wheelOuterX = wheelCenterX + wheelDepth / 2;

const armMatch = trainer.match(/box\(0\.16,\s*0\.56,\s*0\.85,\s*yellow,\s*s \* ([-\d.]+),/);
if (!armMatch) throw new Error("Nose-gear seating verification failed: cradle guide-arm geometry was not found.");
const armCenterX = Number(armMatch[1]);
const armInnerX = armCenterX - 0.16 / 2;

const verticalEngagement = Math.min(wheelTop, deckTop) - Math.max(wheelBottom, deckCenterY - deckHeight / 2);
const lateralDeckMargin = deckWidth / 2 - wheelOuterX;
const guideArmClearance = armInnerX - wheelOuterX;

if (wheelBottom < -0.03 || wheelBottom > 0.09) {
  throw new Error(`Nose-gear seating verification failed: wheel contact height ${wheelBottom.toFixed(3)} m is outside the ground-contact envelope.`);
}
if (verticalEngagement < 0.08 || verticalEngagement > wheelRadius * 1.5) {
  throw new Error(`Nose-gear seating verification failed: deck/wheel vertical engagement ${verticalEngagement.toFixed(3)} m is implausible.`);
}
if (lateralDeckMargin < 0.25) {
  throw new Error(`Nose-gear seating verification failed: only ${lateralDeckMargin.toFixed(3)} m lateral deck margin remains.`);
}
if (guideArmClearance < 0.08 || guideArmClearance > 0.30) {
  throw new Error(`Nose-gear seating verification failed: guide-arm clearance ${guideArmClearance.toFixed(3)} m is outside the capture envelope.`);
}

console.log(`Nose-gear seating passed for retained detailed gear: effective scale ${effectiveScale.toFixed(3)}, wheel contact ${wheelBottom.toFixed(3)} m, deck engagement ${verticalEngagement.toFixed(3)} m, lateral margin ${lateralDeckMargin.toFixed(3)} m, guide clearance ${guideArmClearance.toFixed(3)} m.`);
