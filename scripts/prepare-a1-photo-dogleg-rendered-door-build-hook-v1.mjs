import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-photo-dogleg-rendered-door-build-hook-v1";
const baseline = '  await run(npmCommand, ["exec", "--", "vite", "build"]);';
const replacement = `  // ${marker}\n  // The Aug. 15 A1 reference requires the late rendered-door validator to\n  // understand the long two-leg fixed corridor. Patch that validator only for\n  // the Vite bundle, then restore its tracked source byte-for-byte.\n  await run(process.execPath, ["scripts/run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs"]);`;

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  if (!source.includes(baseline)) {
    throw new Error(`${buildPath}: final Vite invocation is missing for A1 photo-dogleg build hook`);
  }
  source = source.replace(baseline, replacement);
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker) || !source.includes("run-vite-with-a1-photo-dogleg-rendered-door-v1.mjs")) {
  throw new Error(`${buildPath}: A1 photo-dogleg rendered-door Vite hook was not installed`);
}
if (source.includes(baseline)) {
  throw new Error(`${buildPath}: unwrapped Vite build survived A1 photo-dogleg hook`);
}

console.log(`Installed ${marker}: final Vite bundling temporarily applies the photo-authoritative A1 rendered-door validator and restores tracked source afterward.`);
