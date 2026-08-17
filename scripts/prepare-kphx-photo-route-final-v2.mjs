import fs from 'node:fs';

const paths = [
  'tests/browser/kphx-ground-runtime.spec.js',
  'tests/browser/a1-terminal-joint-bogie-subviews.spec.js',
];

const staleWaitPattern = /^(\s*)&&\s*Math\.abs\(Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(data\?\.terminal4A1JetwayWallDistance\)\)\s*<=\s*0\.05\s*$/gm;
const staleInlineAssertion = /expect\(Math\.abs\(Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\)\)\)\.toBeLessThanOrEqual\(0\.05\);/g;
const staleMultilineAssertion = /expect\(Math\.abs\(\s*Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\),?\s*\)\)\.toBeLessThanOrEqual\(0\.05\);/g;
const anyCompactWaitPattern = /Math\.abs\(Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(data\?\.terminal4A1JetwayWallDistance\)\)\s*<=\s*0\.05/;
const longWaitPattern = /Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*>\s*18[\s\S]{0,180}Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*<\s*30/;
const longAssertionPattern = /a1ExactRotundaToWallWorldMeters\)\)\.toBeGreaterThan\(18\)[\s\S]{0,180}a1ExactRotundaToWallWorldMeters\)\)\.toBeLessThan\(30\)/;

for (const path of paths) {
  let source = fs.readFileSync(path, 'utf8');
  let replacements = 0;

  source = source.replace(staleWaitPattern, (_match, indent) => {
    replacements += 1;
    return `${indent}&& Number(data?.a1ExactRotundaToWallWorldMeters) > 18\n${indent}&& Number(data?.a1ExactRotundaToWallWorldMeters) < 30`;
  });

  source = source.replace(staleInlineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(18);\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThan(30);`;
  });
  source = source.replace(staleMultilineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(18);\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThan(30);`;
  });

  if (anyCompactWaitPattern.test(source)) {
    throw new Error(`${path}: compact A1 wall equality survived final photo-route preparation`);
  }
  if (!source.includes('a1ExactRotundaToWallWorldMeters')) {
    throw new Error(`${path}: final A1 Rotunda-to-wall telemetry is missing`);
  }
  if (!longWaitPattern.test(source) && !longAssertionPattern.test(source)) {
    throw new Error(`${path}: Aug. 15 long A1 route 18-30 m authority is missing after normalization`);
  }

  fs.writeFileSync(path, source);
  console.log(`${path}: final Aug. 15 A1 photo-route authority applied (${replacements} stale compact equalities removed).`);
}
