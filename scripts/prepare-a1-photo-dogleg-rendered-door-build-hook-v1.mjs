import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-photo-dogleg-rendered-door-build-hook-v16-cab-sill-surface-fit";
const baseline = '  await run(npmCommand, ["exec", "--", "vite", "build"]);';
const replacement = `  // ${marker}\n  // Reapply the Aug. 15 photo-authoritative A1 geometry after every legacy\n  // runtime preparer and immediately before Vite. First republish the explicit\n  // BGATE1 facade endpoint, restore the measured/photo inputs, bind final runtime\n  // construction to that explicit facade point, then put the COMPLETE exact A1\n  // parent at a genuinely remote Rotunda without moving Terminal 4 or aircraft.\n  await run(process.execPath, ["scripts/prepare-a1-photo-explicit-terminal-wall-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-fixed-corridor-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-explicit-photo-wall-runtime-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-remote-rotunda-placement-v2.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-photo-telemetry-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-real-photo-dogleg-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-fixed-support-columns-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-terminal-shell-passenger-y-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-marker-compat-v1.mjs"]);\n  // With the terminal/fixed A1 path now final, articulate only the exact supplied\n  // movable GLB toward the aircraft-side target and rebase deployment.\n  await run(process.execPath, ["scripts/prepare-a1-final-physical-door-fit-controller-rebase-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-balanced-apron-evidence-camera-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-final-visible-geometry-normalization-v1.mjs"]);\n  // Replace stale nose-derived door coordinates with the exact committed CRJ GLB\n  // forward-left passenger-door component. The aircraft pose remains an input.\n  await run(process.execPath, ["scripts/prepare-a1-exact-authored-crj-door-target-v1.mjs"]);\n  // The opaque Tunnel-C carrier includes both passenger shell and low hardware;\n  // never translate the whole carrier merely to force its low triangles to ramp.\n  await run(process.execPath, ["scripts/prepare-a1-preserve-integrated-tunnel-c-carrier-v1.mjs"]);\n  // Resolve the boarding threshold from the FINAL supplied Cab surface facing the\n  // exact fixed CRJ door, then articulate only the supplied Cab vertically until\n  // its physical sill meets the door. Tunnel-C continuity remains fail-closed.\n  await run(process.execPath, ["scripts/prepare-a1-final-cab-sill-surface-fit-v1.mjs"]);\n  // Service-stair clearance is evaluated after the final Cab/Tunnel-C pose exists.\n  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);\n  // Remove all legacy behavior that moves the CRJ to whichever Cab position exists.\n  await run(process.execPath, ["scripts/prepare-a1-fixed-aircraft-exact-door-runtime-v1.mjs"]);\n  // Prove the fixed authored door against the exact transformed Cab hood footprint.\n  await run(process.execPath, ["scripts/prepare-a1-final-cab-footprint-door-contact-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);\n  await run(process.execPath, ["scripts/prepare-a1-photo-readiness-wrapper-anchor-v1.mjs"]);\n  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs"]);`;

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  const olderMarkers = [
    "a1-photo-dogleg-rendered-door-build-hook-v15-final-cab-footprint",
    "a1-photo-dogleg-rendered-door-build-hook-v14-fixed-aircraft-exact-door",
    "a1-photo-dogleg-rendered-door-build-hook-v13-preserve-integrated-tunnel-c",
    "a1-photo-dogleg-rendered-door-build-hook-v12-aircraft-side-stair-clearance",
    "a1-photo-dogleg-rendered-door-build-hook-v11-final-visible-normalization",
    "a1-photo-dogleg-rendered-door-build-hook-v10-physical-door-fit-rebase",
    "a1-photo-dogleg-rendered-door-build-hook-v9-final-photo-telemetry",
    "a1-photo-dogleg-rendered-door-build-hook-v8-explicit-bgate1-wall",
    "a1-photo-dogleg-rendered-door-build-hook-v7-genuinely-remote-rotunda",
    "a1-photo-dogleg-rendered-door-build-hook-v6-bogie-footprint-camera",
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
  "prepare-a1-photo-explicit-terminal-wall-v1.mjs",
  "prepare-a1-real-photo-fixed-corridor-v1.mjs",
  "prepare-a1-final-explicit-photo-wall-runtime-v1.mjs",
  "prepare-a1-photo-remote-rotunda-placement-v2.mjs",
  "prepare-a1-final-photo-telemetry-v1.mjs",
  "prepare-a1-real-photo-dogleg-v1.mjs",
  "prepare-a1-photo-fixed-support-columns-v1.mjs",
  "prepare-a1-terminal-shell-passenger-y-v1.mjs",
  "prepare-a1-final-marker-compat-v1.mjs",
  "prepare-a1-final-physical-door-fit-controller-rebase-v1.mjs",
  "prepare-a1-balanced-apron-evidence-camera-v1.mjs",
  "prepare-a1-final-visible-geometry-normalization-v1.mjs",
  "prepare-a1-exact-authored-crj-door-target-v1.mjs",
  "prepare-a1-preserve-integrated-tunnel-c-carrier-v1.mjs",
  "prepare-a1-final-cab-sill-surface-fit-v1.mjs",
  "prepare-a1-aircraft-side-service-stair-clearance-v1.mjs",
  "prepare-a1-fixed-aircraft-exact-door-runtime-v1.mjs",
  "prepare-a1-final-cab-footprint-door-contact-v1.mjs",
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

console.log(`Installed ${marker}: final Vite bundling preserves A1's photo dogleg/remote Rotunda, keeps the exact CRJ fixed, targets the exact authored forward-left door, preserves Tunnel-C as one continuous supplied passenger tunnel, fits the supplied Cab's real boarding sill surface to that door, proves final hood contact, validates supplied service-stair/bogie clearance, and then runs strict final-world verification.`);
