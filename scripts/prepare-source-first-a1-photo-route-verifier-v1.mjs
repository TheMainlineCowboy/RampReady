import fs from "node:fs";

const testPath = "tests/browser/source-first-a1-repair.spec.js";
const source = fs.readFileSync(testPath, "utf8");

const staleWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05`;
const photoWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Number(data?.a1ExactRotundaToWallWorldMeters) > 18\n      && Number(data?.a1ExactRotundaToWallWorldMeters) < 30`;

const staleAssertions = `  expect(finalRotundaToWallDistance).toBeGreaterThan(2.9);\n  expect(finalRotundaToWallDistance).toBeLessThan(5.8);\n  expect(Math.abs(finalRotundaToWallDistance - terminalWallDistance)).toBeLessThanOrEqual(0.05);`;
const photoAssertions = `  // Aug. 15 KPHX photo authority: A1 uses a long fixed corridor/dogleg to a remote Rotunda.\n  // terminalWallDistance is separate source-local wall telemetry and must not be equated to that route.\n  expect(finalRotundaToWallDistance).toBeGreaterThan(18);\n  expect(finalRotundaToWallDistance).toBeLessThan(30);`;

const waitMatches = source.split(staleWait).length - 1;
const assertionMatches = source.split(staleAssertions).length - 1;
if (waitMatches !== 1 || assertionMatches !== 1) {
  throw new Error(
    `source-first A1 photo-route verifier anchors changed (wait=${waitMatches}, assertions=${assertionMatches}); refusing a broad rewrite`,
  );
}

const patched = source
  .replace(staleWait, photoWait)
  .replace(staleAssertions, photoAssertions);

fs.writeFileSync(testPath, patched);
console.log("Prepared source-first A1 verifier for the Aug. 15 long fixed corridor/dogleg and remote Rotunda route.");
