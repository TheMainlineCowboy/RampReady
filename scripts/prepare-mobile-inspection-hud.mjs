import fs from "node:fs";

const path = "src/components/throttle-force.css";
let source = fs.readFileSync(path, "utf8");
const marker = "/* RampReady mobile inspection HUD title polish */";
if (!source.includes(marker)) {
  source += `\n\n${marker}\n@media (max-width: 620px) {\n  .rr-shell .rr-topline {\n    flex-direction: column;\n    align-items: stretch;\n    gap: 7px;\n  }\n\n  .rr-shell .rr-topline > div:first-child {\n    min-width: 0;\n  }\n\n  .rr-shell .rr-hud h1 {\n    max-width: none;\n    white-space: normal;\n    overflow: visible;\n    text-overflow: clip;\n  }\n\n  .rr-shell .rr-top-tools {\n    width: 100%;\n    justify-content: stretch;\n    flex-wrap: nowrap;\n  }\n\n  .rr-shell .rr-inspection-toggle {\n    flex: 1 1 auto;\n    min-width: 0;\n  }\n\n  .rr-shell .rr-view-select {\n    flex: 0 1 104px;\n    min-width: 92px;\n  }\n}\n`;
  fs.writeFileSync(path, source, "utf8");
}

const prepared = fs.readFileSync(path, "utf8");
for (const token of [
  marker,
  "flex-direction: column",
  ".rr-shell .rr-topline > div:first-child",
  "white-space: normal",
  "text-overflow: clip",
  "flex-wrap: nowrap",
]) if (!prepared.includes(token)) throw new Error(`Mobile inspection HUD polish is missing ${token}`);

console.log("Prepared mobile inspection HUD: full step title above a single-row camera and inspection toolbar.");
