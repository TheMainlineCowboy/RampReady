import fs from "node:fs";

const path = "scripts/materialize-phx-terminal4.mjs";
let source = fs.readFileSync(path, "utf8");
const oldText = 'const exactTextureCount = Object.values(materialTextures).filter((entry) => entry.fidelity === "exact").length;';
const newText = 'const exactTextureCount = Object.values(materialTextures).filter((entry) => entry.fidelity.startsWith("exact")).length;';
if (source.includes(oldText)) source = source.replace(oldText, newText);
if (!source.includes(newText)) throw new Error("Terminal 4 exact texture accounting predicate is missing");
if (!source.includes('if (fallbackTextureCount !== 0)')) throw new Error("Terminal 4 zero-fallback enforcement is missing");
fs.writeFileSync(path, source, "utf8");
console.log("Prepared Terminal 4 exact accounting: recovered originals count as exact and fallback count must remain zero.");
