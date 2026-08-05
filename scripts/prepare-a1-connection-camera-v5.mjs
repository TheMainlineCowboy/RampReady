import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(path, "utf8");
if (!source.includes('  a1Connection: Object.freeze({')) {
  await import(`./prepare-full-airport-inspection-route.mjs?wide-a1=${Date.now()}`);
  source = fs.readFileSync(path, "utf8");
}

const presetStartToken = '  a1Connection: Object.freeze({';
const presetEndToken = '  a14: Object.freeze({';
const presetStart = source.indexOf(presetStartToken);
const presetEnd = source.indexOf(presetEndToken, presetStart + presetStartToken.length);
if (presetStart < 0 || presetEnd < 0 || presetEnd <= presetStart) {
  throw new Error(`${path}: generated A1 connection inspection preset block is missing`);
}

let presetBlock = source.slice(presetStart, presetEnd);
const tugXLine = '    x: 7.5,';
const tugZLine = '    z: 8.5,';
const tugYawLine = '    yaw: -0.35,';
// User-provided overhead imagery proves A1's fixed connector runs from the
// rotunda at (-21.01, -16.15) directly south to the authored terminal wall near
// z=-32.24. View that 16.09 m span side-on from the east so neither the movable
// tunnel nor the old elevated corridor can hide the wall joint.
const cameraPositionLine = '    cameraPosition: Object.freeze([8.0, 11.5, -24.2]),';
const cameraTargetLine = '    cameraTarget: Object.freeze([-21.01, 4.6, -24.2]),';

for (const [pattern, line, label] of [
  [/\n\s+x:\s*-?\d+(?:\.\d+)?,/, tugXLine, "inspection tug x"],
  [/\n\s+z:\s*-?\d+(?:\.\d+)?,/, tugZLine, "inspection tug z"],
  [/\n\s+yaw:\s*-?\d+(?:\.\d+)?,/, tugYawLine, "inspection tug yaw"],
]) {
  if (!pattern.test(presetBlock)) throw new Error(`${path}: A1 connection preset is missing ${label}`);
  presetBlock = presetBlock.replace(pattern, `\n${line}`);
}

if (/\s+cameraPosition:\s*Object\.freeze\(\[[^\]]+\]\),?/.test(presetBlock)) {
  presetBlock = presetBlock.replace(
    /\s+cameraPosition:\s*Object\.freeze\(\[[^\]]+\]\),?/,
    `\n${cameraPositionLine}`,
  );
} else {
  const close = presetBlock.lastIndexOf('  }),');
  if (close < 0) throw new Error(`${path}: A1 connection preset closing anchor is missing`);
  presetBlock = `${presetBlock.slice(0, close)}${cameraPositionLine}\n${presetBlock.slice(close)}`;
}

if (/\s+cameraTarget:\s*Object\.freeze\(\[[^\]]+\]\),?/.test(presetBlock)) {
  presetBlock = presetBlock.replace(
    /\s+cameraTarget:\s*Object\.freeze\(\[[^\]]+\]\),?/,
    `\n${cameraTargetLine}`,
  );
} else {
  const positionEnd = presetBlock.indexOf(cameraPositionLine) + cameraPositionLine.length;
  presetBlock = `${presetBlock.slice(0, positionEnd)}\n${cameraTargetLine}${presetBlock.slice(positionEnd)}`;
}

source = `${source.slice(0, presetStart)}${presetBlock}${source.slice(presetEnd)}`;
const b15InspectionPattern = /b15: Object\.freeze\(\{ id: "b15", label: "B15 ramp", x: -?\d+(?:\.\d+)?, z: 539\.2, yaw: -1\.5708, cameraYaw: 1\.38, cameraDistance: 25 \}\),/;
const b15InspectionPreset = 'b15: Object.freeze({ id: "b15", label: "B15 ramp", x: -18.5, z: 539.2, yaw: -1.5708, cameraYaw: 1.38, cameraDistance: 25 }),';
if (!b15InspectionPattern.test(source)) {
  throw new Error(`${path}: generated B15 inspection preset is missing`);
}
source = source.replace(b15InspectionPattern, b15InspectionPreset);
source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  'source-gate-apron-presets-with-side-on-direct-terminal-a1-near-wall-b15-a1-a14-b14-b15-v8',
);
source = source.replace(
  /(?:(?:side-on-fixed|wide-diagonal)-a1-terminal-joint-v\d+(?:-clear-tug)*|side-on-direct-terminal-wall-a1-v\d+)/g,
  'side-on-direct-terminal-wall-a1-v7',
);

for (const token of [
  tugXLine,
  tugZLine,
  tugYawLine,
  cameraPositionLine,
  cameraTargetLine,
  b15InspectionPreset,
  'source-gate-apron-presets-with-side-on-direct-terminal-a1-near-wall-b15-a1-a14-b14-b15-v8',
  'side-on-direct-terminal-wall-a1-v7',
]) {
  if (!source.includes(token)) throw new Error(`${path}: direct-terminal A1/B15 inspection preparation is missing ${token}`);
}
const fixedCameraPositionCount = (source.match(/cameraPosition:\s*Object\.freeze/g) || []).length;
const fixedCameraTargetCount = (source.match(/cameraTarget:\s*Object\.freeze/g) || []).length;
if (![1, 2].includes(fixedCameraPositionCount)) {
  throw new Error(`${path}: inspection route must expose the A1 fixed camera and, when prepared, the A14 fixed fleet camera; received ${fixedCameraPositionCount} positions`);
}
if (fixedCameraTargetCount !== fixedCameraPositionCount) {
  throw new Error(`${path}: fixed inspection camera positions and targets must remain paired (${fixedCameraPositionCount}/${fixedCameraTargetCount})`);
}
if (fixedCameraPositionCount === 2) {
  for (const token of [
    'cameraPosition: Object.freeze([184.0, 16.5, -52.0])',
    'cameraTarget: Object.freeze([218.45, 4.2, -86.52])',
    'cameraAuthority: "wide-diagonal-a14-exact-static-fleet-v1"',
  ]) {
    if (!source.includes(token)) throw new Error(`${path}: prepared A14 fixed fleet camera is missing ${token}`);
  }
}

fs.writeFileSync(path, source, "utf8");
await import(`./prepare-airport-collision-guard-v45.mjs?physical-airport=${Date.now()}`);
console.log("Prepared a side-on A1 inspection camera that visibly frames the user-photo-verified direct terminal-wall connector from facade to rotunda, while retaining the full-airport route and physical collision checks.");
