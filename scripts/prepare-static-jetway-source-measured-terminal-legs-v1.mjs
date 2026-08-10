import fs from "node:fs";

await import(`./prepare-static-jetway-own-gate-lengths-v1.mjs?own-gate-lengths=${Date.now()}`);

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";
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
// synthetic corridor. This is the giant-corridor policy guard: keep a hard
// visual envelope here so the fleet can never regress to the prior 0-43 m
// white-box behavior. Final aircraft-side yaw is owned by each gate's own
// authored target, not by a raw heading that can cross stands.
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
  throw new Error(`${registrationPath}: compact own-gate real-wall authority is missing`);
}
for (const required of [
  CONNECTOR_IMPORT,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${EXPECTED_VISIBLE_METERS};`,
  SOURCE_POSE_AUTHORITY,
  "const yaw = targetRegistrationYaw;",
  "staticOwnGateHeadingErrorRadians",
  "Static compact real-wall vestibule envelope is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: compact own-gate real-wall fleet envelope is missing ${required}`);
  }
}
for (const forbidden of [
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 43;",
  "0-43",
  "source-locked wall fit would require an invalid visible terminal leg",
  "Static visible vestibule envelope escaped photo bounds",
  "Static source-measured terminal-leg envelope is invalid",
  "const yaw = sourceYaw;",
  OLD_CONNECTOR_IMPORT,
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: retired giant-corridor/source-yaw policy survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
await import(`./prepare-static-jetway-post-registration-lengths-v1.mjs?post-wall-lengths=${Date.now()}`);
console.log(`Enforced a ${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m static real-wall vestibule envelope (target ${EXPECTED_VISIBLE_METERS} m), preserved own-gate target yaw, then recalculated every static exact-GLB length from the final registered Rotunda. Long synthetic corridors, cross-stand raw-heading ownership and pre-wall length guesses now fail.`);
