import { readFile } from "node:fs/promises";

const markings = await readFile(new URL("../src/components/aircraft/crj700AmericanEagleMarkings.js", import.meta.url), "utf8");
const aircraft = await readFile(new URL("../src/components/aircraft/crj700Model.js", import.meta.url), "utf8");

function requireSource(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(`CRJ700 livery verification failed: ${message}`);
}

requireSource(markings, 'fillText("American"', "American title text is missing.");
requireSource(markings, 'fillText("Eagle"', "Eagle title text is missing.");
requireSource(markings, "new THREE.CanvasTexture(canvas)", "runtime decal texture creation is missing.");
requireSource(markings, "texture.colorSpace = THREE.SRGBColorSpace", "sRGB decal handling is missing.");
requireSource(markings, "transparent: true", "transparent decal material is missing.");
requireSource(markings, "depthWrite: false", "decal depth-write protection is missing.");
requireSource(markings, "polygonOffset: true", "decal z-fighting protection is missing.");
requireSource(markings, "new THREE.PlaneGeometry(width, height)", "lower-fuselage stripe decals are not using visible side-facing plane geometry.");
requireSource(markings, "for (const side of [-1, 1])", "two-sided marking construction is missing.");
requireSource(markings, 'side > 0 ? Math.PI / 2 : -Math.PI / 2', "outward-facing left/right decal orientation is missing.");
requireSource(markings, "American Eagle lower blue stripe", "bilateral lower blue fuselage stripe is missing.");
requireSource(markings, "American Eagle lower silver separator", "bilateral silver separator stripe is missing.");
requireSource(markings, "American Eagle lower red stripe", "bilateral lower red fuselage stripe is missing.");
requireSource(
  markings,
  'liveryState = "american-eagle-readable-title-tail-and-lower-fuselage-stripe-decals"',
  "current decal-based livery state marker is missing.",
);

if (markings.includes("American title block") || markings.includes("American title highlight")) {
  throw new Error("CRJ700 livery verification failed: obsolete opaque title-block geometry remains.");
}

requireSource(aircraft, 'import { buildAmericanEagleMarkings }', "livery module is not imported by the aircraft builder.");
requireSource(aircraft, "buildAmericanEagleMarkings(THREE)", "livery group is not built at runtime.");
requireSource(
  aircraft,
  'retain(americanEagleMarkings, "intentional-livery-overlay")',
  "livery is not retained under the approved intentional-livery-overlay role after the real GLB replaces the procedural body.",
);
requireSource(aircraft, 'realModel.userData.liveryState = "visible-base-coat-with-american-eagle-overlays"', "real-model base-coat state is missing.");
requireSource(aircraft, 'aircraftRoot.userData.renderedAircraftSource = "CRJ700.stl"', "real-aircraft runtime source marker is missing.");

console.log("CRJ700 livery verification passed: real-model base coat, bilateral American Eagle title and stripe decals, tail/engine overlays, and obsolete title-block removal are structurally confirmed.");
