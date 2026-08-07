import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-subview-and-chase-a14-b14-b15-v10";
const A1_CAMERA_AUTHORITY = "oblique-measured-final-cab-and-aircraft-a1-v9";
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
// Keep the inspection tug away from the bridge and aircraft. A dedicated fixed
// overhead camera below is used for evidence instead of centering on this tug.
const tugXLine = "    x: 20.0,";
const tugZLine = "    z: 3.0,";
const tugYawLine = '    yaw: -0.35,';
// This fallback remains available for broad A1 context. The final production
// evidence path selects the exact endpoint-derived terminal-joint subview when
// a1Connection is launched, so this broad camera is not the acceptance view.
const cameraPositionLine = "    cameraPosition: Object.freeze([42.0, 16.0, 50.0]),";
const cameraTargetLine = "    cameraTarget: Object.freeze([-6.0, 3.5, 17.0]),";
const overheadCameraPositionLine = "    overheadCameraPosition: Object.freeze([-9.0, 75.0, 18.0]),";
const overheadCameraTargetLine = "    overheadCameraTarget: Object.freeze([-9.0, 0.0, 18.0]),";
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
  [/\s+overheadCameraPosition:\s*Object\.freeze\(\[[^\]]+\]\),?/, overheadCameraPositionLine, "overhead camera position"],
  [/\s+overheadCameraTarget:\s*Object\.freeze\(\[[^\]]+\]\),?/, overheadCameraTargetLine, "overhead camera target"],
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

if (!source.includes("inspectionPresetConfig?.overheadCameraPosition")) {
  const overheadBefore = `      } else if (cameraRef.current === "overhead") {
        camera.position.lerp(new THREE.Vector3(target.x, 34, target.z + 2), 0.16);
        camera.lookAt(target.x, 0, target.z + 5);
      } else {`;
  const overheadAfter = `      } else if (cameraRef.current === "overhead") {
        const inspectionPresetConfig = inspectionActive
          ? INSPECTION_PRESETS[inspectionPresetRef.current]
          : null;
        if (inspectionPresetConfig?.overheadCameraPosition && inspectionPresetConfig?.overheadCameraTarget) {
          desiredCamera.fromArray(inspectionPresetConfig.overheadCameraPosition);
          cameraTarget.fromArray(inspectionPresetConfig.overheadCameraTarget);
          camera.position.lerp(desiredCamera, 0.22);
          camera.lookAt(cameraTarget);
        } else {
          camera.position.lerp(new THREE.Vector3(target.x, 34, target.z + 2), 0.16);
          camera.lookAt(target.x, 0, target.z + 5);
        }
      } else {`;
  if (!source.includes(overheadBefore)) throw new Error(`${path}: overhead camera runtime anchor is missing`);
  source = source.replace(overheadBefore, overheadAfter);
}

const b15InspectionPattern = /b15: Object\.freeze\(\{ id: "b15", label: "B15 ramp", x: -?\d+(?:\.\d+)?, z: 539\.2, yaw: -1\.5708, cameraYaw: 1\.38, cameraDistance: 25 \}\),/;
const b15InspectionPreset = 'b15: Object.freeze({ id: "b15", label: "B15 ramp", x: -18.5, z: 539.2, yaw: -1.5708, cameraYaw: 1.38, cameraDistance: 25 }),';
if (!b15InspectionPattern.test(source)) throw new Error(`${path}: generated B15 inspection preset is missing`);
source = source.replace(b15InspectionPattern, b15InspectionPreset);
source = source.replace(
  /source-gate-apron-presets-with-[^"\n]+-a1-a14-b14-b15-v\d+/g,
  CANONICAL_ROUTE_AUTHORITY,
);
source = source.replace(
  /(?:(?:side-on-fixed|wide-diagonal)-a1-terminal-joint-v\d+(?:-clear-tug)*|side-on-direct-terminal-wall-a1-v\d+|oblique-(?:measured|photo-registered)-terminal-corner-a1-v\d+|wide-oblique-full-assembly-terminal-corner-a1-v\d+|oblique-measured-final-cab-and-aircraft-a1-v\d+)/g,
  A1_CAMERA_AUTHORITY,
);

for (const token of [
  tugXLine,
  tugZLine,
  tugYawLine,
  cameraPositionLine,
  cameraTargetLine,
  overheadCameraPositionLine,
  overheadCameraTargetLine,
  cameraAuthorityLine,
  "inspectionPresetConfig?.overheadCameraPosition",
  b15InspectionPreset,
  CANONICAL_ROUTE_AUTHORITY,
  A1_CAMERA_AUTHORITY,
]) {
  if (!source.includes(token)) throw new Error(`${path}: relocated A1/B15 inspection preparation is missing ${token}`);
}
const fixedCameraPositionCount = (source.match(/cameraPosition:\s*Object\.freeze/g) || []).length;
const fixedCameraTargetCount = (source.match(/cameraTarget:\s*Object\.freeze/g) || []).length;
if (![1, 2].includes(fixedCameraPositionCount)) {
  throw new Error(`${path}: inspection route must expose the A1 fixed fallback camera and may expose one additional fixed fleet camera; received ${fixedCameraPositionCount} positions`);
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
    if (!source.includes(token)) throw new Error(`${path}: second fixed fleet camera is not the known A14 camera: ${token}`);
  }
}

fs.writeFileSync(path, source, "utf8");
await import(`./prepare-airport-collision-guard-v45.mjs?physical-airport=${Date.now()}`);
console.log("Prepared broad A1 fallback and overhead evidence framing while preserving the exact terminal-joint launch authority and chase-framed A/B fleet route.");
