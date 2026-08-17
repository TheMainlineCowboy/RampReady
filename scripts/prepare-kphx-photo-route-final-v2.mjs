import fs from 'node:fs';

const paths = [
  'tests/browser/kphx-ground-runtime.spec.js',
  'tests/browser/a1-terminal-joint-bogie-subviews.spec.js',
];

const staleWait = '      && Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05';
const photoWait = '      && Number(data?.a1ExactRotundaToWallWorldMeters) > 18\n      && Number(data?.a1ExactRotundaToWallWorldMeters) < 30';
const staleInlineAssertion = /expect\(Math\.abs\(Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\)\)\)\.toBeLessThanOrEqual\(0\.05\);/g;
const staleMultilineAssertion = /expect\(Math\.abs\(\s*Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\),?\s*\)\)\.toBeLessThanOrEqual\(0\.05\);/g;

for (const path of paths) {
  let source = fs.readFileSync(path, 'utf8');
  let replacements = 0;

  const waitCount = source.split(staleWait).length - 1;
  if (waitCount > 0) {
    source = source.split(staleWait).join(photoWait);
    replacements += waitCount;
  }

  source = source.replace(staleInlineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(18);\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThan(30);`;
  });
  source = source.replace(staleMultilineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(18);\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThan(30);`;
  });

  if (source.includes('Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05')) {
    throw new Error(`${path}: compact A1 wall equality survived final photo-route preparation`);
  }
  if (!source.includes('a1ExactRotundaToWallWorldMeters')) {
    throw new Error(`${path}: final A1 Rotunda-to-wall telemetry is missing`);
  }
  if (!source.includes('a1ExactRotundaToWallWorldMeters) > 18') && !source.includes('a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(18)')) {
    throw new Error(`${path}: Aug. 15 long A1 route lower bound is missing`);
  }

  fs.writeFileSync(path, source);
  console.log(`${path}: final Aug. 15 A1 photo-route authority applied (${replacements} stale compact equalities removed).`);
}
