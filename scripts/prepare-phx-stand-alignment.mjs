import fs from "node:fs";

function replaceOnce(path, oldText, newText, marker) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${path}: PHX stand-alignment anchor is missing for ${marker}`);
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

replaceOnce(
  "src/environment/sourcePlacedTerminal4Jetways.js",
  `  const materials = createMaterials(THREE, textures);
  const transforms = {
    rotunda: [], rotundaRoof: [], outer: [], inner: [], cabin: [], cabinRoof: [], glass: [],
    frameHorizontal: [], frameVertical: [], bellowsHorizontal: [], bellowsVertical: [],
    supportColumns: [], supportFeet: [], bogies: [], wheels: [], lights: [], steps: [], rails: [],
  };
  let highDetailCount = 0;

  for (const jetway of jetways) {
    let dx = jetway.px - jetway.x;
    let dz = jetway.pz - jetway.z;`,
  `  const materials = createMaterials(THREE, textures);
  const transforms = {
    rotunda: [], rotundaRoof: [], outer: [], inner: [], cabin: [], cabinRoof: [], glass: [],
    frameHorizontal: [], frameVertical: [], bellowsHorizontal: [], bellowsVertical: [],
    supportColumns: [], supportFeet: [], bogies: [], wheels: [], lights: [], steps: [], rails: [],
  };
  const parkingByGate = new Map(
    [...concourseA.parkings, ...concourseB.parkings].map((parking) => [parking.g, parking]),
  );
  const CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35;
  const CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35;
  const AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65;
  let highDetailCount = 0;

  for (const jetway of jetways) {
    const parking = parkingByGate.get(jetway.g);
    const parkingHeading = THREE.MathUtils.degToRad(parking?.h ?? 0);
    const forwardX = Math.cos(parkingHeading);
    const forwardZ = Math.sin(parkingHeading);
    const leftX = forwardZ;
    const leftZ = -forwardX;
    const targetX = jetway.px - forwardX * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftX * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
    const targetZ = jetway.pz - forwardZ * CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS + leftZ * CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS;
    let dx = targetX - jetway.x;
    let dz = targetZ - jetway.z;`,
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `    // Tug-height pavement must not depend on the airport-wide aerial, which is
    // only about one source pixel per 1.2-1.3 meters. Convert the supplied clean
    // concrete strip into an opaque, neutral apron tile with crisp authored joints.
    const detail = Math.max(108, Math.min(198, 158 + (luminance - meanLuminance) * 0.72 - darkness * 0.10));
    detailPixels.data[index] = Math.min(255, detail + 5);
    detailPixels.data[index + 1] = Math.min(255, detail + 4);
    detailPixels.data[index + 2] = Math.min(255, detail + 1);
    detailPixels.data[index + 3] = 255;`,
  `    // Tug-height pavement must not depend on the airport-wide aerial, which is
    // only about one source pixel per 1.2-1.3 meters. Convert the supplied clean
    // concrete strip into an opaque apron tile, then add deterministic broad wear
    // and fine grain so the same slab atlas does not read as a repeated grid.
    const pixel = index / 4;
    const pixelX = pixel % sourceCanvas.width;
    const pixelY = Math.floor(pixel / sourceCanvas.width);
    const broadWear = Math.sin(pixelX * 0.041) * 7.5
      + Math.cos(pixelY * 0.033) * 6
      + Math.sin((pixelX + pixelY) * 0.017) * 4;
    const hash = ((pixelX * 374761393 + pixelY * 668265263) ^ ((pixelX + pixelY) * 1274126177)) >>> 0;
    const grain = (hash % 19) - 9;
    const detail = Math.max(104, Math.min(202,
      156 + (luminance - meanLuminance) * 0.68 - darkness * 0.10 + broadWear + grain * 0.38,
    ));
    detailPixels.data[index] = Math.min(255, detail + 5);
    detailPixels.data[index + 1] = Math.min(255, detail + 4);
    detailPixels.data[index + 2] = Math.min(255, detail + 1);
    detailPixels.data[index + 3] = 255;`,
  "const broadWear = Math.sin(pixelX * 0.041)",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `  const geometry = new THREE.PlaneGeometry(6.4, 3.2);
  geometry.rotateX(-Math.PI / 2);`,
  `  const geometry = new THREE.PlaneGeometry(4.6, 2.3);
  geometry.rotateX(-Math.PI / 2);`,
  "new THREE.PlaneGeometry(4.6, 2.3)",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `  mesh.rotation.y = -heading;`,
  `  mesh.rotation.y = Math.PI / 2 - heading;`,
  "mesh.rotation.y = Math.PI / 2 - heading",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `    const near = [px + hx * 8, pz + hz * 8];
    const far = [px - hx * 55, pz - hz * 55];
    appendGroundStrip(positions, indices, near, far, 0.28);
    const stopCenter = [px - hx * 2.5, pz - hz * 2.5];
    const sx = -hz * 4.2;
    const sz = hx * 4.2;`,
  `    const approach = [px + hx * 24, pz + hz * 24];
    const gateEnd = [px - hx * 14, pz - hz * 14];
    appendGroundStrip(positions, indices, approach, gateEnd, 0.20);
    const stopCenter = [px, pz];
    const sx = -hz * 3.2;
    const sz = hx * 3.2;`,
  "const approach = [px + hx * 24",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `      0.32,
      0.0078,
    );
    const labelX = px - hx * 19;
    const labelZ = pz - hz * 19;`,
  `      0.24,
      0.0078,
    );
    const labelX = px + hx * 18;
    const labelZ = pz + hz * 18;`,
  "const labelX = px + hx * 18",
);

replaceOnce(
  "src/environment/authoredKphxGround.js",
  `  group.userData.detailLevel = "source-positioned-terminal4-stand-centerlines-labels-v1";`,
  `  group.userData.detailLevel = "source-positioned-terminal4-stand-centerlines-labels-v2-door-aligned";`,
  "source-positioned-terminal4-stand-centerlines-labels-v2-door-aligned",
);

for (const [path, tokens] of Object.entries({
  "src/environment/sourcePlacedTerminal4Jetways.js": [
    "parkingByGate",
    "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 5.35",
    "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
    "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.65",
  ],
  "src/environment/authoredKphxGround.js": [
    "const broadWear = Math.sin(pixelX * 0.041)",
    "new THREE.PlaneGeometry(4.6, 2.3)",
    "const approach = [px + hx * 24",
    "const labelX = px + hx * 18",
    "source-positioned-terminal4-stand-centerlines-labels-v2-door-aligned",
  ],
})) {
  const source = fs.readFileSync(path, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${path}: prepared PHX stand alignment is missing ${token}`);
  }
}

console.log("Prepared PHX stand alignment: CRJ-scale v3 door-targeted jetways, realistic stand-line scale, visible gate labels, and non-repeating pavement wear.");
