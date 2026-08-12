import fs from "node:fs";

await import(`./prepare-static-jetway-own-gate-lengths-v1.mjs?own-gate-lengths=${Date.now()}`);

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_POSE_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";
const CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSourceMeasuredTerminalConnectorsV2.js";';
const OLD_CONNECTOR_IMPORT = 'import { addStaticSolidTerminalVestibules } from "./staticSolidTerminalVestibulesV1.js";';
const MIN_VISIBLE_METERS = 0.25;
const MAX_VISIBLE_METERS = 1.25;

let registration = fs.readFileSync(registrationPath, "utf8");
if (registration.includes(OLD_CONNECTOR_IMPORT)) {
  registration = registration.replace(OLD_CONNECTOR_IMPORT, CONNECTOR_IMPORT);
}
if (!registration.includes(CONNECTOR_IMPORT)) {
  throw new Error(`${registrationPath}: source-measured static connector import is missing`);
}

// The replacement GLB Rotunda stays registered to the measured Terminal 4
// facade. Only the decoded KPHX heading owns rigid-parent yaw. This pass may
// recalculate telescope length and connector detail, but it must never restore
// raw BGL x/z as the Rotunda or steer the parent toward a training-aircraft
// target.
registration = registration
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [0-9.]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replaceAll(
    "Static source-pose terminal sleeve is outside the authored facade envelope",
    "Static compact real-wall vestibule envelope is invalid",
  )
  .replaceAll(
    "Static source-measured terminal-leg envelope is invalid",
    "Static compact real-wall vestibule envelope is invalid",
  );

if (!registration.includes(`const AUTHORITY = "${SOURCE_POSE_AUTHORITY}";`)) {
  throw new Error(`${registrationPath}: decoded KPHX source-heading/real-wall authority is missing`);
}
for (const required of [
  CONNECTOR_IMPORT,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  SOURCE_POSE_AUTHORITY,
  "const visibleTerminalLegMeters = 0.55;",
  "const terminalWallOverlapMeters = 0.18;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = sourceYaw;",
  "sourceParentYawErrorRadians",
  "Static compact real-wall vestibule envelope is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: real-wall/source-heading static fleet envelope is missing ${required}`);
  }
}
for (const forbidden of [
  "const yaw = targetRegistrationYaw;",
  "const rotundaX = sourceX;",
  "const rotundaZ = sourceZ;",
  "authored source-pose terminal span is invalid",
  OLD_CONNECTOR_IMPORT,
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: raw-origin/target-driven static placement survived terminal-leg preparation: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
await import(`./prepare-static-jetway-post-registration-lengths-v1.mjs?post-wall-lengths=${Date.now()}`);
console.log(`Preserved measured real-wall Rotunda registration and decoded KPHX parent yaw through static terminal-leg preparation, retained the ${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m compact facade sleeve, and recalculated bridge lengths without re-aiming fixed jetways.`);