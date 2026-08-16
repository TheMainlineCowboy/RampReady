import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-photo-dogleg-rendered-door-build-hook-v6-bogie-footprint-camera";
const baseline = '  await run(npmCommand, ["exec", "--", "vite", "build"]);';
const replacement = `  // ${marker}\n  // Reapply the Aug. 15 photo-authoritative A1 geometry after every legacy\n  // runtime preparer and immediately before Vite. The supplied GLB remains\n  // untouched; A1 alone gets the long dogleg and two permanent fixed supports.\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-fixed-corridor-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-dogleg-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-fixed-support-columns-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-terminal-shell-passenger-y-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-marker-compat-v1.mjs"]);\n  // Keep the balanced terminal-joint evidence camera, then validate bogie-camera\n  // identity from the actual transformed visible Tunnel_C low-contact footprint\n  // instead of forcing the authored wheel/support centroid onto the bridge axis.\n  await run(process.execPath, ["scripts/prepare-a1-balanced-apron-evidence-camera-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);\n  // Normalize all generated A1 readiness guards to stable photo-wrapper anchors.\n  await run(process.execPath, ["scripts/prepare-a1-photo-readiness-wrapper-anchor-v1.mjs"]);\n  // Bundle with structural photo-aware validation; diagnostic wording alone may\n  // vary, but dogleg/support/zero-extension/length guards remain fail-closed.\n  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs"]);`;

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  const olderMarkers = [
    "a1-photo-dogleg-rendered-door-build-hook-v5-balanced-camera-photo-readiness",
    "a1-photo-dogleg-rendered-door-build-hook-v4-final-photo-geometry-readiness",
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
  "prepare-a1-balanced-apron-evidence-camera-v1.mjs",
  "prepare-a1-bogie-footprint-camera-v1.mjs",
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

console.log(`Installed ${marker}: final Vite bundling reapplies the Aug. 15 A1 dogleg/two-support geometry, keeps the balanced terminal-joint camera, validates bogie evidence from the real transformed Tunnel_C footprint, normalizes every generated A1 readiness branch, and leaves Airport_Jetway.glb untouched.`);
