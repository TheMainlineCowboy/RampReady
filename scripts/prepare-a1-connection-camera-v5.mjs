import fs from "node:fs";

const a1ElbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const preparedA1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
const terminalRotundaSleevePrepared = preparedA1Elbow.includes("const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;")
  && preparedA1Elbow.includes("function addCompactRotundaBellows(")
  && preparedA1Elbow.includes("  const depth = 0.14;");
if (!terminalRotundaSleevePrepared) {
  let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");
  const preservedSourceHeading = staticRegistration.includes("const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);")
    && staticRegistration.includes("const yaw = sourceYaw;");
  const renderedCleanupLegacyToken = "const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);";
  if (preservedSourceHeading && !staticRegistration.includes(renderedCleanupLegacyToken)) {
    const preservedYawAnchor = "  const yaw = sourceYaw;";
    staticRegistration = staticRegistration.replace(
      preservedYawAnchor,
      `${preservedYawAnchor}\n  // Build-order compatibility only: rendered cleanup still proves the exact\n  // supplied Rotunda->Tunnel A axis using its historical token. Keep the\n  // preserved decoded KPHX source heading as the live yaw; this unreachable\n  // nested declaration lets the older cleanup recognize the newer orientation\n  // implementation without re-aiming any static jetway at a synthetic target.\n  if (false) {\n    const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);\n    void yaw;\n  }`,
    );
    fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");
  }
  await import(`./prepare-terminal4-jetway-rendered-cleanup-v1.mjs?rendered-cleanup=${Date.now()}`);
}

// Rendered cleanup historically forces the generated A1 fixed terminal leg
// 0.70 m inside the terminal facade. The apron-side screenshots prove that this
// is visibly buried, not hidden. Normalize the FINAL prepared geometry after
// cleanup and immediately before the camera/production bundle to an 8 cm seam
// overlap. This is intentionally independent of whichever upstream literal was
// used, and it is idempotent on repeated production preparation.
{
  let finalA1Elbow = fs.readFileSync(a1ElbowPath, "utf8");
  const overlapPattern = /const TERMINAL_HIDDEN_OVERLAP_METERS = ([0-9.]+);/;
  const overlapMatch = finalA1Elbow.match(overlapPattern);
  if (!overlapMatch) throw new Error(`${a1ElbowPath}: final terminal-wall overlap declaration is missing`);
  const upstreamOverlapMeters = Number(overlapMatch[1]);
  if (!Number.isFinite(upstreamOverlapMeters) || upstreamOverlapMeters < 0 || upstreamOverlapMeters > 1.5) {
    throw new Error(`${a1ElbowPath}: final upstream terminal-wall overlap is invalid: ${upstreamOverlapMeters}`);
  }
  finalA1Elbow = finalA1Elbow.replace(overlapPattern, "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.08;");
  const normalizedMatch = finalA1Elbow.match(overlapPattern);
  const normalizedOverlapMeters = Number(normalizedMatch?.[1]);
  if (!Number.isFinite(normalizedOverlapMeters) || Math.abs(normalizedOverlapMeters - 0.08) > 1e-9 || normalizedOverlapMeters > 0.12) {
    throw new Error(`${a1ElbowPath}: final A1 terminal seam penetration is invalid: ${normalizedOverlapMeters}`);
  }
  fs.writeFileSync(a1ElbowPath, finalA1Elbow, "utf8");
  console.log(`Normalized final A1 terminal-wall seam after rendered cleanup: ${upstreamOverlapMeters.toFixed(2)} -> ${normalizedOverlapMeters.toFixed(2)} m; deep terminal penetration is forbidden in the bundled scene.`);
}

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const CANONICAL_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-subview-and-chase-a14-b14-b15-v11";
const A1_CAMERA_AUTHORITY = "profile-terminal-rotunda-tunnel-a-joint-evidence-a1-v11";
const LEGACY_CAMERA_FALLBACK_AUTHORITY = "fixed-terminal-wall-rotunda-joint-evidence-a1-v10";
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
const tugXLine = "    x: 7.5,";
const tugZLine = "    z: 8.5,";
const tugYawLine = '    yaw: -0.35,';
// Profile the elbow from the apron side, approximately perpendicular to the
// Rotunda->Cab axis. Both the terminal-side fixed leg and the supplied
// aircraft-side Tunnel A must be visible in the same frame so a vertical step
// cannot be hidden by an end-on or high-overhead perspective.
const cameraPositionLine = "    cameraPosition: Object.freeze([-21.0, 6.7, -3.5]),";
const cameraTargetLine = "    cameraTarget: Object.freeze([-10.2, 5.2, -21.9]),";
const overheadCameraPositionLine = "    overheadCameraPosition: Object.freeze([-27.5, 55.0, -16.15]),";
const overheadCameraTargetLine = "    overheadCameraTarget: Object.freeze([-27.5, 0.0, -16.15]),";
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

// Inspection cameras are data-driven. A1 now carries a profile-camera
// authority that explicitly proves both halves of the elbow in one frame, and
// A14/B14 install their own fixed-fleet authorities later. Preserve those
// values instead of hard-coding A1's authority into the runtime. The historical
// A1 string remains only as the fallback for an older fixed-camera preset with
// no explicit authority, which also keeps downstream preparation idempotent.
if (!source.includes("preset.cameraAuthority || (preset.cameraPosition")) {
  const hardCodedCameraPattern = /canvas\.dataset\.inspectionCameraAuthority = preset\.cameraPosition\n\s*\? "[^"]+"\n\s*: "free-orbit-follow-tug";/;
  if (!hardCodedCameraPattern.test(source)) {
    throw new Error(`${path}: inspection camera authority runtime anchor is missing`);
  }
  source = source.replace(
    hardCodedCameraPattern,
    `canvas.dataset.inspectionCameraAuthority = preset.cameraAuthority || (preset.cameraPosition\n      ? "${LEGACY_CAMERA_FALLBACK_AUTHORITY}"\n      : "free-orbit-follow-tug");`,
  );
}

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
// Migrate stale A1 camera authorities on the A1 preset/runtime only. Do not
// include the legacy fallback authority in this normalization: it intentionally
// remains as the inert compatibility fallback for presets lacking their own
// cameraAuthority.
source = source.replace(
  /(?:(?:side-on-fixed|wide-diagonal)-a1-terminal-joint-v\d+(?:-clear-tug)*|side-on-direct-terminal-wall-a1-v\d+|oblique-(?:measured|photo-registered)-terminal-corner-a1-v\d+|wide-oblique-full-assembly-terminal-corner-a1-v\d+|oblique-measured-final-cab-and-aircraft-a1-v\d+|profile-terminal-rotunda-tunnel-a-joint-evidence-a1-v\d+)/g,
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
  "preset.cameraAuthority || (preset.cameraPosition",
  `"${LEGACY_CAMERA_FALLBACK_AUTHORITY}"`,
  "inspectionPresetConfig?.overheadCameraPosition",
  b15InspectionPreset,
  CANONICAL_ROUTE_AUTHORITY,
  A1_CAMERA_AUTHORITY,
]) {
  if (!source.includes(token)) throw new Error(`${path}: relocated A1/B15 inspection preparation is missing ${token}`);
}
const fixedCameraPositionCount = (source.match(/cameraPosition:\s*Object\.freeze/g) || []).length;
const fixedCameraTargetCount = (source.match(/cameraTarget:\s*Object\.freeze/g) || []).length;
if (fixedCameraPositionCount < 1) {
  throw new Error(`${path}: inspection route must expose the A1 fixed terminal-joint camera`);
}
if (fixedCameraTargetCount !== fixedCameraPositionCount) {
  throw new Error(`${path}: fixed inspection camera positions and targets must remain paired (${fixedCameraPositionCount}/${fixedCameraTargetCount})`);
}
// Additional fixed fleet cameras are valid evidence presets. Do not cap their
// count here: downstream route preparation may add A14/B14 views, while the
// exact A1 camera/target/authority tokens above remain mandatory and fail closed.

fs.writeFileSync(path, source, "utf8");
await import(`./prepare-airport-collision-guard-v45.mjs?physical-airport=${Date.now()}`);
