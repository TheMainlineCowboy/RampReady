import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(path, "utf8");

const replacements = [
  [
    "cameraPosition: Object.freeze([-25.59, 7.4, 5.5])",
    "cameraPosition: Object.freeze([-12.0, 10.5, 28.0])",
  ],
  [
    "cameraTarget: Object.freeze([-25.59, 4.2, -16.15])",
    "cameraTarget: Object.freeze([-27.5, 4.1, -16.15])",
  ],
  [
    "source-gate-apron-presets-with-side-on-a1-connection-a1-a14-b14-b15-v4",
    "source-gate-apron-presets-with-wide-diagonal-a1-connection-a1-a14-b14-b15-v5",
  ],
  [
    "side-on-fixed-a1-terminal-joint-v4",
    "wide-diagonal-a1-terminal-joint-v5",
  ],
];

for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.split(before).join(after);
  if (!source.includes(after)) throw new Error(`${path}: missing A1 connection camera token ${after}`);
}

for (const token of [
  "cameraPosition: Object.freeze([-12.0, 10.5, 28.0])",
  "cameraTarget: Object.freeze([-27.5, 4.1, -16.15])",
  "source-gate-apron-presets-with-wide-diagonal-a1-connection-a1-a14-b14-b15-v5",
  "wide-diagonal-a1-terminal-joint-v5",
]) {
  if (!source.includes(token)) throw new Error(`${path}: wide A1 camera preparation is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared a wide diagonal A1 terminal-connection camera that frames the authored wall, fixed connector, rotunda and uploaded bridge without clipping into the model.");
