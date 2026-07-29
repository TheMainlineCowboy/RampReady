import fs from "node:fs";

const builderPath = "scripts/build-kphx-simulator-ground.mjs";
let builder = fs.readFileSync(builderPath, "utf8");
const obsoleteCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5 && taxiwayPath.drawSurface !== false";
const normalizedCondition = "taxiwayPath.type !== 3 && taxiwayPath.widthMeters > 0.5";
if (builder.includes(obsoleteCondition)) builder = builder.replace(obsoleteCondition, normalizedCondition);
if (!builder.includes(normalizedCondition)) throw new Error("KPHX simulator builder path-surface condition is missing");
fs.writeFileSync(builderPath, builder, "utf8");

const materializerPath = "scripts/materialize-kphx-ground.mjs";
let materializer = fs.readFileSync(materializerPath, "utf8");
if (materializer.includes("primitiveCount: 5,")) materializer = materializer.replace("primitiveCount: 5,", "primitiveCount: 6,");
if (!materializer.includes("primitiveCount: 6,")) throw new Error("KPHX materializer primitive contract is not normalized");
fs.writeFileSync(materializerPath, materializer, "utf8");

console.log("Prepared KPHX simulator ground builder: FSX path records retain all authored pavement surfaces.");
