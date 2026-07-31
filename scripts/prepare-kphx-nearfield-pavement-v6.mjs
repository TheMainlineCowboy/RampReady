import fs from "node:fs";

const groundPath = "src/environment/authoredKphxGround.js";
let source = fs.readFileSync(groundPath, "utf8");
const marker = "PHX_NONREPEATING_NEARFIELD_PAVEMENT_V6";

function replaceRequired(before, after, label) {
  if (!source.includes(before)) throw new Error(`${groundPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

if (!source.includes(marker)) {
  replaceRequired(
    `  // The ADEX glTF uses one UV repeat per 64 meters. Two repeats makes this
  // source strip a 32-meter tile: roughly 4-meter rows and 5-meter slab bays,
  // matching apron concrete instead of the sidewalk-scale first pass.
  texture.repeat.set(2, 2);`,
    `  // PHX_NONREPEATING_NEARFIELD_PAVEMENT_V6
  // The ADEX glTF uses one UV repeat per 64 meters. A sub-unit repeat stretches
  // the generated 1024px source-derived pavement over roughly 89 meters, so the
  // same slab pattern is not visibly stamped across every gate.
  texture.repeat.set(0.72, 0.72);`,
    "nearfield texture repeat",
  );

  replaceRequired(
    `  sourceCanvas.width = 256;
  sourceCanvas.height = 256;`,
    `  sourceCanvas.width = 1024;
  sourceCanvas.height = 1024;`,
    "nearfield canvas resolution",
  );

  replaceRequired(
    `  const rowHeight = 32;
  for (let y = 0; y < sourceCanvas.height; y += rowHeight) {
    sourceContext.drawImage(image, 0, 1, sourceWidth, sourceHeight, 0, y, sourceCanvas.width, rowHeight);
  }`,
    `  // Stretch the package's clean concrete strip once across a large detail
  // field, then softly cross-blend a mirrored offset. This preserves the exact
  // supplied concrete color and joints without repeating its black atlas bands
  // or producing a checkerboard of identical 32-meter tiles.
  sourceContext.filter = "blur(0.75px)";
  sourceContext.drawImage(image, 0, 1, sourceWidth, sourceHeight, 0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceContext.filter = "none";
  sourceContext.save();
  sourceContext.globalAlpha = 0.2;
  sourceContext.translate(sourceCanvas.width, 0);
  sourceContext.scale(-1, 1);
  sourceContext.drawImage(
    image,
    0,
    1,
    sourceWidth,
    sourceHeight,
    -173,
    0,
    sourceCanvas.width + 346,
    sourceCanvas.height,
  );
  sourceContext.restore();
  const wash = sourceContext.createLinearGradient(0, 0, sourceCanvas.width, sourceCanvas.height);
  wash.addColorStop(0, "rgba(225, 222, 214, 0.08)");
  wash.addColorStop(0.48, "rgba(110, 113, 114, 0.035)");
  wash.addColorStop(1, "rgba(235, 231, 221, 0.06)");
  sourceContext.fillStyle = wash;
  sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);

  // High-resolution, irregular expansion joints and restrained ramp wear make
  // the tug-height surface read as poured concrete rather than a blurred gray
  // sheet. The seam spacing varies across the 89-meter field, so this cannot
  // recreate the former small checkerboard/repeated-grid failure.
  const slabSeamsX = [91, 216, 351, 493, 641, 786, 932];
  const slabSeamsY = [72, 188, 319, 457, 608, 758, 901];
  sourceContext.save();
  sourceContext.lineCap = "round";
  for (const x of slabSeamsX) {
    sourceContext.strokeStyle = "rgba(55, 58, 58, 0.24)";
    sourceContext.lineWidth = 2.4;
    sourceContext.beginPath();
    sourceContext.moveTo(x, 0);
    sourceContext.bezierCurveTo(x - 4, 280, x + 5, 690, x - 2, sourceCanvas.height);
    sourceContext.stroke();
    sourceContext.strokeStyle = "rgba(235, 232, 224, 0.13)";
    sourceContext.lineWidth = 1.1;
    sourceContext.beginPath();
    sourceContext.moveTo(x + 2.2, 0);
    sourceContext.bezierCurveTo(x - 1.8, 280, x + 7.2, 690, x + 0.2, sourceCanvas.height);
    sourceContext.stroke();
  }
  for (const y of slabSeamsY) {
    sourceContext.strokeStyle = "rgba(58, 60, 60, 0.22)";
    sourceContext.lineWidth = 2.2;
    sourceContext.beginPath();
    sourceContext.moveTo(0, y);
    sourceContext.bezierCurveTo(310, y + 4, 690, y - 5, sourceCanvas.width, y + 2);
    sourceContext.stroke();
    sourceContext.strokeStyle = "rgba(239, 236, 227, 0.12)";
    sourceContext.lineWidth = 1;
    sourceContext.beginPath();
    sourceContext.moveTo(0, y + 2.1);
    sourceContext.bezierCurveTo(310, y + 6.1, 690, y - 2.9, sourceCanvas.width, y + 4.1);
    sourceContext.stroke();
  }

  const repairPatches = [
    [118, 126, 136, 82, -0.035],
    [566, 104, 176, 96, 0.027],
    [760, 442, 124, 182, -0.018],
    [265, 668, 210, 112, 0.022],
    [604, 812, 194, 78, -0.031],
  ];
  for (const [x, y, width, height, rotation] of repairPatches) {
    sourceContext.save();
    sourceContext.translate(x + width / 2, y + height / 2);
    sourceContext.rotate(rotation);
    sourceContext.fillStyle = "rgba(72, 76, 76, 0.035)";
    sourceContext.fillRect(-width / 2, -height / 2, width, height);
    sourceContext.strokeStyle = "rgba(62, 65, 65, 0.08)";
    sourceContext.lineWidth = 1.5;
    sourceContext.strokeRect(-width / 2, -height / 2, width, height);
    sourceContext.restore();
  }

  sourceContext.strokeStyle = "rgba(45, 48, 48, 0.055)";
  sourceContext.lineWidth = 11;
  sourceContext.beginPath();
  sourceContext.ellipse(282, 356, 178, 78, -0.42, 0.12, 2.52);
  sourceContext.stroke();
  sourceContext.lineWidth = 7;
  sourceContext.beginPath();
  sourceContext.ellipse(724, 704, 214, 91, 0.34, 3.42, 5.98);
  sourceContext.stroke();
  sourceContext.restore();`,
    "source concrete field generation",
  );

  replaceRequired(
    `    const broadWear = Math.sin(pixelX * 0.041) * 7.5
      + Math.cos(pixelY * 0.033) * 6
      + Math.sin((pixelX + pixelY) * 0.017) * 4;`,
    `    const broadWear = Math.sin(pixelX * 0.0127) * 4.2
      + Math.cos(pixelY * 0.0091) * 3.6
      + Math.sin((pixelX + pixelY) * 0.0049) * 2.8
      + Math.cos((pixelX - pixelY) * 0.0031) * 1.9;`,
    "broad pavement wear",
  );

  replaceRequired(
    `    const detail = Math.max(104, Math.min(202,
      156 + (luminance - meanLuminance) * 0.68 - darkness * 0.10 + broadWear + grain * 0.38,
    ));`,
    `    const detail = Math.max(120, Math.min(194,
      158 + (luminance - meanLuminance) * 0.34 - darkness * 0.05 + broadWear + grain * 0.3,
    ));`,
    "nearfield albedo contrast",
  );

  replaceRequired(
    `    const bump = Math.max(0, Math.min(255, 128 + (luminance - meanLuminance) * 2.4));`,
    `    const bump = Math.max(0, Math.min(255, 128 + (luminance - meanLuminance) * 1.25 + broadWear * 0.65));`,
    "nearfield bump contrast",
  );

  replaceRequired(
    `        material.bumpScale = 0.028;`,
    `        material.bumpScale = 0.012;`,
    "concrete bump scale",
  );
}

for (const token of [
  marker,
  "texture.repeat.set(0.72, 0.72)",
  "sourceCanvas.width = 1024",
  "sourceCanvas.height = 1024",
  "sourceContext.createLinearGradient",
  "const slabSeamsX",
  "const repairPatches",
  "sourceContext.ellipse(282, 356",
  "material.bumpScale = 0.012",
]) {
  if (!source.includes(token)) throw new Error(`${groundPath}: missing nearfield pavement v6 token ${token}`);
}
for (const forbidden of [
  "texture.repeat.set(2, 2)",
  "sourceCanvas.width = 256",
  "sourceCanvas.height = 256",
  "const rowHeight = 32",
  "material.bumpScale = 0.028",
]) {
  if (source.includes(forbidden)) throw new Error(`${groundPath}: stale repeated pavement token ${forbidden}`);
}

fs.writeFileSync(groundPath, source, "utf8");
console.log("Prepared PHX nonrepeating nearfield pavement v6: 1024px source-derived field, ~89m repeat, irregular slab joints, restrained tire wear, repair patches and softened bump without atlas bands.");
