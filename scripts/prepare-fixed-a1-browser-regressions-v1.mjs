import fs from "node:fs";

const articulationAuthority = "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only";

{
  const path = "tests/browser/crj700-runtime.spec.js";
  let source = fs.readFileSync(path, "utf8");
  source = source.replaceAll(
    "user-supplied-airport-jetway-per-gate-telescoping-v10",
    articulationAuthority,
  );
  if (!source.includes(articulationAuthority)) {
    throw new Error(`${path}: corrected A1-only articulation authority is missing`);
  }
  if (source.includes("user-supplied-airport-jetway-per-gate-telescoping-v10")) {
    throw new Error(`${path}: retired all-gate articulation authority remains`);
  }
  fs.writeFileSync(path, source, "utf8");
}

{
  const path = "tests/browser/uploaded-jetway-articulation-v10.spec.js";
  let source = fs.readFileSync(path, "utf8");
  const oldRange = `  expect(target).toBeGreaterThan(30.3);
  expect(target).toBeLessThan(30.8);
  expect(extension).toBeGreaterThan(4.2);
  expect(extension).toBeLessThan(4.8);`;
  const newRange = `  // With the airplane fixed at the real A1 source stop, the bridge must reach
  // the authored aircraft door rather than moving the aircraft to satisfy an
  // obsolete reach constant from the old Cab-follow behavior.
  expect(target).toBeGreaterThan(sourceReach);
  expect(extension).toBeGreaterThan(0);
  expect(extension).toBeLessThanOrEqual(8.75);
  expect(Math.abs((sourceReach + extension) - predictedContact)).toBeLessThanOrEqual(0.05);`;
  if (source.includes(oldRange)) {
    source = source.replace(oldRange, newRange);
  } else if (!source.includes("expect(target).toBeGreaterThan(sourceReach);")) {
    throw new Error(`${path}: fixed-gate A1 reach assertion anchor is missing`);
  }
  for (const stale of [
    "expect(target).toBeGreaterThan(30.3)",
    "expect(target).toBeLessThan(30.8)",
    "expect(extension).toBeGreaterThan(4.2)",
    "expect(extension).toBeLessThan(4.8)",
  ]) {
    if (source.includes(stale)) throw new Error(`${path}: stale movable-aircraft A1 reach check remains: ${stale}`);
  }
  for (const required of [
    "expect(target).toBeGreaterThan(sourceReach);",
    "expect(extension).toBeLessThanOrEqual(8.75);",
    "expectSamePose(trainingPose, freeDrivePose);",
    "expectSamePose(returnedPose, freeDrivePose);",
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: fixed-aircraft regression proof is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log("Updated browser regressions for A1-only articulation: CRJ readiness accepts v11 and the jetway suite keeps the aircraft fixed while validating geometric reach instead of retired magic distances.");
