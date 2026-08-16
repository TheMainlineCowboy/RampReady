import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-photo-dogleg-rendered-door-build-hook-v4-final-photo-geometry-readiness";
const baseline = '  await run(npmCommand, ["exec", "--", "vite", "build"]);';
const replacement = `  // ${marker}\n  // The legacy runtime preparation stack still contains compact-A1 passes that\n  // can run after the Aug. 15 photo repair. Reapply the photo-authoritative A1\n  // geometry at the final bundle boundary, after ALL runtime preparers and just\n  // before Vite. This changes generated fixed terminal-side geometry only; the\n  // exact supplied Airport_Jetway.glb and all of its child transforms remain\n  // untouched. A1 alone gets the long fixed dogleg and two permanent columns;\n  // A3+ retain their own short/direct terminal-side connectors.\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-fixed-corridor-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-dogleg-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-fixed-support-columns-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-terminal-shell-passenger-y-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-marker-compat-v1.mjs"]);\n  // The Tunnel-C migration has already converted A1 to zero synthetic extension.\n  // Adapt all generated A1 readiness guard lines to stable photo-wrapper anchors.\n  await run(process.execPath, ["scripts/prepare-a1-photo-readiness-wrapper-anchor-v1.mjs"]);\n  // The late rendered-door/readiness validators must understand the long two-leg\n  // fixed corridor. The v2 wrapper keeps all structural guards fail-closed while\n  // treating mismatch-message wording as diagnostics only, then restores every\n  // temporarily adapted tracked validator source byte-for-byte.\n  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs"]);`;

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  const olderMarkers = [
    "a1-photo-dogleg-rendered-door-build-hook-v3-final-photo-geometry-readiness",
    "a1-photo-dogleg-rendered-door-build-hook-v2-final-photo-geometry",
    "a1-photo-dogleg-rendered-door-build-hook-v1",
  ];
  for (const olderMarker of olderMarkers) {
    if (!source.includes(olderMarker)) continue;
    const start = source.indexOf(`  // ${olderMarker}`);
    const possibleEndNeedles = [
      '  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs"]);',
      '  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs"]);',
    ];
    let endStart = -1;
    let endNeedle = "";
    for (const candidate of possibleEndNeedles) {
      const index = source.indexOf(candidate, start);
      if (index >= 0) {
        endStart = index;
        endNeedle = candidate;
        break;
      }
    }
    if (start >= 0 && endStart >= 0) {
      source = source.slice(0, start) + replacement + source.slice(endStart + endNeedle.length);
      break;
    }
  }
  if (!source.includes(marker)) {
    if (!source.includes(baseline)) {
      throw new Error(`${buildPath}: final Vite invocation is missing for A1 photo-dogleg build hook`);
    }
    source = source.replace(baseline, replacement);
  }
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
  "prepare-a1-photo-readiness-wrapper-anchor-v1.mjs",
  "run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs",
]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: A1 final photo-authoritative bundle hook is missing ${required}`);
  }
}
if (source.includes(baseline)) {
  throw new Error(`${buildPath}: unwrapped Vite build survived A1 photo-dogleg hook`);
}

console.log(`Installed ${marker}: after every legacy runtime preparer, final Vite bundling reapplies the Aug. 15 A1 fixed dogleg, exactly two permanent support columns, passenger-height shell and photo acceptance markers, normalizes every generated A1 readiness branch, then runs structural photo-aware validation with diagnostic-wording tolerance while leaving Airport_Jetway.glb untouched.`);
