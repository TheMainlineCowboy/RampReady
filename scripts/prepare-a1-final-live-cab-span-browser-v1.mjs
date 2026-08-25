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

for (const required of [
  "inspectionAircraftLiveVisibleCabWorldX",
  "inspectionAircraftLiveVisibleCabWorldZ",
  "liveRenderedCabCenterX",
  "liveRenderedCabCenterZ",
  minimumMassingGuard.trim(),
]) {
  if (!source.includes(required)) throw new Error(`${path}: final live-Cab browser authority is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Reasserted final browser span authority from the remote A1 Rotunda to the live rendered supplied Cab body; representative Cab contact telemetry remains diagnostic only.");
