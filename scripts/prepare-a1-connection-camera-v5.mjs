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
source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  'source-gate-apron-presets-with-wide-diagonal-a1-connection-a1-a14-b14-b15-v6',
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
  'source-gate-apron-presets-with-wide-diagonal-a1-connection-a1-a14-b14-b15-v6',
  'wide-diagonal-a1-terminal-joint-v6-clear-tug',
]) {
  if (!source.includes(token)) throw new Error(`${path}: wide A1 camera preparation is missing ${token}`);
}
if ((source.match(/cameraPosition:\s*Object\.freeze/g) || []).length !== 1) {
  throw new Error(`${path}: A1 inspection route must expose exactly one fixed camera position`);
}
if ((source.match(/cameraTarget:\s*Object\.freeze/g) || []).length !== 1) {
  throw new Error(`${path}: A1 inspection route must expose exactly one fixed camera target`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared the full-airport inspection route when absent, normalized a wide diagonal A1 terminal-connection camera and moved the inspection tug clear of the jetway stair/support footprint.");
