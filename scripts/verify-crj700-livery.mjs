import { readFile } from "node:fs/promises";

const markings = await readFile(new URL("../src/components/aircraft/crj700AmericanEagleMarkings.js", import.meta.url), "utf8");
const aircraft = await readFile(new URL("../src/components/aircraft/crj700Model.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../src/components/aircraft/aircraftRuntimeLoader.js", import.meta.url), "utf8");
const contract = await readFile(new URL("../src/components/aircraft/aircraftAssetContract.js", import.meta.url), "utf8");

function requireSource(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(`CRJ700 livery verification failed: ${message}`);
}

// The procedural material remains a verified fallback only.
requireSource(markings, 'fillText("American"', "fallback American title text is missing.");
requireSource(markings, 'fillText("Eagle"', "fallback Eagle title text is missing.");
requireSource(markings, "new THREE.CanvasTexture(canvas)", "fallback runtime title texture creation is missing.");
requireSource(markings, "texture.colorSpace = THREE.SRGBColorSpace", "fallback sRGB title handling is missing.");
requireSource(markings, "createAmericanEagleSurfaceMaterial", "fallback surface-conforming livery export is missing.");
requireSource(markings, "material.onBeforeCompile", "fallback real-airframe shader attachment is missing.");
requireSource(markings, "vRampReadyObjectPosition", "fallback object-space surface projection is missing.");
requireSource(markings, "rrUpperBlue", "fallback upper blue fuselage stripe mask is missing.");
requireSource(markings, "rrLowerBlue", "fallback lower blue fuselage stripe mask is missing.");
requireSource(markings, "rrSeparator", "fallback silver separator mask is missing.");
requireSource(markings, "rrLowerRed", "fallback red fuselage stripe mask is missing.");
requireSource(markings, "rrTitleDomain", "fallback bilateral title surface projection is missing.");
requireSource(markings, "if (rrP.x > 0.0) rrTitleU = 1.0 - rrTitleU;", "fallback left/right title orientation correction is missing.");
requireSource(markings, "rrTail", "fallback surface-projected tail treatment is missing.");
requireSource(markings, "rrEngine", "fallback surface-projected engine treatment is missing.");
requireSource(markings, "rrAntiGlare", "fallback surface-projected nose anti-glare treatment is missing.");
requireSource(markings, 'liveryState = "american-eagle-surface-shader-no-floating-overlays"', "fallback surface livery state marker is missing.");

if (markings.includes("if (rrP.x < 0.0) rrTitleU = 1.0 - rrTitleU;")) {
  throw new Error("CRJ700 livery verification failed: mirrored fallback bilateral title mapping remains.");
}
for (const forbidden of ["new THREE.PlaneGeometry", "new THREE.BoxGeometry", "continuous contour ribbon", "intentional-livery-overlay"]) {
  if (markings.includes(forbidden)) throw new Error(`CRJ700 livery verification failed: floating overlay implementation remains: ${forbidden}`);
}

requireSource(aircraft, 'import { createAmericanEagleSurfaceMaterial }', "fallback livery module is not imported by the aircraft builder.");
requireSource(aircraft, "applyFallbackMaterial: (model) => applyVisibleBaseLivery(THREE, model)", "procedural livery is not isolated to the fallback callback.");
requireSource(aircraft, "result.preserveMaterials", "authored material policy is not consumed by the active aircraft builder.");
requireSource(aircraft, '"authored-materials-preserved"', "authored-material livery state marker is missing.");
requireSource(aircraft, "aircraftRoot.userData.authoredMaterialsPreserved = result.preserveMaterials", "authored material preservation is not exposed in runtime diagnostics.");
requireSource(loader, "if (!candidate.preserveMaterials", "fallback livery application is not guarded by the candidate material policy.");
requireSource(contract, 'id: "user-painted-crj700"', "authored aircraft candidate is missing.");
requireSource(contract, "preserveMaterials: true", "authored aircraft candidate does not preserve its supplied materials.");

if (aircraft.includes("applyVisibleBaseLivery(THREE, realModel);")) {
  throw new Error("CRJ700 livery verification failed: active runtime still repaints every selected aircraft.");
}
if (aircraft.includes('retain(americanEagleMarkings, "intentional-livery-overlay")')) {
  throw new Error("CRJ700 livery verification failed: retained floating livery group still exists.");
}

console.log("CRJ700 livery verification passed: the user-authored American Eagle materials and textures are preserved unchanged, the procedural surface shader is isolated to the fallback GLB, and no floating livery planes or boxes remain.");
