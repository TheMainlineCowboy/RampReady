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

// a1-live-rendered-cab-span-authority-v2
// The legacy inspectionAircraftCabContactX/Z point is only a representative Cab-axis
// diagnostic and must never own the Aug. 17 visible-massing check. Keep the original
// >12 m fail-closed threshold, but bind it to the live rendered supplied Cab body center.
// Be tolerant of harmless whitespace/parenthesis changes made by earlier preparers.
const staleCabDeclarations = `  const measuredCabX = Number(returnedRuntime.inspectionAircraftCabContactX);\n  const measuredCabZ = Number(returnedRuntime.inspectionAircraftCabContactZ);`;
const liveCabDeclarations = `${staleCabDeclarations}\n  const liveRenderedCabCenterX = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldX);\n  const liveRenderedCabCenterZ = Number(returnedRuntime.inspectionAircraftLiveVisibleCabWorldZ);`;
if (articulation.includes(staleCabDeclarations) && !articulation.includes("const liveRenderedCabCenterX")) {
  articulation = articulation.replace(staleCabDeclarations, liveCabDeclarations);
}

const staleSpanPattern = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*measuredCabX\s*-\s*exactRotundaWorldX\s*,\s*measuredCabZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
const liveSpan = `const geometricHorizontalRotundaOpeningToCabDistance = Math.hypot(\n    liveRenderedCabCenterX - exactRotundaWorldX,\n    liveRenderedCabCenterZ - exactRotundaWorldZ,\n  );`;
if (staleSpanPattern.test(articulation)) articulation = articulation.replace(staleSpanPattern, liveSpan);

const liveSpanPattern = /const\s+geometricHorizontalRotundaOpeningToCabDistance\s*=\s*Math\.hypot\(\s*liveRenderedCabCenterX\s*-\s*exactRotundaWorldX\s*,\s*liveRenderedCabCenterZ\s*-\s*exactRotundaWorldZ\s*,?\s*\);/m;
if (articulation.includes("geometricHorizontalRotundaOpeningToCabDistance") && !liveSpanPattern.test(articulation)) {
  throw new Error(`${articulationPath}: Rotunda-to-Cab span is not bound to the live rendered supplied Cab body`);
}

const finiteAnchor = `    geometricHorizontalRotundaOpeningToCabDistance,\n  ].every(Number.isFinite)).toBe(true);`;
const finiteLive = `    geometricHorizontalRotundaOpeningToCabDistance, liveRenderedCabCenterX, liveRenderedCabCenterZ,\n  ].every(Number.isFinite)).toBe(true);`;
if (articulation.includes(finiteAnchor)) articulation = articulation.replace(finiteAnchor, finiteLive);

if (!articulation.includes("inspectionAircraftLiveVisibleCabWorldX")
  || !articulation.includes("inspectionAircraftLiveVisibleCabWorldZ")
  || !articulation.includes("liveRenderedCabCenterX")
  || !articulation.includes("liveRenderedCabCenterZ")) {
  throw new Error(`${articulationPath}: live rendered Cab-center span evidence is missing`);
}
if (/measuredCab[ZX]\s*-\s*exactRotundaWorld[ZX]/.test(articulation)) {
  throw new Error(`${articulationPath}: stale representative Cab point still owns the Rotunda-to-Cab span`);
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
]) {
  if (!articulation.includes(required)) throw new Error(`${articulationPath}: Tunnel-C/bodied-Cab browser gate is missing ${required}`);
}

console.log(`Migrated ${changed} browser suite(s) to ${bogieAuthority}; articulation now requires both the Tunnel-C authority and <=1.5 cm published bogie/ramp clearance, keeps the unchanged >12 m remote-Rotunda-to-Cab massing guard bound to the live rendered supplied Cab body with formatting-tolerant verification, and ${authorityConsumerCount} consumers reject the old whole-model-minimum authority.`);
await import(`./prepare-fixed-a1-browser-regressions-v1.mjs?fixed-a1-browser=${Date.now()}`);
