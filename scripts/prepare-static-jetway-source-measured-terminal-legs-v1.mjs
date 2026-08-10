import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-source-heading-real-wall-compact-registration-v8";
const CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSourceMeasuredTerminalConnectorsV2.js";';
const OLD_CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
const MIN_VISIBLE_METERS = 0.25;
const MAX_VISIBLE_METERS = 1.25;
const EXPECTED_VISIBLE_METERS = 0.55;

let registration = fs.readFileSync(registrationPath, "utf8");
if (registration.includes(OLD_CONNECTOR_IMPORT)) {
  registration = registration.replace(OLD_CONNECTOR_IMPORT, CONNECTOR_IMPORT);
}
if (!registration.includes(CONNECTOR_IMPORT)) {
  throw new Error(`${registrationPath}: source-measured static connector import is missing`);
}

// A source-placement coordinate mismatch must be repaired by translating the
// complete rigid supplied jetway to the measured facade, not by drawing a huge
// synthetic corridor. Keep a hard visual envelope here so the fleet can never
// regress to the prior 0-43 m white-box policy.
registration = registration
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replace(/const TARGET_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${EXPECTED_VISIBLE_METERS};`)
  .replaceAll(
    "Static visible vestibule envelope escaped photo bounds",
    "Static compact real-wall vestibule envelope is invalid",
  )
  .replaceAll(
    "Static source-measured terminal-leg envelope is invalid",
    "Static compact real-wall vestibule envelope is invalid",
  );

if (!registration.includes(`const AUTHORITY = "${SOURCE_POSE_AUTHORITY}";`)) {
  throw new Error(`${registrationPath}: compact source-heading real-wall authority is missing`);
}
for (const required of [
  CONNECTOR_IMPORT,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${EXPECTED_VISIBLE_METERS};`,
  SOURCE_POSE_AUTHORITY,
  "Static compact real-wall vestibule envelope is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: compact real-wall fleet envelope is missing ${required}`);
  }
}
for (const forbidden of [
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 43;",
  "0-43",
  "source-locked wall fit would require an invalid visible terminal leg",
  "Static visible vestibule envelope escaped photo bounds",
  "Static source-measured terminal-leg envelope is invalid",
  OLD_CONNECTOR_IMPORT,
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: retired giant-corridor policy survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log(`Enforced a ${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m static real-wall vestibule envelope (target ${EXPECTED_VISIBLE_METERS} m). Any placement that would need a long synthetic Terminal 4 corridor now fails instead of rendering one.`);