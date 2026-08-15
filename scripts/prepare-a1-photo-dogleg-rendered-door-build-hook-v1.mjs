import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-photo-dogleg-rendered-door-build-hook-v2-final-photo-geometry";
const baseline = '  await run(npmCommand, ["exec", "--", "vite", "build"]);';
const replacement = `  // ${marker}\n  // The legacy runtime preparation stack still contains compact-A1 passes that\n  // can run after the Aug. 15 photo repair. Reapply the photo-authoritative A1\n  // geometry at the final bundle boundary, after ALL runtime preparers and just\n  // before Vite. This changes generated fixed terminal-side geometry only; the\n  // exact supplied Airport_Jetway.glb and all of its child transforms remain\n  // untouched. A1 alone gets the long fixed dogleg and two permanent columns;\n  // A3+ retain their own short/direct terminal-side connectors.\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-fixed-corridor-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-dogleg-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-fixed-support-columns-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-terminal-shell-passenger-y-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-marker-compat-v1.mjs"]);\n  // The Aug. 15 A1 reference also requires the late rendered-door validator to\n  // understand the long two-leg fixed corridor. Patch that validator only for\n  // the Vite bundle, then restore its tracked source byte-for-byte.\n  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs"]);`;

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  if (!source.includes(baseline)) {
    throw new Error(`${buildPath}: final Vite invocation is missing for A1 photo-dogleg build hook`);
  }
  source = source.replace(baseline, replacement);
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
for (const required of [
  marker,
  "prepare-a1-real-photo-fixed-corridor-v1.mjs",
  "prepare-a1-real-photo-dogleg-v1.mjs",
  "prepare-a1-photo-fixed-support-columns-v1.mjs",
  "prepare-a1-terminal-shell-passenger-y-v1.mjs",
  "prepare-a1-final-marker-compat-v1.mjs",
  "run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs",
]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: A1 final photo-authoritative bundle hook is missing ${required}`);
  }
}
if (source.includes(baseline)) {
  throw new Error(`${buildPath}: unwrapped Vite build survived A1 photo-dogleg hook`);
}

console.log(`Installed ${marker}: after every legacy runtime preparer, final Vite bundling reapplies the Aug. 15 A1 fixed dogleg, exactly two permanent support columns, passenger-height shell, photo acceptance markers, and the photo-aware rendered-door validator while leaving Airport_Jetway.glb untouched.`);
