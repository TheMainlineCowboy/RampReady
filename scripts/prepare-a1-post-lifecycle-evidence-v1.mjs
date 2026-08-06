import fs from "node:fs";

const POSE_AUTHORITY = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const HEADING_AUTHORITY = "measured-cab-normal-aircraft-heading-v1";
const files = [
  "tests/browser/a1-ground-contact-evidence.spec.js",
  "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
];

for (const path of files) {
  let source = fs.readFileSync(path, "utf8");
  const marker = "post-lifecycle-grounded-a1-evidence-v1";
  if (!source.includes(marker)) {
    const chainedLoadAnchor = '      && data?.terminal4UploadedJetwayLoadState === "ready"';
    const returnedLoadAnchor = '    return data?.terminal4UploadedJetwayLoadState === "ready"';
    const loadAnchor = source.includes(chainedLoadAnchor)
      ? chainedLoadAnchor
      : source.includes(returnedLoadAnchor)
        ? returnedLoadAnchor
        : null;
    if (!loadAnchor) {
      throw new Error(`${path}: A1 evidence load-state anchor is missing`);
    }
    source = source.replace(
      loadAnchor,
      `${loadAnchor}
      // ${marker}
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && data?.inspectionAircraftPoseAuthority === "${POSE_AUTHORITY}"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01
      && data?.inspectionAircraftHeadingAuthority === "${HEADING_AUTHORITY}"
      && Number.isFinite(Number(data?.inspectionAircraftYaw))`,
    );
  }

  const runtimeAnchor = "  const runtime = await page.evaluate(() => ({\n    ...document.querySelector(\"canvas.trainerCanvas\").dataset,\n  }));";
  const terminalRuntimeAnchor = "  const terminalRuntime = await page.evaluate(() => ({\n    ...document.querySelector(\"canvas.trainerCanvas\").dataset,\n  }));";
  const assertionBlock = `
  expect(runtime.inspectionAircraftPoseStored).toBe("true");
  expect(runtime.inspectionAircraftPoseApplied).toBe("true");
  expect(runtime.inspectionAircraftPoseAuthority).toBe("${POSE_AUTHORITY}");
  expect(Number(runtime.inspectionAircraftPoseErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(runtime.inspectionAircraftHeadingAuthority).toBe("${HEADING_AUTHORITY}");
  expect(Number.isFinite(Number(runtime.inspectionAircraftYaw))).toBe(true);`;
  const terminalAssertionBlock = `
  expect(terminalRuntime.inspectionAircraftPoseStored).toBe("true");
  expect(terminalRuntime.inspectionAircraftPoseApplied).toBe("true");
  expect(terminalRuntime.inspectionAircraftPoseAuthority).toBe("${POSE_AUTHORITY}");
  expect(Number(terminalRuntime.inspectionAircraftPoseErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(terminalRuntime.inspectionAircraftHeadingAuthority).toBe("${HEADING_AUTHORITY}");
  expect(Number.isFinite(Number(terminalRuntime.inspectionAircraftYaw))).toBe(true);`;

  if (source.includes(runtimeAnchor)
    && !source.includes('expect(runtime.inspectionAircraftPoseApplied).toBe("true")')) {
    source = source.replace(runtimeAnchor, `${runtimeAnchor}${assertionBlock}`);
  }
  if (source.includes(terminalRuntimeAnchor)
    && !source.includes('expect(terminalRuntime.inspectionAircraftPoseApplied).toBe("true")')) {
    source = source.replace(terminalRuntimeAnchor, `${terminalRuntimeAnchor}${terminalAssertionBlock}`);
  }

  for (const token of [
    marker,
    'data?.inspectionAircraftPoseStored === "true"',
    'data?.inspectionAircraftPoseApplied === "true"',
    `data?.inspectionAircraftPoseAuthority === "${POSE_AUTHORITY}"`,
    "Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01",
    `data?.inspectionAircraftHeadingAuthority === "${HEADING_AUTHORITY}"`,
    "Number.isFinite(Number(data?.inspectionAircraftYaw))",
  ]) {
    if (!source.includes(token)) {
      throw new Error(`${path}: post-lifecycle A1 evidence is missing ${token}`);
    }
  }

  fs.writeFileSync(path, source, "utf8");
}

console.log("Required the stored grounded A1 inspection pose, measured Cab heading, finite yaw and near-zero live pose error before full or close evidence capture across both supported readiness-predicate structures.");
