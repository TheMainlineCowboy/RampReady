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
const cameraPositionLine = '    cameraPosition: Object.freeze([-12.0, 10.5, 28.0]),';
const cameraTargetLine = '    cameraTarget: Object.freeze([-27.5, 4.1, -16.15]),';

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
  'source-gate-apron-presets-with-wide-diagonal-a1-connection-near-wall-b15-a1-a14-b14-b15-v7',
);
source = source.replace(
  /(?:side-on-fixed|wide-diagonal)-a1-terminal-joint-v\d+(?:-clear-tug)*/g,
  'wide-diagonal-a1-terminal-joint-v6-clear-tug',
);

for (const token of [
  tugXLine,
  tugZLine,
  tugYawLine,
  cameraPositionLine,
  cameraTargetLine,
  b15InspectionPreset,
  'source-gate-apron-presets-with-wide-diagonal-a1-connection-near-wall-b15-a1-a14-b14-b15-v7',
  'wide-diagonal-a1-terminal-joint-v6-clear-tug',
]) {
  if (!source.includes(token)) throw new Error(`${path}: wide A1/B15 inspection preparation is missing ${token}`);
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
console.log("Prepared the full-airport inspection route with its fixed A1 connection view and optional fixed A14 exact-fleet view, moved A1 clear of the jetway support footprint, placed B15 close enough for a fast physical-contact check, added airport collision protection and limited A1 bridge retraction to door-clearance travel.");
