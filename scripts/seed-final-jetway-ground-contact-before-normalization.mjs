import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualReject = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const positiveGuard = "Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0";

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

const seeded = [];
if (!source.includes(residualReject)) seeded.push(residualReject);
if (!source.includes(positiveGuard)) seeded.push(`!(${positiveGuard})`);

if (seeded.length) {
  const countGuardPattern = /^(\s*)count !== EXPECTED_GATE_COUNT\s*$/m;
  const countGuardMatch = source.match(countGuardPattern);
  if (!countGuardMatch) {
    throw new Error(`${readinessPath}: final exact-fleet count guard is missing`);
  }
  const indent = countGuardMatch[1];
  const injected = `${seeded.map((guard) => `${indent}${guard}`).join(`\n${indent}|| `)}\n${indent}|| count !== EXPECTED_GATE_COUNT`;
  source = source.replace(countGuardPattern, injected);
}

for (const required of [residualReject, positiveGuard]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: failed to seed physical ground-contact readiness ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Seeded final jetway ground-contact readiness beside the invariant exact-fleet count guard without depending on surrounding generated formatting.");

await import(`./normalize-final-jetway-readiness-after-runtime.mjs?seeded-ground-contact=${Date.now()}`);
