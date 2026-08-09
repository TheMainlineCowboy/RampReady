import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";
const CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSourceMeasuredTerminalConnectorsV2.js";';
const OLD_CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
const MIN_VISIBLE_METERS = 0;
const MAX_VISIBLE_METERS = 43;

let registration = fs.readFileSync(registrationPath, "utf8");
if (registration.includes(OLD_CONNECTOR_IMPORT)) {
  registration = registration.replace(OLD_CONNECTOR_IMPORT, CONNECTOR_IMPORT);
}
if (!registration.includes(CONNECTOR_IMPORT)) {
  throw new Error(`${registrationPath}: source-measured static connector import is missing`);
}

const compactGuard = `  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} source-locked wall fit would require an invalid visible terminal leg: \${visibleTerminalLegMeters} m (wall=\${sourceWallDistance} m)\`);
  }`;
const sourceMeasuredGuard = `  if (!(visibleTerminalLegMeters >= ${MIN_VISIBLE_METERS} && visibleTerminalLegMeters < ${MAX_VISIBLE_METERS})) {
    throw new Error(\`Static jetway \${placement.gate} source-measured wall fit is invalid: \${visibleTerminalLegMeters} m visible (wall=\${sourceWallDistance} m)\`);
  }`;
if (registration.includes(compactGuard)) {
  registration = registration.replace(compactGuard, sourceMeasuredGuard);
} else if (!registration.includes("source-measured wall fit is invalid")) {
  throw new Error(`${registrationPath}: source-locked compact terminal-leg guard is missing`);
}

// The old constants also feed the fleet-wide min/max assertion after all 57
// gates are registered. Replace that global compact-photo envelope with the same
// source-measured limits so a legitimate 0 m Rotunda overlap or a long fixed
// terminal leg cannot abort the whole airport after each gate already passed its
// real-wall consistency checks.
registration = registration
  .replace('const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;', `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace('const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;', `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replace(
    'throw new Error(`Static visible vestibule envelope escaped photo bounds: ${minimumVisibleTerminalLeg}-${maximumVisibleTerminalLeg}`);',
    'throw new Error(`Static source-measured terminal-leg envelope is invalid: ${minimumVisibleTerminalLeg}-${maximumVisibleTerminalLeg}`);',
  );

// Keep the existing decoded-BGL source-pose authority token because downstream
// acceptance already uses it to prove x/z/yaw ownership. Only the fixed terminal
// connector length policy changes here. A zero visible leg is valid when the
// measured real terminal wall already overlaps the authored Rotunda radius.
if (!registration.includes(`const AUTHORITY = "${SOURCE_POSE_AUTHORITY}";`)) {
  throw new Error(`${registrationPath}: decoded static source-pose authority is missing`);
}
for (const required of [
  CONNECTOR_IMPORT,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  "Static source-measured terminal-leg envelope is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: source-measured fleet envelope is missing ${required}`);
  }
}
for (const forbidden of [
  "source-locked wall fit would require an invalid visible terminal leg",
  "Static visible vestibule envelope escaped photo bounds",
  "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;",
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;",
  OLD_CONNECTOR_IMPORT,
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: retired compact static terminal-leg policy survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log(`Allowed all 57 static exact jetways and the fleet-wide acceptance gate to keep their real source-measured Terminal 4 wall-to-Rotunda fixed-leg lengths (${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m), including zero visible leg when the authored Rotunda already meets the wall, without relocating/re-aiming the supplied parent.`);
