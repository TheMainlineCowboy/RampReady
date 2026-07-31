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
  sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);`,
    "source concrete field generation",
  );

  replaceRequired(
    `    const broadWear = Math.sin(pixelX * 0.041) * 7.5
      + Math.cos(pixelY * 0.033) * 6
      + Math.sin((pixelX + pixelY) * 0.017) * 4;`,
    `    const broadWear = Math.sin(pixelX * 0.0127) * 7.2
      + Math.cos(pixelY * 0.0091) * 5.8
      + Math.sin((pixelX + pixelY) * 0.0049) * 4.4
      + Math.cos((pixelX - pixelY) * 0.0031) * 3.1;`,
    "broad pavement wear",
  );

  replaceRequired(
    `    const detail = Math.max(104, Math.min(202,
      156 + (luminance - meanLuminance) * 0.68 - darkness * 0.10 + broadWear + grain * 0.38,
    ));`,
    `    const detail = Math.max(116, Math.min(198,
      158 + (luminance - meanLuminance) * 0.28 - darkness * 0.04 + broadWear + grain * 0.32,
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
console.log("Prepared PHX nonrepeating nearfield pavement v6: 1024px source-derived field, ~89m repeat, broad wear and softened bump without atlas bands.");
