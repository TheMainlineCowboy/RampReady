import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";
const CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSourceMeasuredTerminalConnectorsV2.js";';
const OLD_CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
const MIN_VISIBLE_METERS = 0.15;
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
const sourceMeasuredGuard = `  if (!(visibleTerminalLegMeters > ${MIN_VISIBLE_METERS} && visibleTerminalLegMeters < ${MAX_VISIBLE_METERS})) {
    throw new Error(\`Static jetway \${placement.gate} source-measured wall fit is invalid: \${visibleTerminalLegMeters} m visible (wall=\${sourceWallDistance} m)\`);
  }`;
if (registration.includes(compactGuard)) {
  registration = registration.replace(compactGuard, sourceMeasuredGuard);
} else if (!registration.includes("source-measured wall fit is invalid")) {
  throw new Error(`${registrationPath}: source-locked compact terminal-leg guard is missing`);
}

// Keep the existing decoded-BGL source-pose authority token because downstream
// acceptance already uses it to prove x/z/yaw ownership. Only the fixed terminal
// connector length policy changes here.
if (!registration.includes(`const AUTHORITY = "${SOURCE_POSE_AUTHORITY}";`)) {
  throw new Error(`${registrationPath}: decoded static source-pose authority is missing`);
}
if (registration.includes("source-locked wall fit would require an invalid visible terminal leg")) {
  throw new Error(`${registrationPath}: retired 3.6 m static terminal-leg rejection survived`);
}
if (registration.includes(OLD_CONNECTOR_IMPORT)) {
  throw new Error(`${registrationPath}: retired compact static connector runtime survived`);
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log(`Allowed all 57 static exact jetways to keep their real source-measured Terminal 4 wall-to-Rotunda fixed-leg lengths (${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m) through the committed source-measured connector runtime, without relocating/re-aiming the supplied parent or mutating the legacy connector source.`);
