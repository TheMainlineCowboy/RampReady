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

function normalizeAll(path, replacements) {
  let source = fs.readFileSync(path, "utf8");
  for (const [oldText, newText] of replacements) source = source.replaceAll(oldText, newText);
  fs.writeFileSync(path, source, "utf8");
}

const builderPath = "scripts/build-kphx-simulator-ground.mjs";
replaceIn(
  builderPath,
  `    if (taxiwayPath.type === 2) addDashedStrip(materialName, start, end, width, 30, 20, 0.045);
    else addStrip(materialName, start, end, width, 0.045);`,
  `    const markingY = taxiwayPath.type === 3 ? 0.0018 : taxiwayPath.type === 2 ? 0.0032 : 0.0024;
    if (taxiwayPath.type === 2) addDashedStrip(materialName, start, end, width, 30, 20, markingY);
    else addStrip(materialName, start, end, width, markingY);`,
  "const markingY = taxiwayPath.type === 3 ? 0.0018",
  false,
);
normalizeAll(builderPath, [
  ["const markingY = taxiwayPath.type === 3 ? 0.0065 : taxiwayPath.type === 2 ? 0.0255 : 0.0135", "const markingY = taxiwayPath.type === 3 ? 0.0018 : taxiwayPath.type === 2 ? 0.0032 : 0.0024"],
  ['addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.047)', 'addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.0025)'],
  ['addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.0137)', 'addDashedStrip("yellow-marking", a, b, 0.16, 4, 4, 0.0025)'],
  ['addStrip("yellow-marking", a, b, 0.16, 0.047)', 'addStrip("yellow-marking", a, b, 0.16, 0.0025)'],
  ['addStrip("yellow-marking", a, b, 0.16, 0.0137)', 'addStrip("yellow-marking", a, b, 0.16, 0.0025)'],
  [', width, lineWidth, 0.055);', ', width, lineWidth, 0.0026);'],
  [', width, lineWidth, 0.0138);', ', width, lineWidth, 0.0026);'],
  [', dashWidth, lineWidth, 0.055);', ', dashWidth, lineWidth, 0.0026);'],
  [', dashWidth, lineWidth, 0.0138);', ', dashWidth, lineWidth, 0.0026);'],
  [', 0.32, 0.061);', ', 0.32, 0.0032);'],
  [', 0.32, 0.0255);', ', 0.32, 0.0032);'],
  [', 0.42, 30, 20, 0.063);', ', 0.42, 30, 20, 0.0033);'],
  [', 0.42, 30, 20, 0.0257);', ', 0.42, 30, 20, 0.0033);'],
  [', 14, stripeWidth, 0.066);', ', 14, stripeWidth, 0.0034);'],
  [', 14, stripeWidth, 0.0258);', ', 14, stripeWidth, 0.0034);'],
  [', 45, 2.8, 0.066);', ', 45, 2.8, 0.0034);'],
  [', 45, 2.8, 0.0258);', ', 45, 2.8, 0.0034);'],
  [', 22, 1.4, 0.066);', ', 22, 1.4, 0.0034);'],
  [', 22, 1.4, 0.0258);', ', 22, 1.4, 0.0034);'],
]);

const runtimePath = "src/environment/authoredKphxGround.js";
normalizeAll(runtimePath, [
  ["  material.polygonOffsetFactor = -12;", "  material.polygonOffsetFactor = -0.25;"],
  ["  material.polygonOffsetFactor = -1;", "  material.polygonOffsetFactor = -0.25;"],
  ["  material.polygonOffsetUnits = -12;", "  material.polygonOffsetUnits = -0.5;"],
  ["  material.polygonOffsetUnits = -1;", "  material.polygonOffsetUnits = -0.5;"],
  ["  node.renderOrder = Math.max(node.renderOrder || 0, 420);", "  node.renderOrder = Math.max(node.renderOrder || 0, 24);"],
  ["  node.renderOrder = Math.max(node.renderOrder || 0, 80);", "  node.renderOrder = Math.max(node.renderOrder || 0, 24);"],
  ["y = 0.135", "y = 0.0022"],
  ["y = 0.0075", "y = 0.0022"],
  ["mesh.position.set(x, 0.145, z)", "mesh.position.set(x, 0.0028, z)"],
  ["mesh.position.set(x, 0.0085, z)", "mesh.position.set(x, 0.0028, z)"],
  ["polygonOffsetFactor: -18", "polygonOffsetFactor: -0.25"],
  ["polygonOffsetFactor: -1", "polygonOffsetFactor: -0.25"],
  ["polygonOffsetUnits: -18", "polygonOffsetUnits: -0.5"],
  ["polygonOffsetUnits: -1", "polygonOffsetUnits: -0.5"],
  ["mesh.renderOrder = 470", "mesh.renderOrder = 28"],
  ["mesh.renderOrder = 90", "mesh.renderOrder = 28"],
  ["0.137,", "0.0024,"],
  ["0.0078,", "0.0024,"],
  ["polygonOffsetFactor: -16", "polygonOffsetFactor: -0.25"],
  ["polygonOffsetUnits: -16", "polygonOffsetUnits: -0.5"],
  ["lines.renderOrder = 460", "lines.renderOrder = 26"],
  ["lines.renderOrder = 85", "lines.renderOrder = 26"],
  ['contactMode: "pavement-relative-millimeter-offset"', 'contactMode: "pavement-coincident-decals"'],
]);

const authorityPath = "scripts/prepare-phx-visual-authority.mjs";
normalizeAll(authorityPath, [
  ["function appendGroundStrip(positions, indices, a, b, width, y = 0.135)", "function appendGroundStrip(positions, indices, a, b, width, y = 0.0022)"],
  ["function appendGroundStrip(positions, indices, a, b, width, y = 0.0075)", "function appendGroundStrip(positions, indices, a, b, width, y = 0.0022)"],
  ["    polygonOffsetFactor: -18,", "    polygonOffsetFactor: -0.25,"],
  ["    polygonOffsetFactor: -1,", "    polygonOffsetFactor: -0.25,"],
  ["    polygonOffsetUnits: -18,", "    polygonOffsetUnits: -0.5,"],
  ["    polygonOffsetUnits: -1,", "    polygonOffsetUnits: -0.5,"],
  ["  mesh.position.set(x, 0.145, z);", "  mesh.position.set(x, 0.0028, z);"],
  ["  mesh.position.set(x, 0.0085, z);", "  mesh.position.set(x, 0.0028, z);"],
  ["  mesh.renderOrder = 470;", "  mesh.renderOrder = 28;"],
  ["  mesh.renderOrder = 90;", "  mesh.renderOrder = 28;"],
  ["      0.137,", "      0.0024,"],
  ["      0.0078,", "      0.0024,"],
  ["    polygonOffsetFactor: -16,", "    polygonOffsetFactor: -0.25,"],
  ["    polygonOffsetUnits: -16,", "    polygonOffsetUnits: -0.5,"],
  ["  lines.renderOrder = 460;", "  lines.renderOrder = 26;"],
  ["  lines.renderOrder = 85;", "  lines.renderOrder = 26;"],
]);

const alignmentPath = "scripts/prepare-phx-stand-alignment.mjs";
normalizeAll(alignmentPath, [["0.137", "0.0024"], ["0.0078", "0.0024"]]);

const runwayVisualPath = "src/environment/kphxRunwayVisuals.js";
normalizeAll(runwayVisualPath, [
  ["  mesh.position.set(label.x, 0.082, label.z);", "  mesh.position.set(label.x, 0.003, label.z);"],
  ["  mesh.position.set(label.x, 0.027, label.z);", "  mesh.position.set(label.x, 0.003, label.z);"],
  ["    polygonOffsetFactor: -22,", "    polygonOffsetFactor: -0.25,"],
  ["    polygonOffsetFactor: -1,", "    polygonOffsetFactor: -0.25,"],
  ["    polygonOffsetUnits: -22,", "    polygonOffsetUnits: -0.5,"],
  ["    polygonOffsetUnits: -1,", "    polygonOffsetUnits: -0.5,"],
]);

for (const [path, tokens, forbidden] of [
  [builderPath, [
    "const markingY = taxiwayPath.type === 3 ? 0.0018",
    'addStrip("yellow-marking", a, b, 0.16, 0.0025)',
    "lineWidth, 0.0026",
    "stripeWidth, 0.0034",
  ], ["0.0135", "0.0255", "0.0137", "0.0138", "0.0258", "0.045", "0.055", "0.066"]],
  [runtimePath, [
    "material.polygonOffsetFactor = -0.25",
    "material.polygonOffsetUnits = -0.5",
    "Math.max(node.renderOrder || 0, 24)",
    'contactMode: "pavement-coincident-decals"',
  ], ["polygonOffsetFactor = -12", "polygonOffsetUnits = -12", "renderOrder || 0, 420"]],
  [authorityPath, [
    "y = 0.0022",
    "mesh.position.set(x, 0.0028, z)",
    "lines.renderOrder = 26",
  ], ["y = 0.135", "0.137,", "renderOrder = 460", "renderOrder = 470"]],
]) {
  const prepared = fs.readFileSync(path, "utf8");
  for (const token of tokens) if (!prepared.includes(token)) throw new Error(`${path}: pavement-contact preparation is missing ${token}`);
  for (const token of forbidden) if (prepared.includes(token)) throw new Error(`${path}: obsolete floating marking token remains ${token}`);
}

console.log("Prepared KPHX pavement-coincident markings: 1.8-3.4 mm surface offsets, minimal depth bias, and normal object occlusion.");
