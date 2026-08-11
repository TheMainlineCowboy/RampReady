import fs from "node:fs";

const articulationAuthority = "user-supplied-airport-jetway-source-connected-attached-v12-a1-retracts-inward-only";
const staticArticulationAuthority = "57-static-exact-glb-own-gate-inward-telescope-v2";
const staticSourcePlacementAuthority = "57-static-own-gate-target-real-wall-compact-registration-v9";
const staticHeadingProvenanceAuthority = "57-static-bgl-jetway-heading-provenance-v3";
const retiredAuthorities = [
  "user-supplied-airport-jetway-per-gate-telescoping-v10",
  "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only",
];
const retiredStaticArticulationAuthorities = [
  "57-static-exact-glb-rigid-source-hierarchy-v1",
];
const retiredStaticSourcePlacementAuthorities = [
  "57-static-exact-bgl-source-placement-no-facade-relocation-v1",
  "57-static-authored-rotundas-short-real-wall-registration-v5",
  "57-static-bgl-position-locked-short-real-wall-registration-v6",
  "57-static-bgl-pose-locked-short-real-wall-registration-v7",
  "57-static-source-heading-real-wall-compact-registration-v8",
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
  for (const retired of retiredStaticArticulationAuthorities) source = source.replaceAll(retired, staticArticulationAuthority);
  for (const retired of retiredStaticSourcePlacementAuthorities) source = source.replaceAll(retired, staticSourcePlacementAuthority);

  source = source
    .replace(
      'const STATIC_RIGID_AUTHORITY = "57-static-exact-glb-own-gate-inward-telescope-v2";',
      `const STATIC_RIGID_AUTHORITY = "${staticArticulationAuthority}";`,
    )
    .replace(
      /const STATIC_SOURCE_PLACEMENT_AUTHORITY = "[^"]+";/,
      `const STATIC_SOURCE_PLACEMENT_AUTHORITY = "${staticSourcePlacementAuthority}";\nconst STATIC_HEADING_PROVENANCE_AUTHORITY = "${staticHeadingProvenanceAuthority}";`,
    )
    .replaceAll("rigidSourceHierarchy: true", "inwardTelescopeOnly: true")
    .replace(
      '  expect(placementPass).toContain("uploadedJetwayStaticFacadeRelocationApplied = false");',
      `  expect(placementPass).toContain("uploadedJetwayStaticOwnGateTargetCount = 57");\n  expect(placementPass).toContain("const yaw = targetRegistrationYaw;");\n  expect(placementPass).toContain("ownGateHeadingErrorRadians");\n  expect(placementPass).toContain("terminalFacingDot > 0.25");`,
    )
    .replace(
      'test("A1 uses one aircraft pose and only A1 articulates while all 57 static supplied jetways remain rigid", async ({ page }) => {',
      'test("A1 uses one aircraft pose while all 57 static supplied jetways aim at their own gates and telescope inward only", async ({ page }) => {',
    );

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
  const connectedSourceRange = `  // Attached A1 preserves the exact supplied connected hierarchy. Static gates
  // use their own separate inward-only parked articulation; A1 never stretches
  // sibling Tunnel B/C/Cab roots outward to chase the aircraft.
  expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);
  expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.16);
  expect(Math.abs(predictedContact - target)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - target)).toBeLessThanOrEqual(0.05);`;

  if (source.includes(oldMagicRange)) source = source.replace(oldMagicRange, connectedSourceRange);
  if (source.includes(previousPositiveStretchRange)) source = source.replace(previousPositiveStretchRange, connectedSourceRange);

  const currentPositiveStretchBlock = `  expect(extension).toBeGreaterThan(0);
  expect(extension).toBeLessThanOrEqual(8.75);
  expect(target).toBeGreaterThan(sourceReach);`;
  const currentConnectedBlock = `  expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);
  expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.16);
  expect(Math.abs(predictedContact - target)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - target)).toBeLessThanOrEqual(0.05);`;
  if (source.includes(currentPositiveStretchBlock)) source = source.replace(currentPositiveStretchBlock, currentConnectedBlock);

  const oldThreeDimensionalDistance = `  const geometricRotundaToDoorDistance = Math.hypot(
    renderedDoorTargetX - exactRotundaWorldX,
    renderedDoorTargetY - exactRotundaWorldY,
    renderedDoorTargetZ - exactRotundaWorldZ,
  );`;
  const openingToCabDistance = `  const geometricHorizontalRotundaOpeningToCabDistance = Math.hypot(
    measuredCabX - exactRotundaWorldX,
    measuredCabZ - exactRotundaWorldZ,
  );`;
  if (source.includes(oldThreeDimensionalDistance)) source = source.replace(oldThreeDimensionalDistance, openingToCabDistance);
  source = source
    .replaceAll("geometricRotundaToDoorDistance,", "geometricHorizontalRotundaOpeningToCabDistance,")
    .replaceAll(
      "expect(Math.abs(target - geometricRotundaToDoorDistance)).toBeLessThanOrEqual(0.05);",
      `expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(20);\n  expect(geometricHorizontalRotundaOpeningToCabDistance).toBeLessThan(32);`,
    )
    .replaceAll(
      "geometricHorizontalRotundaToDoorDistance,",
      "geometricHorizontalRotundaOpeningToCabDistance,",
    )
    .replaceAll(
      "expect(Math.abs(target - geometricHorizontalRotundaToDoorDistance)).toBeLessThanOrEqual(0.05);",
      `expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(20);\n  expect(geometricHorizontalRotundaOpeningToCabDistance).toBeLessThan(32);`,
    );

  // Add fleet-wide browser assertions after the existing static articulated count.
  const staticCountAnchor = '  expect(runtime.terminal4UploadedJetwayStaticArticulatedGateCount).toBe("57");';
  const fleetAcceptanceBlock = `${staticCountAnchor}
  expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetAuthority).toBe(STATIC_SOURCE_PLACEMENT_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetCount).toBe("57");
  expect(runtime.terminal4UploadedJetwayStaticSourceHeadingAuthority).toBe(STATIC_HEADING_PROVENANCE_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayStaticSourceHeadingProvenanceGateCount).toBe("57");
  expect(Number(runtime.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians)).toBeLessThanOrEqual(0.002);
  expect(Number(runtime.terminal4UploadedJetwayStaticMaximumTerminalFacingDot)).toBeLessThanOrEqual(0.25);`;
  if (!source.includes("terminal4UploadedJetwayStaticOwnGateTargetAuthority")) {
    if (!source.includes(staticCountAnchor)) throw new Error(`${path}: static fleet runtime assertion anchor is missing`);
    source = source.replace(staticCountAnchor, fleetAcceptanceBlock);
  }

  // Capture the same wide views that exposed crossed stands in the user's fleet.
  const oldA1Capture = `  await captureInspectionPreset(page, "a1Connection", "test-results/uploaded-jetway-a1-articulated-v11.png");`;
  const connectedA1Capture = `  await captureInspectionPreset(page, "a1", "test-results/uploaded-jetway-a1-full-chain-connected-v12.png");
  await captureInspectionPreset(page, "a1Connection", "test-results/uploaded-jetway-a1-terminal-connected-v12.png");`;
  if (source.includes(oldA1Capture)) {
    source = source.replace(oldA1Capture, connectedA1Capture);
  } else if (!source.includes("uploaded-jetway-a1-full-chain-connected-v12.png")) {
    throw new Error(`${path}: full-chain A1 visual evidence capture anchor is missing`);
  }
  source = source
    .replaceAll("uploaded-jetway-a-concourse-static-source-rigid-v11.png", "uploaded-jetway-a-concourse-own-gate-v13.png")
    .replaceAll("uploaded-jetway-b-concourse-static-source-rigid-v11.png", "uploaded-jetway-b-concourse-own-gate-v13.png")
    .replaceAll("uploaded-jetway-b15-static-source-rigid-v11.png", "uploaded-jetway-b15-own-gate-v13.png")
    .replace(
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
    "expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.01)",
    "expect(Math.abs(predictedContact - sourceReach)).toBeLessThanOrEqual(0.05)",
    "expect(Math.abs(actualContact - sourceReach)).toBeLessThanOrEqual(0.05)",
    "geometricRotundaToDoorDistance",
    "geometricHorizontalRotundaToDoorDistance",
    "rigidSourceHierarchy: true",
    "all 57 static supplied jetways remain rigid",
  ]) {
    if (source.includes(stale)) throw new Error(`${path}: stale stretched/rigid A1 or static browser check remains: ${stale}`);
  }
  for (const retired of retiredAuthorities) {
    if (source.includes(retired)) throw new Error(`${path}: retired stretched articulation authority remains: ${retired}`);
  }
  for (const retired of retiredStaticArticulationAuthorities) {
    if (source.includes(retired)) throw new Error(`${path}: retired fixed-length static articulation authority remains: ${retired}`);
  }
  for (const retired of retiredStaticSourcePlacementAuthorities) {
    if (source.includes(retired)) throw new Error(`${path}: retired static source-placement authority remains: ${retired}`);
  }
  for (const required of [
    articulationAuthority,
    staticArticulationAuthority,
    staticSourcePlacementAuthority,
    staticHeadingProvenanceAuthority,
    "inwardTelescopeOnly: true",
    "terminal4UploadedJetwayStaticOwnGateTargetAuthority",
    "terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians",
    "expect(Math.abs(extension)).toBeLessThanOrEqual(0.001);",
    "expect(Math.abs(target - sourceReach)).toBeLessThanOrEqual(0.16);",
    "geometricHorizontalRotundaOpeningToCabDistance",
    "expect(Math.hypot(renderedDoorTargetX - measuredCabX, renderedDoorTargetZ - measuredCabZ)).toBeLessThanOrEqual(0.01);",
    "uploaded-jetway-a1-full-chain-connected-v12.png",
    "uploaded-jetway-a-concourse-own-gate-v13.png",
    "expectSamePose(trainingPose, freeDrivePose);",
    "expectSamePose(returnedPose, freeDrivePose);",
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: connected A1 / own-gate static regression proof is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log("Updated browser regressions for connected A1 and fleet-wide own-gate static jetways: A1 cannot stretch apart, all 57 static bridges must report own-gate aim/real-wall registration, raw BGL headings are provenance only, and the wide A/B fleet screenshots are captured for visual review.");
