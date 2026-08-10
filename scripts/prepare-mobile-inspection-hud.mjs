import fs from "node:fs";

const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const stylePath = "src/components/mobile-hud-v10.css";
const importAnchor = 'import "./mobile-hud-v9.css";';
const importLine = 'import "./mobile-hud-v10.css";';

let runtime = fs.readFileSync(runtimePath, "utf8");
if (!runtime.includes(importLine)) {
  if (!runtime.includes(importAnchor)) throw new Error("Terminal 4 runtime is missing the v9 mobile HUD stylesheet import anchor");
  runtime = runtime.replace(importAnchor, `${importAnchor}\n${importLine}`);
  fs.writeFileSync(runtimePath, runtime, "utf8");
}

const style = fs.readFileSync(stylePath, "utf8");
for (const token of [
  "/* RampReady mobile HUD compact simulator layout v10 */",
  ".rr-shell .rr-hud",
  ".rr-shell .rr-metrics",
  ".rr-shell .rr-throttle",
  ".rr-shell .rr-steer",
  "grid-template-columns: 62px minmax(0, 1fr) 58px",
  "content: \"Inspect\"",
]) if (!style.includes(token)) throw new Error(`Mobile HUD v10 stylesheet is missing ${token}`);

const preparedRuntime = fs.readFileSync(runtimePath, "utf8");
if (!preparedRuntime.includes(importLine)) throw new Error("Terminal 4 runtime did not import the committed mobile HUD v10 stylesheet");

console.log("Prepared compact mobile simulator HUD v10: shallow top status panel, compact telemetry pill and two 44 px driving-control strips.");
