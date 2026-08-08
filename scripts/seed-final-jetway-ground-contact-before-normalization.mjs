import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualReject = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const positiveGuard = "Number.isFinite(bogieTireCorrection) && bogieTireCorrection > 0";
const mismatchAnchor = `          if (\n            count !== EXPECTED_GATE_COUNT`;

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

const seeded = [];
if (!source.includes(residualReject)) seeded.push(residualReject);
if (!source.includes(positiveGuard)) seeded.push(`!(${positiveGuard})`);

if (seeded.length) {
  if (!source.includes(mismatchAnchor)) {
    throw new Error(`${readinessPath}: final exact-fleet readiness mismatch block is missing`);
  }
  source = source.replace(
    mismatchAnchor,
    `          if (\n            ${seeded.join("\n            || ")}\n            || count !== EXPECTED_GATE_COUNT`,
  );
}

for (const required of [residualReject, positiveGuard]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: failed to seed physical ground-contact readiness ${required}`);
  }
}

fs.writeFileSync(readinessPath, source, "utf8");
console.log("Seeded final jetway ground-contact readiness at the invariant mismatch block without depending on retired source-string anchors.");

await import(`./normalize-final-jetway-readiness-after-runtime.mjs?seeded-ground-contact=${Date.now()}`);
