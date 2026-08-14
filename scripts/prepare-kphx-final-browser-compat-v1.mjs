import fs from "node:fs";

const subviewPath = "tests/browser/a1-terminal-joint-bogie-subviews.spec.js";
const kphxPath = "tests/browser/kphx-ground-runtime.spec.js";

const staleSubviewAuthority = "source-measured-a1-terminal-joint-camera-v3";
const currentSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4";
const staleLegacyBlockAuthority = "surgical-exact-three-box-36-triangle-authored-removal-v3";
const currentLegacyBlockAuthority = "preserve-a1-source-terminal-remove-two-detached-artifacts-v4";
const finalWorldBogieAuthority = "final-visible-a1-tunnel-c-low-contact-world-v1";

let subviewSource = fs.readFileSync(subviewPath, "utf8");
subviewSource = subviewSource.replaceAll(staleSubviewAuthority, currentSubviewAuthority);
const staleBogieCenterBlock = `  const publishedCenter = [\n    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterX),\n    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterY),\n    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterZ),\n  ];\n  expect(distance3(bogieCenter, publishedCenter)).toBeLessThanOrEqual(0.01);`;
const finalWorldBogieBlock = `  expect(bogieRuntime.inspectionCameraEndpointBogieFinalWorldAuthority).toBe("${finalWorldBogieAuthority}");\n  expect(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldPointCount)).toBeGreaterThanOrEqual(4);\n  expect(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldHorizontalSpanMeters)).toBeGreaterThanOrEqual(0.35);\n  expect(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldAlongBridgeRatio)).toBeGreaterThan(0.40);\n  expect(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldAlongBridgeRatio)).toBeLessThan(0.88);\n  expect(Math.abs(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldLateralOffsetMeters))).toBeLessThan(4.0);\n  expect(Math.abs(Number(bogieRuntime.inspectionCameraEndpointBogieFinalWorldMinimumY))).toBeLessThanOrEqual(0.02);`;
if (subviewSource.includes(staleBogieCenterBlock)) {
  subviewSource = subviewSource.replace(staleBogieCenterBlock, finalWorldBogieBlock);
}
if (!subviewSource.includes(currentSubviewAuthority) || subviewSource.includes(staleSubviewAuthority)) {
  throw new Error(`${subviewPath}: final A1 subview authority did not migrate to v4`);
}
if (!subviewSource.includes(finalWorldBogieBlock) || subviewSource.includes(staleBogieCenterBlock)) {
  throw new Error(`${subviewPath}: final-world Tunnel-C bogie browser assertion did not migrate`);
}
fs.writeFileSync(subviewPath, subviewSource, "utf8");

let kphxSource = fs.readFileSync(kphxPath, "utf8");
kphxSource = kphxSource.replaceAll(staleLegacyBlockAuthority, currentLegacyBlockAuthority);
kphxSource = kphxSource.replace(
  'data?.terminal4A1LegacyBlockRemovedTriangles === "36"',
  'data?.terminal4A1LegacyBlockRemovedTriangles === "24"',
);
kphxSource = kphxSource.replace(
  'expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("36");',
  'expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("24");',
);

for (const required of [
  currentLegacyBlockAuthority,
  'data?.terminal4A1LegacyBlockRemovedTriangles === "24"',
  'expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("24");',
]) {
  if (!kphxSource.includes(required)) throw new Error(`${kphxPath}: missing final KPHX browser expectation ${required}`);
}
for (const forbidden of [
  staleLegacyBlockAuthority,
  'data?.terminal4A1LegacyBlockRemovedTriangles === "36"',
  'expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("36");',
]) {
  if (kphxSource.includes(forbidden)) throw new Error(`${kphxPath}: stale KPHX browser expectation survived ${forbidden}`);
}
fs.writeFileSync(kphxPath, kphxSource, "utf8");

console.log("Prepared final KPHX browser compatibility: current apron-side A1 camera v4, final-world Tunnel-C bogie evidence, and source-preserving 24-triangle Terminal 4 cleanup v4; runtime geometry is unchanged.");
