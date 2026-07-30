import fs from "node:fs";

function replaceIn(path, oldText, newText, marker, required = true) {
  let source = fs.readFileSync(path, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(oldText)) {
    if (required) throw new Error(`${path}: marking-contact anchor is missing for ${marker}`);
    return;
  }
  source = source.replace(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const builderPath = "scripts/build-kphx-simulator-ground.mjs";
replaceIn(
  builderPath,
  `    if (taxiwayPath.type === 2) addDashedStrip(materialName, start, end, width, 30, 20, 0.045);
    else addStrip(materialName, start, end, width, 0.045);`,
  `    const markingY = taxiwayPath.type === 3 ? 0.0065 : taxiwayPath.type === 2 ? 0.0255 : 0.0135;
    if (taxiwayPath.type === 2) addDashedStrip(materialName, start, end, width, 30, 20, markingY);
    else addStrip(materialName, start, end, width, markingY);`,
  "const markingY = taxiwayPath.type === 3 ? 0.0065",
);
for (const [oldText, newText] of [
  ['addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.047)', 'addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.0137)'],
  ['addStrip("yellow-marking", a, b, 0.16, 0.047)', 'addStrip("yellow-marking", a, b, 0.16, 0.0137)'],
  [', width, lineWidth, 0.055);', ', width, lineWidth, 0.0138);'],
  [', dashWidth, lineWidth, 0.055);', ', dashWidth, lineWidth, 0.0138);'],
  [', 0.32, 0.061);', ', 0.32, 0.0255);'],
  [', 0.42, 30, 20, 0.063);', ', 0.42, 30, 20, 0.0257);'],
  [', 14, stripeWidth, 0.066);', ', 14, stripeWidth, 0.0258);'],
  [', 45, 2.8, 0.066);', ', 45, 2.8, 0.0258);'],
  [', 22, 1.4, 0.066);', ', 22, 1.4, 0.0258);'],
]) {
  replaceIn(builderPath, oldText, newText, newText, false);
}

const runtimePath = "src/environment/authoredKphxGround.js";
for (const [oldText, newText, marker] of [
  ["  material.polygonOffsetFactor = -12;", "  material.polygonOffsetFactor = -1;", "material.polygonOffsetFactor = -1"],
  ["  material.polygonOffsetUnits = -12;", "  material.polygonOffsetUnits = -1;", "material.polygonOffsetUnits = -1"],
  ["  node.renderOrder = Math.max(node.renderOrder || 0, 420);", "  node.renderOrder = Math.max(node.renderOrder || 0, 80);", "Math.max(node.renderOrder || 0, 80)"],
]) replaceIn(runtimePath, oldText, newText, marker);

const authorityPath = "scripts/prepare-phx-visual-authority.mjs";
for (const [oldText, newText, marker] of [
  ["function appendGroundStrip(positions, indices, a, b, width, y = 0.135)", "function appendGroundStrip(positions, indices, a, b, width, y = 0.0075)", "y = 0.0075"],
  ["    polygonOffsetFactor: -18,", "    polygonOffsetFactor: -1,", "polygonOffsetFactor: -1,"],
  ["    polygonOffsetUnits: -18,", "    polygonOffsetUnits: -1,", "polygonOffsetUnits: -1,"],
  ["  mesh.position.set(x, 0.145, z);", "  mesh.position.set(x, 0.0085, z);", "mesh.position.set(x, 0.0085, z)"],
  ["  mesh.renderOrder = 470;", "  mesh.renderOrder = 90;", "mesh.renderOrder = 90"],
  ["      0.137,", "      0.0078,", "      0.0078,"],
  ["    polygonOffsetFactor: -16,", "    polygonOffsetFactor: -1,", "polygonOffsetFactor: -1,"],
  ["    polygonOffsetUnits: -16,", "    polygonOffsetUnits: -1,", "polygonOffsetUnits: -1,"],
  ["  lines.renderOrder = 460;", "  lines.renderOrder = 85;", "lines.renderOrder = 85"],
]) replaceIn(authorityPath, oldText, newText, marker, false);

const alignmentPath = "scripts/prepare-phx-stand-alignment.mjs";
let alignment = fs.readFileSync(alignmentPath, "utf8");
if (alignment.includes("0.137")) {
  alignment = alignment.replaceAll("0.137", "0.0078");
  fs.writeFileSync(alignmentPath, alignment, "utf8");
}

// If the stand-marking functions have already been materialized into the tracked
// source by an earlier preparation pass, normalize them too.
let runtime = fs.readFileSync(runtimePath, "utf8");
for (const [oldText, newText] of [
  ["y = 0.135", "y = 0.0075"],
  ["mesh.position.set(x, 0.145, z)", "mesh.position.set(x, 0.0085, z)"],
  ["polygonOffsetFactor: -18", "polygonOffsetFactor: -1"],
  ["polygonOffsetUnits: -18", "polygonOffsetUnits: -1"],
  ["mesh.renderOrder = 470", "mesh.renderOrder = 90"],
  ["0.137,", "0.0078,"],
  ["polygonOffsetFactor: -16", "polygonOffsetFactor: -1"],
  ["polygonOffsetUnits: -16", "polygonOffsetUnits: -1"],
  ["lines.renderOrder = 460", "lines.renderOrder = 85"],
]) runtime = runtime.replaceAll(oldText, newText);
fs.writeFileSync(runtimePath, runtime, "utf8");

const runwayVisualPath = "src/environment/kphxRunwayVisuals.js";
for (const [oldText, newText, marker] of [
  ["  mesh.position.set(label.x, 0.082, label.z);", "  mesh.position.set(label.x, 0.027, label.z);", "mesh.position.set(label.x, 0.027, label.z)"],
  ["    polygonOffsetFactor: -22,", "    polygonOffsetFactor: -1,", "polygonOffsetFactor: -1,"],
  ["    polygonOffsetUnits: -22,", "    polygonOffsetUnits: -1,", "polygonOffsetUnits: -1,"],
]) replaceIn(runwayVisualPath, oldText, newText, marker, false);

for (const [path, tokens] of Object.entries({
  [builderPath]: [
    "const markingY = taxiwayPath.type === 3 ? 0.0065",
    'addStrip("yellow-marking", a, b, 0.16, 0.0137)',
    "lineWidth, 0.0138",
    "stripeWidth, 0.0258",
  ],
  [runtimePath]: [
    "material.polygonOffsetFactor = -1",
    "material.polygonOffsetUnits = -1",
    "Math.max(node.renderOrder || 0, 80)",
  ],
  [authorityPath]: [
    "y = 0.0075",
    "mesh.position.set(x, 0.0085, z)",
    "lines.renderOrder = 85",
  ],
})) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: pavement-contact preparation is missing ${token}`);
}

console.log("Prepared KPHX pavement-contact markings: millimeter-scale elevation, shallow depth bias, and object-safe depth testing.");
