import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-photo-registered-a1-and-fixed-a14-fleet-cameras-b15-a1-a14-b14-b15-v10";
const A1_CAMERA_AUTHORITY = "oblique-photo-registered-terminal-corner-a1-v9";
const A1_RELOCATION_X = 12.353412;
const A1_RELOCATION_Z = -12.486888;
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
const tugXLine = `    x: ${(7.5 + A1_RELOCATION_X).toFixed(6)},`;
const tugZLine = `    z: ${(8.5 + A1_RELOCATION_Z).toFixed(6)},`;
const tugYawLine = '    yaw: -0.35,';
// Translate the complete evidence rig with the photo-registered A1 set. The
// view is oblique enough to show the terminal wall, 2.4 m vestibule, Rotunda,
// full articulated bridge and forward-left aircraft door in one frame.
const cameraPositionLine = `    cameraPosition: Object.freeze([${(14.0 + A1_RELOCATION_X).toFixed(6)}, 14.0, ${(8.0 + A1_RELOCATION_Z).toFixed(6)}]),`;
const cameraTargetLine = `    cameraTarget: Object.freeze([${(-24.5 + A1_RELOCATION_X).toFixed(6)}, 4.35, ${(-17.0 + A1_RELOCATION_Z).toFixed(6)}]),`;
const cameraAuthorityLine = `    cameraAuthority: "${A1_CAMERA_AUTHORITY}",`;

for (const [pattern, line, label] of [
  [/\n\s+x:\s*-?\d+(?:\.\d+)?,/, tugXLine, "inspection tug x"],
  [/\n\s+z:\s*-?\d+(?:\.\d+)?,/, tugZLine, "inspection tug z"],
  [/\n\s+yaw:\s*-?\d+(?:\.\d+)?,/, tugYawLine, "inspection tug yaw"],
]) {
  if (!pattern.test(presetBlock)) throw new Error(`${path}: A1 connection preset is missing ${label}`);
  presetBlock = presetBlock.replace(pattern, `\n${line}`);
}

for (const [pattern, line, label] of [
  [/\s+cameraPosition:\s*Object\.freeze\(\[[^\]]+\]\),?/, cameraPositionLine, "camera position"],
  [/\s+cameraTarget:\s*Object\.freeze\(\[[^\]]+\]\),?/, cameraTargetLine, "camera target"],
]) {
  if (pattern.test(presetBlock)) {
    presetBlock = presetBlock.replace(pattern, `\n${line}`);
  } else {
    const close = presetBlock.lastIndexOf('  }),');
    if (close < 0) throw new Error(`${path}: A1 connection preset closing anchor is missing for ${label}`);
    presetBlock = `${presetBlock.slice(0, close)}${line}\n${presetBlock.slice(close)}`;
  }
}
if (/\s+cameraAuthority:\s*"[^"]+",?/.test(presetBlock)) {
  presetBlock = presetBlock.replace(/\s+cameraAuthority:\s*"[^"]+",?/, `\n${cameraAuthorityLine}`);
} else {
  const targetEnd = presetBlock.indexOf(cameraTargetLine) + cameraTargetLine.length;
  presetBlock = `${presetBlock.slice(0, targetEnd)}\n${cameraAuthorityLine}${presetBlock.slice(targetEnd)}`;
}

source = `${source.slice(0, presetStart)}${presetBlock}${source.slice(presetEnd)}`;
const b15InspectionPattern = /b15: Object\.freeze\(\{ id: "b15", label: "B15 ramp", x: -?\d+(?:\.\d+)?, z: 539\.2, yaw: -1\.5708, cameraYaw: 1\.38, cameraDistance: 25 \}\),/;
const b15InspectionPreset = 'b15: Object.freeze({ id: "b15", label: "B15 ramp", x: -18.5, z: 539.2, yaw: -1.5708, cameraYaw: 1.38, cameraDistance: 25 }),';
if (!b15InspectionPattern.test(source)) throw new Error(`${path}: generated B15 inspection preset is missing`);
source = source.replace(b15InspectionPattern, b15InspectionPreset);
source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);
source = source.replace(
  /(?:(?:side-on-fixed|wide-diagonal)-a1-terminal-joint-v\d+(?:-clear-tug)*|side-on-direct-terminal-wall-a1-v\d+|oblique-(?:measured|photo-registered)-terminal-corner-a1-v\d+)/g,
  A1_CAMERA_AUTHORITY,
);

for (const token of [
  tugXLine,
  tugZLine,
  tugYawLine,
  cameraPositionLine,
  cameraTargetLine,
  cameraAuthorityLine,
  b15InspectionPreset,
  CANONICAL_ROUTE_AUTHORITY,
  A1_CAMERA_AUTHORITY,
]) {
  if (!source.includes(token)) throw new Error(`${path}: photo-registered A1/B15 inspection preparation is missing ${token}`);
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
console.log("Prepared the photo-registered A1 evidence tug and fixed camera at the relocated terminal corner, framing the compact vestibule, Rotunda, complete bridge and aircraft door.");
