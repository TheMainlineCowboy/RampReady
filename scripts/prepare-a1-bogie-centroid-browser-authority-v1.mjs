import fs from "node:fs";
import path from "node:path";

const browserDirectory = "tests/browser";
const legacyAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
];
const bogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const files = fs.readdirSync(browserDirectory)
  .filter((name) => name.endsWith(".spec.js"))
  .map((name) => path.join(browserDirectory, name));

let changed = 0;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const before = source;
  for (const legacy of legacyAuthorities) source = source.replaceAll(legacy, bogieAuthority);
  if (source !== before) {
    fs.writeFileSync(file, source, "utf8");
    changed += 1;
  }
}

const articulationPath = path.join(browserDirectory, "uploaded-jetway-articulation-v10.spec.js");
let articulation = fs.readFileSync(articulationPath, "utf8");

if (!articulation.includes(`JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`)) {
  articulation = articulation.replace(
    /const JETWAY_BOGIE_GROUND_AUTHORITY = "[^"]+";/,
    `const JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}";`,
  );
}
if (!articulation.includes(`JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`)) {
  const anchor = `const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";`;
  if (!articulation.includes(anchor)) throw new Error(`${articulationPath}: bogie authority insertion anchor is missing`);
  articulation = articulation.replace(anchor, `${anchor}\nconst JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}";`);
}

const waitAuthorityLine = "      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority";
const waitClearanceLine = "      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.015";
if (!articulation.includes(waitAuthorityLine)) {
  throw new Error(`${articulationPath}: articulation no longer fail-closes on the published bogie authority`);
}
if (!articulation.includes(waitClearanceLine)) {
  articulation = articulation.replace(waitAuthorityLine, `${waitAuthorityLine}\n${waitClearanceLine}`);
}

const runtimeAuthorityAssertion = "  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(JETWAY_BOGIE_GROUND_AUTHORITY);";
const runtimeClearanceAssertion = "  expect(Math.abs(Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.015);";
if (!articulation.includes(runtimeAuthorityAssertion)) {
  throw new Error(`${articulationPath}: runtime bogie authority assertion is missing`);
}
if (!articulation.includes(runtimeClearanceAssertion)) {
  articulation = articulation.replace(runtimeAuthorityAssertion, `${runtimeAuthorityAssertion}\n${runtimeClearanceAssertion}`);
}

// a1-live-rendered-cab-span-authority-v3
// The Aug. 17 attached-state massing check belongs to the live rendered supplied Cab
// body, not the older representative inspectionAircraftCabContactX/Z diagnostic.
// Regenerated browser specs may omit the earlier span expression entirely, so restore
// the live measurement and the unchanged >12 m fail-closed guard idempotently.
const measuredCabDeclarationAnchor = "  const measuredCabZ = Number(returnedRuntime.inspectionAircraftCabContactZ);";
if (!articulation.includes("const liveRenderedCabCenterX")) {
  if (!articulation.includes(measuredCabDeclarationAnchor)) {
    throw new Error(`${articulationPath}: Cab declaration insertion anchor is missing`);
  }
  articulation = articulation.replace(
    measuredCabDeclarationAnchor,
    `${measuredCabDeclarationAnchor}\n  const liveRenderedCabCenterX = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldX);\n  const liveRenderedCabCenterZ = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldZ);`,
  );
}

const staleSpanPattern = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*measuredCabX\s*-\s*exactRotundaWorldX\s*,\s*measuredCabZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
const liveSpan = `  const geometricHorizontalRotundaOpeningToCabDistance = Math.hypot(\n    liveRenderedCabCenterX - exactRotundaWorldX,\n    liveRenderedCabCenterZ - exactRotundaWorldZ,\n  );`;
if (staleSpanPattern.test(articulation)) articulation = articulation.replace(staleSpanPattern, liveSpan.trimStart());
if (!articulation.includes("const geometricHorizontalRotundaOpeningToCabDistance")) {
  const spanInsertionAnchor = "  const inspectionNoseGearZ = Number(returnedRuntime.inspectionAircraftNoseGearZ);";
  if (!articulation.includes(spanInsertionAnchor)) {
    throw new Error(`${articulationPath}: live Cab span insertion anchor is missing`);
  }
  articulation = articulation.replace(spanInsertionAnchor, `${spanInsertionAnchor}\n${liveSpan}`);
}

const liveSpanPattern = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*liveRenderedCabCenterX\s*-\s*exactRotundaWorldX\s*,\s*liveRenderedCabCenterZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
if (!liveSpanPattern.test(articulation)) {
  throw new Error(`${articulationPath}: Rotunda-to-Cab span is not bound to the live rendered supplied Cab body`);
}
if (/measuredCab[ZX]\s*-\s*exactRotundaWorld[ZX]/.test(articulation)) {
  throw new Error(`${articulationPath}: stale representative Cab point still owns the Rotunda-to-Cab span`);
}

const finiteLiveAssertion = "  expect([liveRenderedCabCenterX, liveRenderedCabCenterZ, geometricHorizontalRotundaOpeningToCabDistance].every(Number.isFinite)).toBe(true);";
const spanGuard = "  expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(12);";
if (!articulation.includes(finiteLiveAssertion) || !articulation.includes(spanGuard)) {
  const assertionAnchor = "  expect([inspectionNoseGearX, inspectionNoseGearZ].every(Number.isFinite)).toBe(true);";
  if (!articulation.includes(assertionAnchor)) {
    throw new Error(`${articulationPath}: live Cab massing assertion anchor is missing`);
  }
  let replacement = assertionAnchor;
  if (!articulation.includes(finiteLiveAssertion)) replacement += `\n${finiteLiveAssertion}`;
  if (!articulation.includes(spanGuard)) replacement += `\n${spanGuard}`;
  articulation = articulation.replace(assertionAnchor, replacement);
}

if (!articulation.includes("inspectionAircraftLiveVisibleCabWorldX")
  || !articulation.includes("inspectionAircraftLiveVisibleCabWorldZ")
  || !articulation.includes("liveRenderedCabCenterX")
  || !articulation.includes("liveRenderedCabCenterZ")) {
  throw new Error(`${articulationPath}: live rendered Cab-center span evidence is missing`);
}
if (!/expect\(geometricHorizontalRotundaOpeningToCabDistance\)\.toBeGreaterThan\(12\)/.test(articulation)) {
  throw new Error(`${articulationPath}: unchanged >12 m live Cab massing guard is missing`);
}

fs.writeFileSync(articulationPath, articulation, "utf8");

let authorityConsumerCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const legacy of legacyAuthorities) {
    if (source.includes(legacy)) throw new Error(`${file}: obsolete whole-model ground authority remains: ${legacy}`);
  }
  if (source.includes("terminal4UploadedJetwayBogieGroundContactAuthority")) {
    authorityConsumerCount += 1;
    if (!source.includes(bogieAuthority)) throw new Error(`${file}: bogie consumer was not migrated to ${bogieAuthority}`);
  }
}
if (authorityConsumerCount < 4) throw new Error(`Expected at least four Tunnel-C bogie browser consumers, found ${authorityConsumerCount}`);

for (const required of [
  `JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`,
  waitAuthorityLine.trim(),
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  runtimeClearanceAssertion.trim(),
  "inspectionAircraftLiveVisibleCabWorldX",
  "inspectionAircraftLiveVisibleCabWorldZ",
  "liveRenderedCabCenterX",
  "liveRenderedCabCenterZ",
  "geometricHorizontalRotundaOpeningToCabDistance",
  spanGuard.trim(),
]) {
  if (!articulation.includes(required)) throw new Error(`${articulationPath}: Tunnel-C/bodied-Cab browser gate is missing ${required}`);
}

console.log(`Migrated ${changed} browser suite(s) to ${bogieAuthority}; articulation now requires Tunnel-C authority and <=1.5 cm bogie/ramp clearance, regenerates the unchanged >12 m remote-Rotunda-to-live-Cab massing guard when earlier stages omit it, and ${authorityConsumerCount} consumers reject the old whole-model-minimum authority.`);
await import(`./prepare-fixed-a1-browser-regressions-v1.mjs?fixed-a1-browser=${Date.now()}`);
