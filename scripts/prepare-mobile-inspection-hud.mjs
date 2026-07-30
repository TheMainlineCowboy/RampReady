import fs from "node:fs";

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const stylePath = "src/components/mobile-hud-v9.css";
const importAnchor = 'import "./mobile-runtime-recovery.css";';
const importLine = 'import "./mobile-hud-v9.css";';

let runtime = fs.readFileSync(runtimePath, "utf8");
if (!runtime.includes(importLine)) {
  if (!runtime.includes(importAnchor)) throw new Error("Terminal 4 runtime is missing the mobile recovery stylesheet import anchor");
  runtime = runtime.replace(importAnchor, `${importAnchor}\n${importLine}`);
  fs.writeFileSync(runtimePath, runtime, "utf8");
}

const style = fs.readFileSync(stylePath, "utf8");
for (const token of [
  "/* RampReady mobile HUD hard containment v9 */",
  ".rr-shell .rr-topline > div:first-child",
  "width: 100%",
  "overflow-wrap: anywhere",
  "text-overflow: clip",
]) if (!style.includes(token)) throw new Error(`Mobile HUD stylesheet is missing ${token}`);

const preparedRuntime = fs.readFileSync(runtimePath, "utf8");
if (!preparedRuntime.includes(importLine)) throw new Error("Terminal 4 runtime did not import the committed mobile HUD stylesheet");

console.log("Prepared mobile inspection HUD using a committed hard-containment stylesheet and a generated runtime import.");
