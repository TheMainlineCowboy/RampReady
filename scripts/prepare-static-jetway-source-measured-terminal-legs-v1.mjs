import fs from "node:fs";

await import(`./prepare-static-jetway-own-gate-lengths-v1.mjs?own-gate-lengths=${Date.now()}`);

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";
const CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSourceMeasuredTerminalConnectorsV2.js";';
const OLD_CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
const MIN_VISIBLE_METERS = 0;
const MAX_VISIBLE_METERS = 8;

let registration = fs.readFileSync(registrationPath, "utf8");
if (registration.includes(OLD_CONNECTOR_IMPORT)) {
  registration = registration.replace(OLD_CONNECTOR_IMPORT, CONNECTOR_IMPORT);
}
if (!registration.includes(CONNECTOR_IMPORT)) {
  throw new Error(`${registrationPath}: source-measured static connector import is missing`);
}

// Source-pose policy: the KPHX BGL owns the fixed Rotunda/pivot position and
// heading. The real wall measurement may size the terminal sleeve, but this
// stage must never translate the complete supplied jetway toward a wall or yaw
// it toward a training-aircraft target. A large sleeve is therefore a hard
// diagnostic that the terminal/source coordinate frames disagree; it is not a
// reason to move the airport-authored jetway.
registration = registration
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replaceAll(
    "Static compact real-wall vestibule envelope is invalid",
    "Static source-pose terminal sleeve is outside the authored facade envelope",
  )
  .replaceAll(
    "Static visible vestibule envelope escaped photo bounds",
    "Static source-pose terminal sleeve is outside the authored facade envelope",
  )
  .replaceAll(
    "Static source-measured terminal-leg envelope is invalid",
    "Static source-pose terminal sleeve is outside the authored facade envelope",
  );

if (!registration.includes(`const AUTHORITY = "${SOURCE_POSE_AUTHORITY}";`)) {
  throw new Error(`${registrationPath}: decoded KPHX source-pose authority is missing`);
}
for (const required of [
  CONNECTOR_IMPORT,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  SOURCE_POSE_AUTHORITY,
  "const rotundaX = sourceX;",
  "const rotundaZ = sourceZ;",
  "const yaw = sourceYaw;",
  "sourceParentYawErrorRadians",
  "Static source-pose terminal sleeve is outside the authored facade envelope",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: source-pose static fleet envelope is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = targetRegistrationYaw;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "source-locked wall fit would require an invalid visible terminal leg",
  OLD_CONNECTOR_IMPORT,
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: target-driven static placement survived source-pose preparation: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
await import(`./prepare-static-jetway-post-registration-lengths-v1.mjs?post-wall-lengths=${Date.now()}`);
console.log(`Preserved decoded KPHX position/yaw through static terminal-leg preparation, limited source-measured terminal sleeves to ${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m, and recalculated bridge lengths without moving or re-aiming any fixed jetway.`);
