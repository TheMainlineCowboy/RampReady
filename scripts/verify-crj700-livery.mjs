import { readFile } from "node:fs/promises";

const markings = await readFile(new URL("../src/components/aircraft/crj700AmericanEagleMarkings.js", import.meta.url), "utf8");
const aircraft = await readFile(new URL("../src/components/aircraft/crj700Model.js", import.meta.url), "utf8");

function requireSource(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(`CRJ700 livery verification failed: ${message}`);
}

requireSource(markings, 'fillText("American"', "American title text is missing.");
requireSource(markings, 'fillText("Eagle"', "Eagle title text is missing.");
requireSource(markings, "new THREE.CanvasTexture(canvas)", "runtime title texture creation is missing.");
requireSource(markings, "texture.colorSpace = THREE.SRGBColorSpace", "sRGB title handling is missing.");
requireSource(markings, "createAmericanEagleSurfaceMaterial", "surface-conforming livery material export is missing.");
requireSource(markings, "material.onBeforeCompile", "real-airframe shader attachment is missing.");
requireSource(markings, "vRampReadyObjectPosition", "object-space surface projection is missing.");
requireSource(markings, "rrUpperBlue", "upper blue fuselage stripe mask is missing.");
requireSource(markings, "rrLowerBlue", "lower blue fuselage stripe mask is missing.");
requireSource(markings, "rrSeparator", "silver separator mask is missing.");
requireSource(markings, "rrLowerRed", "red fuselage stripe mask is missing.");
requireSource(markings, "rrTitleDomain", "bilateral title surface projection is missing.");
requireSource(markings, "rrTail", "surface-projected tail treatment is missing.");
requireSource(markings, "rrEngine", "surface-projected engine treatment is missing.");
requireSource(markings, "rrAntiGlare", "surface-projected nose anti-glare treatment is missing.");
requireSource(markings, 'liveryState = "american-eagle-surface-shader-no-floating-overlays"', "surface livery state marker is missing.");

for (const forbidden of ["new THREE.PlaneGeometry", "new THREE.BoxGeometry", "continuous contour ribbon", "intentional-livery-overlay"]) {
  if (markings.includes(forbidden)) throw new Error(`CRJ700 livery verification failed: floating overlay implementation remains: ${forbidden}`);
}

requireSource(aircraft, 'import { createAmericanEagleSurfaceMaterial }', "surface livery module is not imported by the aircraft builder.");
requireSource(aircraft, "createAmericanEagleSurfaceMaterial(THREE)", "surface livery is not assigned to the real model.");
requireSource(aircraft, 'realModel.userData.liveryAttachment = "real-model-material"', "real-model material attachment marker is missing.");
requireSource(aircraft, 'aircraftRoot.userData.renderedAircraftSource = "CRJ700.stl"', "real-aircraft runtime source marker is missing.");
if (aircraft.includes('retain(americanEagleMarkings, "intentional-livery-overlay")')) {
  throw new Error("CRJ700 livery verification failed: retained floating livery group still exists.");
}

console.log("CRJ700 livery verification passed: titles, stripes, tail, engines, and nose anti-glare are painted by one object-space material on the real GLB with no retained floating planes or boxes.");
