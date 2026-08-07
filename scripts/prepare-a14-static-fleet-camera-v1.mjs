import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-side-on-a1-and-fixed-a14-fleet-cameras-b15-a1-a14-b14-b15-v9";
const A1_CAMERA_AUTHORITY = "oblique-measured-terminal-corner-a1-v8";
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

const canonicalAuthorityBlock = `    canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition
      ? "${A1_CAMERA_AUTHORITY}"
      : "free-orbit-follow-tug");`;
if (!source.includes(canonicalAuthorityBlock)) {
  const genericAuthorityBlock = /    canvas\.dataset\.inspectionCameraAuthority = preset(?:\.cameraAuthority \|\| \()?\.cameraPosition\n      \? "[^"]+"\n      : "free-orbit-follow-tug"\)?;/;
  if (!genericAuthorityBlock.test(source)) {
    throw new Error(`${trainerPath}: inspection camera authority anchor is missing`);
  }
  source = source.replace(genericAuthorityBlock, canonicalAuthorityBlock);
}

source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);
source = source.replace(
  /oblique-(?:measured|photo-registered)-terminal-corner-a1-v\d+/g,
  A1_CAMERA_AUTHORITY,
);

for (const token of [
  'cameraPosition: Object.freeze([184.0, 16.5, -52.0])',
  'cameraTarget: Object.freeze([218.45, 4.2, -86.52])',
  'cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"',
  "preset.cameraAuthority || (preset.cameraPosition",
  `"${A1_CAMERA_AUTHORITY}"`,
  CANONICAL_ROUTE_AUTHORITY,
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: fixed A1/A14 camera preparation is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared the relocated A1 evidence coordinates together with the fixed apron-side A14 exact-fleet camera under the established canonical route authority.");
