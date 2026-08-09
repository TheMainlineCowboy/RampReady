import fs from "node:fs";

const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const vestibulePath = "src/environment/staticSolidTerminalVestibulesV1.js";
const AUTHORITY = "57-static-source-measured-real-wall-fixed-terminal-legs-v2";
const MIN_VISIBLE_METERS = 0.15;
const MAX_VISIBLE_METERS = 43;

let registration = fs.readFileSync(registrationPath, "utf8");
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
registration = registration.replace(
  'const AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";',
  `const AUTHORITY = "${AUTHORITY}";`,
);
if (!registration.includes(AUTHORITY)) throw new Error(`${registrationPath}: source-measured static authority is missing`);
if (registration.includes("source-locked wall fit would require an invalid visible terminal leg")) {
  throw new Error(`${registrationPath}: retired 3.6 m static terminal-leg rejection survived`);
}
fs.writeFileSync(registrationPath, registration, "utf8");

let vestibule = fs.readFileSync(vestibulePath, "utf8");
vestibule = vestibule
  .replace(
    'const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";',
    `const STATIC_SOLID_VESTIBULE_AUTHORITY = "${AUTHORITY}";`,
  )
  .replace(
    'const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;',
    `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  )
  .replace(
    'const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;',
    `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  )
  .replaceAll("measured compact solid white jetway vestibule", "source-measured solid fixed terminal connector")
  .replaceAll("attempted to fabricate a long terminal corridor", "source-measured fixed terminal connector exceeds the airport wall span envelope");

for (const required of [
  `const STATIC_SOLID_VESTIBULE_AUTHORITY = "${AUTHORITY}";`,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
]) {
  if (!vestibule.includes(required)) throw new Error(`${vestibulePath}: source-measured fixed terminal leg is missing ${required}`);
}
for (const forbidden of [
  "57-static-short-solid-white-terminal-vestibules-v1",
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;",
  "attempted to fabricate a long terminal corridor",
]) {
  if (vestibule.includes(forbidden)) throw new Error(`${vestibulePath}: retired compact static connector rule survived: ${forbidden}`);
}
fs.writeFileSync(vestibulePath, vestibule, "utf8");

console.log(`Allowed all 57 static exact jetways to keep their real source-measured Terminal 4 wall-to-Rotunda fixed-leg lengths (${MIN_VISIBLE_METERS}-${MAX_VISIBLE_METERS} m) instead of relocating/rejecting gates to satisfy the retired 1.2-3.6 m compact rule (${AUTHORITY}).`);
