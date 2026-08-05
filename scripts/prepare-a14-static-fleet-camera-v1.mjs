import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const exactPreset = `  a14: Object.freeze({
    id: "a14",
    label: "A concourse midpoint",
    x: 218.45,
    z: -86.52,
    yaw: 2.88,
    cameraYaw: -0.95,
    cameraDistance: 44,
    cameraPosition: Object.freeze([184.0, 16.5, -52.0]),
    cameraTarget: Object.freeze([218.45, 4.2, -86.52]),
    cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1",
  }),`;

if (!source.includes('cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"')) {
  const oneLinePreset = /  a14: Object\.freeze\(\{ id: "a14", label: "A concourse midpoint", x: 218\.45, z: -86\.52, yaw: 2\.88, cameraYaw: -?\d+(?:\.\d+)?, cameraDistance: \d+(?:\.\d+)? \}\),/;
  if (!oneLinePreset.test(source)) {
    throw new Error(`${trainerPath}: A14 inspection preset anchor is missing`);
  }
  source = source.replace(oneLinePreset, exactPreset);
}

const oldAuthority = `    canvas.dataset.inspectionCameraAuthority = preset.cameraPosition
      ? "wide-diagonal-a1-terminal-joint-v6-clear-tug"
      : "free-orbit-follow-tug";`;
const newAuthority = `    canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition
      ? "wide-diagonal-a1-terminal-joint-v6-clear-tug"
      : "free-orbit-follow-tug");`;
if (!source.includes(newAuthority)) {
  if (!source.includes(oldAuthority)) {
    throw new Error(`${trainerPath}: inspection camera authority anchor is missing`);
  }
  source = source.replace(oldAuthority, newAuthority);
}

source = source.replace(
  /source-gate-apron-presets-with-wide-diagonal-a1-connection-near-wall-b15-a1-a14-b14-b15-v\d+/g,
  "source-gate-apron-presets-with-fixed-a1-and-a14-fleet-cameras-b15-a1-a14-b14-b15-v8",
);

for (const token of [
  'cameraPosition: Object.freeze([184.0, 16.5, -52.0])',
  'cameraTarget: Object.freeze([218.45, 4.2, -86.52])',
  'cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"',
  "preset.cameraAuthority || (preset.cameraPosition",
  "source-gate-apron-presets-with-fixed-a1-and-a14-fleet-cameras-b15-a1-a14-b14-b15-v8",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: fixed A14 exact-fleet camera is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared a fixed apron-side A14 inspection camera that frames the exact static jetway fleet instead of colliding with the terminal and looking down at the tug.");
