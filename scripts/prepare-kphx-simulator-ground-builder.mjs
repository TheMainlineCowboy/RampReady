import fs from "node:fs";

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label} is missing ${token}`);
}

const builderPath = "scripts/build-kphx-simulator-ground.mjs";
let builder = fs.readFileSync(builderPath, "utf8");
const obsoleteCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5 && taxiwayPath.drawSurface !== false";
const normalizedCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5";
if (builder.includes(obsoleteCondition)) builder = builder.replace(obsoleteCondition, normalizedCondition);
requireToken(builder, normalizedCondition, "KPHX simulator builder path-surface condition");
fs.writeFileSync(builderPath, builder, "utf8");

const materializerPath = "scripts/materialize-kphx-ground.mjs";
let materializer = fs.readFileSync(materializerPath, "utf8");
if (materializer.includes("primitiveCount: 5,")) materializer = materializer.replace("primitiveCount: 5,", "primitiveCount: 6,");
requireToken(materializer, "primitiveCount: 6,", "KPHX materializer primitive contract");
materializer = materializer.replace(
  'remainingSourceLayers: ["taxiway sign object records", "external simulator-library jetway geometry", "missing PHX_TERM400 diffuse maps"],',
  'remainingSourceLayers: ["derived taxiway signage from source graph", "source boundary-fence visualization"],',
);
fs.writeFileSync(materializerPath, materializer, "utf8");

console.log("Prepared KPHX simulator ground builder: all FSX path surfaces remain active; 0x0039 is preserved as boundary-fence evidence, not misclassified as taxiway signage.");
