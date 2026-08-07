import fs from "node:fs";

const POSE_AUTHORITY = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const HEADING_AUTHORITY = "source-a1-parking-heading-authored-door-registration-v2";
const SOURCE_A1_MODEL_YAW = (0.491 * Math.PI) / 180;
const files = [
  "tests/browser/a1-ground-contact-evidence.spec.js",
  "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
];

for (const path of files) {
  let source = fs.readFileSync(path, "utf8");
  source = source.replaceAll("measured-cab-normal-aircraft-heading-v1", HEADING_AUTHORITY);
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
      && Number.isFinite(Number(data?.inspectionAircraftYaw))
      && Math.abs(Number(data?.inspectionAircraftYaw) - ${(SOURCE_A1_MODEL_YAW).toFixed(9)}) <= 0.001`,
    );
  } else if (!source.includes(`Math.abs(Number(data?.inspectionAircraftYaw) - ${(SOURCE_A1_MODEL_YAW).toFixed(9)}) <= 0.001`)) {
    source = source.replace(
      "      && Number.isFinite(Number(data?.inspectionAircraftYaw))",
      `      && Number.isFinite(Number(data?.inspectionAircraftYaw))
      && Math.abs(Number(data?.inspectionAircraftYaw) - ${(SOURCE_A1_MODEL_YAW).toFixed(9)}) <= 0.001`,
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
  expect(Number.isFinite(Number(runtime.inspectionAircraftYaw))).toBe(true);
  expect(Number(runtime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3);`;
  const terminalAssertionBlock = `
  expect(terminalRuntime.inspectionAircraftPoseStored).toBe("true");
  expect(terminalRuntime.inspectionAircraftPoseApplied).toBe("true");
  expect(terminalRuntime.inspectionAircraftPoseAuthority).toBe("${POSE_AUTHORITY}");
  expect(Number(terminalRuntime.inspectionAircraftPoseErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(terminalRuntime.inspectionAircraftHeadingAuthority).toBe("${HEADING_AUTHORITY}");
  expect(Number.isFinite(Number(terminalRuntime.inspectionAircraftYaw))).toBe(true);
  expect(Number(terminalRuntime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3);`;

  if (source.includes(runtimeAnchor)
    && !source.includes('expect(runtime.inspectionAircraftPoseApplied).toBe("true")')) {
    source = source.replace(runtimeAnchor, `${runtimeAnchor}${assertionBlock}`);
  } else if (source.includes('expect(runtime.inspectionAircraftPoseApplied).toBe("true")')
    && !source.includes(`expect(Number(runtime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3)`)) {
    source = source.replace(
      "  expect(Number.isFinite(Number(runtime.inspectionAircraftYaw))).toBe(true);",
      `  expect(Number.isFinite(Number(runtime.inspectionAircraftYaw))).toBe(true);
  expect(Number(runtime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3);`,
    );
  }
  if (source.includes(terminalRuntimeAnchor)
    && !source.includes('expect(terminalRuntime.inspectionAircraftPoseApplied).toBe("true")')) {
    source = source.replace(terminalRuntimeAnchor, `${terminalRuntimeAnchor}${terminalAssertionBlock}`);
  } else if (source.includes('expect(terminalRuntime.inspectionAircraftPoseApplied).toBe("true")')
    && !source.includes(`expect(Number(terminalRuntime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3)`)) {
    source = source.replace(
      "  expect(Number.isFinite(Number(terminalRuntime.inspectionAircraftYaw))).toBe(true);",
      `  expect(Number.isFinite(Number(terminalRuntime.inspectionAircraftYaw))).toBe(true);
  expect(Number(terminalRuntime.inspectionAircraftYaw)).toBeCloseTo(${SOURCE_A1_MODEL_YAW.toFixed(9)}, 3);`,
    );
  }

  for (const token of [
    marker,
    'data?.inspectionAircraftPoseStored === "true"',
    'data?.inspectionAircraftPoseApplied === "true"',
    `data?.inspectionAircraftPoseAuthority === "${POSE_AUTHORITY}"`,
    "Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01",
    `data?.inspectionAircraftHeadingAuthority === "${HEADING_AUTHORITY}"`,
    "Number.isFinite(Number(data?.inspectionAircraftYaw))",
    `Math.abs(Number(data?.inspectionAircraftYaw) - ${SOURCE_A1_MODEL_YAW.toFixed(9)}) <= 0.001`,
  ]) {
    if (!source.includes(token)) {
      throw new Error(`${path}: post-lifecycle A1 evidence is missing ${token}`);
    }
  }
  if (source.includes("measured-cab-normal-aircraft-heading-v1")) {
    throw new Error(`${path}: obsolete Cab-normal aircraft heading survived lifecycle migration`);
  }

  fs.writeFileSync(path, source, "utf8");
}

console.log("Required the stored grounded A1 inspection pose, authored A1 parking heading, finite source yaw and near-zero live pose error before full or close evidence capture.");
