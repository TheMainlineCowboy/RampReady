import fs from "node:fs";

const path = "tests/browser/uploaded-jetway-articulation-v10.spec.js";
let source = fs.readFileSync(path, "utf8");

// Final post-regeneration authority: the Aug. 17 attached-state massing check is
// measured to the live rendered supplied Cab body. The older inspection Cab
// contact point remains useful for door-contact diagnostics only and must never
// retake Rotunda-to-Cab span authority in a later compatibility preparer.
const measuredCabAnchor = "  const measuredCabZ = Number(returnedRuntime.inspectionAircraftCabContactZ);";
if (!source.includes("const liveRenderedCabCenterX")) {
  if (!source.includes(measuredCabAnchor)) throw new Error(`${path}: measured Cab declaration anchor is missing`);
  source = source.replace(
    measuredCabAnchor,
    `${measuredCabAnchor}\n  const liveRenderedCabCenterX = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldX);\n  const liveRenderedCabCenterZ = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldZ);`,
  );
}

const staleSpan = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*measuredCabX\s*-\s*exactRotundaWorldX\s*,\s*measuredCabZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
const liveSpan = `const geometricHorizontalRotundaOpeningToCabDistance = Math.hypot(\n    liveRenderedCabCenterX - exactRotundaWorldX,\n    liveRenderedCabCenterZ - exactRotundaWorldZ,\n  );`;
if (staleSpan.test(source)) source = source.replace(staleSpan, liveSpan);

if (!source.includes("const geometricHorizontalRotundaOpeningToCabDistance")) {
  const anchor = "  const inspectionNoseGearZ = Number(returnedRuntime.inspectionAircraftNoseGearZ);";
  if (!source.includes(anchor)) throw new Error(`${path}: Rotunda/Cab span insertion anchor is missing`);
  source = source.replace(anchor, `${anchor}\n  ${liveSpan}`);
}

const liveSpanPattern = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*liveRenderedCabCenterX\s*-\s*exactRotundaWorldX\s*,\s*liveRenderedCabCenterZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
if (!liveSpanPattern.test(source)) throw new Error(`${path}: final Rotunda-to-Cab span is not bound to the live rendered supplied Cab body`);
if (/geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\([\s\S]{0,180}measuredCab[ZX]/m.test(source)) {
  throw new Error(`${path}: representative inspection Cab point retook final Rotunda-to-Cab span authority`);
}

const finiteAssertion = "  expect([liveRenderedCabCenterX, liveRenderedCabCenterZ, geometricHorizontalRotundaOpeningToCabDistance].every(Number.isFinite)).toBe(true);";
const noseAssertion = "  expect([inspectionNoseGearX, inspectionNoseGearZ].every(Number.isFinite)).toBe(true);";
if (!source.includes(finiteAssertion)) {
  if (!source.includes(noseAssertion)) throw new Error(`${path}: final live-Cab finite assertion anchor is missing`);
  source = source.replace(noseAssertion, `${noseAssertion}\n${finiteAssertion}`);
}

const minimumMassingGuard = "  expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(12);";
if (!source.includes(minimumMassingGuard)) {
  if (!source.includes(finiteAssertion)) throw new Error(`${path}: final live-Cab massing assertion anchor is missing`);
  source = source.replace(finiteAssertion, `${finiteAssertion}\n${minimumMassingGuard}`);
}

// A failing massing guard must not suppress the visual evidence needed to repair
// that same failure. Preserve the unchanged >12 m acceptance requirement, but run
// it only after the full A1/A3/B-gate capture set has been written. This keeps CI
// fail-closed while guaranteeing a red geometry head still produces inspectable
// evidence instead of stopping at the first numeric assertion.
const evidenceCaptureAnchor = `  await captureInspectionPreset(page, "b15", "test-results/uploaded-jetway-b15-own-gate-v13.png");`;
const evidenceFirstMarker = "a1-live-cab-span-guard-after-visual-evidence-v1";
if (!source.includes(evidenceFirstMarker)) {
  const guardIndex = source.indexOf(minimumMassingGuard);
  const captureIndex = source.indexOf(evidenceCaptureAnchor);
  if (guardIndex < 0 || captureIndex < 0) {
    throw new Error(`${path}: cannot defer live-Cab massing guard until after visual evidence`);
  }
  source = source.slice(0, guardIndex) + source.slice(guardIndex + minimumMassingGuard.length);
  const updatedCaptureIndex = source.indexOf(evidenceCaptureAnchor);
  const insertionIndex = updatedCaptureIndex + evidenceCaptureAnchor.length;
  source = source.slice(0, insertionIndex)
    + `\n\n  // ${evidenceFirstMarker}\n${minimumMassingGuard}`
    + source.slice(insertionIndex);
}

for (const required of [
  "inspectionAircraftLiveVisibleCabWorldX",
  "inspectionAircraftLiveVisibleCabWorldZ",
  "liveRenderedCabCenterX",
  "liveRenderedCabCenterZ",
  minimumMassingGuard.trim(),
  evidenceFirstMarker,
]) {
  if (!source.includes(required)) throw new Error(`${path}: final live-Cab browser authority is missing ${required}`);
}
if (source.indexOf(minimumMassingGuard) < source.indexOf(evidenceCaptureAnchor)) {
  throw new Error(`${path}: live-Cab massing guard still runs before visual evidence capture`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Reasserted final browser span authority from the remote A1 Rotunda to the live rendered supplied Cab body; the unchanged >12 m guard now fails only after the evidence captures so a red geometry head remains visually diagnosable.");
