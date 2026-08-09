import fs from "node:fs";

const articulationAuthority = "user-supplied-airport-jetway-source-connected-attached-v12-a1-retracts-inward-only";
const retiredAuthorities = [
  "user-supplied-airport-jetway-per-gate-telescoping-v10",
  "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only",
];

{
  const path = "tests/browser/crj700-runtime.spec.js";
  let source = fs.readFileSync(path, "utf8");
  for (const retired of retiredAuthorities) source = source.replaceAll(retired, articulationAuthority);
  if (!source.includes(articulationAuthority)) {
    throw new Error(`${path}: connected A1 articulation authority is missing`);
  }
  for (const retired of retiredAuthorities) {
    if (source.includes(retired)) throw new Error(`${path}: retired stretched articulation authority remains: ${retired}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

{
  const path = "tests/browser/uploaded-jetway-articulation-v10.spec.js";
  let source = fs.readFileSync(path, "utf8");

  for (const retired of retiredAuthorities) source = source.replaceAll(retired, articulationAuthority);

  const oldMagicRange = `  expect(target).toBeGreaterThan(30.3);
  expect(target).toBeLessThan(30.8);
  expect(extension).toBeGreaterThan(4.2);
  expect(extension).toBeLessThan(4.8);`;
  const previousPositiveStretchRange = `  // With the airplane fixed at the real A1 source stop, the bridge must reach
  // the authored aircraft door rather than moving the aircraft to satisfy an
  // obsolete reach constant from the old Cab-follow behavior.
  expect(target).toBeGreaterThan(sourceReach);
  expect(extension).toBeGreaterThan(0);
  expect(extension).toBeLessThanOrEqual(8.75);
  expect(Math.abs((sourceReach + extension) - predictedContact)).toBeLessThanOrEqual(0.05);`;
  const connectedSourceRange = `  // The live mobile failure was caused by stretching sibling Tunnel B/C/Cab
  // roots toward the aircraft. Attached A1 must keep the exact supplied GLB
  // spacing: zero added extension, source reach == target/contact, and the
  // aircraft conforms to the resulting connected Cab endpoint.
  expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);
  expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(predictedContact - sourceReach)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - sourceReach)).toBeLessThanOrEqual(0.05);`;

  if (source.includes(oldMagicRange)) {
    source = source.replace(oldMagicRange, connectedSourceRange);
  }
  if (source.includes(previousPositiveStretchRange)) {
    source = source.replace(previousPositiveStretchRange, connectedSourceRange);
  }

  const currentPositiveStretchBlock = `  expect(extension).toBeGreaterThan(0);
  expect(extension).toBeLessThanOrEqual(8.75);
  expect(target).toBeGreaterThan(sourceReach);`;
  const currentConnectedBlock = `  expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);
  expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.01);
  expect(Math.abs(predictedContact - sourceReach)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - sourceReach)).toBeLessThanOrEqual(0.05);`;
  if (source.includes(currentPositiveStretchBlock)) {
    source = source.replace(currentPositiveStretchBlock, currentConnectedBlock);
  }

  // Capture the same wide A1 ramp/chase family that exposed the user's two
  // separated turning joints, in addition to the terminal-joint close view.
  const oldA1Capture = `  await captureInspectionPreset(page, "a1Connection", "test-results/uploaded-jetway-a1-articulated-v11.png");`;
  const connectedA1Capture = `  await captureInspectionPreset(page, "a1", "test-results/uploaded-jetway-a1-full-chain-connected-v12.png");
  await captureInspectionPreset(page, "a1Connection", "test-results/uploaded-jetway-a1-terminal-connected-v12.png");`;
  if (source.includes(oldA1Capture)) {
    source = source.replace(oldA1Capture, connectedA1Capture);
  } else if (!source.includes("uploaded-jetway-a1-full-chain-connected-v12.png")) {
    throw new Error(`${path}: full-chain A1 visual evidence capture anchor is missing`);
  }
  source = source.replace(
    'evidenceViews: ["a1Connection", "a14", "b14", "b15"],',
    'evidenceViews: ["a1", "a1Connection", "a14", "b14", "b15"],',
  );

  for (const stale of [
    "expect(target).toBeGreaterThan(30.3)",
    "expect(target).toBeLessThan(30.8)",
    "expect(extension).toBeGreaterThan(4.2)",
    "expect(extension).toBeLessThan(4.8)",
    "expect(target).toBeGreaterThan(sourceReach)",
    "expect(extension).toBeGreaterThan(0)",
    "expect(extension).toBeLessThanOrEqual(8.75)",
  ]) {
    if (source.includes(stale)) throw new Error(`${path}: stale stretched-A1 browser check remains: ${stale}`);
  }
  for (const retired of retiredAuthorities) {
    if (source.includes(retired)) throw new Error(`${path}: retired stretched articulation authority remains: ${retired}`);
  }
  for (const required of [
    articulationAuthority,
    "expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);",
    "expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.01);",
    "expect(Math.abs(predictedContact - sourceReach)).toBeLessThanOrEqual(0.05);",
    "expect(Math.abs(actualContact - sourceReach)).toBeLessThanOrEqual(0.05);",
    "uploaded-jetway-a1-full-chain-connected-v12.png",
    "expectSamePose(trainingPose, freeDrivePose);",
    "expectSamePose(returnedPose, freeDrivePose);",
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: connected A1 regression proof is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log("Updated browser regressions for connected A1 articulation: attached Tunnel B/C/Cab may not stretch apart, the aircraft keeps one Cab-derived pose, and Chromium captures a full-chain A1 ramp view plus the terminal joint.");
