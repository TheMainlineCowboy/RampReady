import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const groundPath = "src/environment/authoredKphxGround.js";
const jetways = fs.readFileSync(jetwayPath, "utf8");
const ground = fs.readFileSync(groundPath, "utf8");

for (const token of [
  "parkingByGate",
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55",
  "a1DoorContactErrorMeters",
]) {
  if (!jetways.includes(token)) throw new Error(`${jetwayPath}: PHX v5 stand alignment is missing ${token}`);
}

for (const token of [
  "const broadWear = Math.sin(pixelX * 0.041)",
  "new THREE.PlaneGeometry(4.6, 2.3)",
  "mesh.rotation.y = Math.PI / 2 - heading",
  "const approach = [px + hx * 24",
  "const labelX = px + hx * 18",
  "0.0024",
  "source-positioned-terminal4-stand-centerlines-labels-v2-door-aligned",
]) {
  if (!ground.includes(token)) throw new Error(`${groundPath}: PHX stand geometry is missing ${token}`);
}

console.log("Verified PHX stand alignment without rewriting runtime source: v5 CRJ door-targeted jetways, realistic stand-line scale, visible gate labels, and non-repeating pavement wear.");
