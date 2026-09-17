#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const jetwayLoader = await readFile(new URL("../src/environment/sourceKphxJetways.js", import.meta.url), "utf8");
const fleetLoader = await readFile(new URL("../src/environment/sourceKphxWedJetwayFleet.js", import.meta.url), "utf8");
const wrapper = await readFile(new URL("../src/environment/authoredTerminal4Visual.js", import.meta.url), "utf8");
const terminal4Map = JSON.parse(await readFile(new URL("../public/models/kphx/terminal4-wed-jetways.exact.json", import.meta.url), "utf8"));

const sourceFacadeResource = "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac";
const exactGlb = "models/airport-jetway/Airport_Jetway.glb";
const exactGlbSha256 = "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0";
const wedSha256 = "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498";
const placementAuthority = "KPHX-1.75.1-earth.wed.xml-terminal4-jetway-ramp-association-v1";
const readyAuthority = "exact-kphx-1.75.1-wed-terminal4-jetways-plus-supplied-glb-v1";
const geometryAuthority = "exact-uploaded-airport-jetway-glb-562e3144-wed-placement-v1";

for (const required of [
  "KPHX 1.75.1 earth.wed.xml",
  sourceFacadeResource,
  "EXPECTED_PLACEMENT_COUNT = 108",
  "T4_VISIBLE_JETWAY_COUNT = 76",
  "A1_FACADE_OBJECT_ID = 104804",
  exactGlb,
  'movableVisibleGeometryAuthority: "exact-user-supplied-airport-jetway-glb"',
  'placementPolicy: "WED owns gate association, rotunda/cab axis and source-airport coordinates"',
  'geometryPolicy: "verified user-supplied exact movable bridge; no generated visible bridge replacement"',
  "exactKphxJetwaySubstitutionAllowed = false",
  "exactKphxJetwayGeneratedVisibleGeometryCount = 0",
]) {
  if (!jetwayLoader.includes(required)) throw new Error(`Exact KPHX jetway placement authority is missing: ${required}`);
}

for (const required of [
  exactGlb,
  exactGlbSha256,
  geometryAuthority,
  readyAuthority,
  placementAuthority,
  'const PERFORMANCE_AUTHORITY = "75-static-exact-glb-instances-plus-1-animated-a1-wed-v1"',
  'const requiredMeshes = [',
  'if (triangleCount !== 31_978)',
  'materials.has("Jetway")',
  'materials.has("Glass_JW")',
  'map.jetwayCount !== 76',
  'a1?.facadeWedObjectId !== 104804',
  'a1?.facadeNodeCount !== 7',
  'uploadedJetwayMaximumPositionErrorMeters = 0',
  'uploadedJetwayMaximumUvError = 0',
  'requiresOriginalSourceMesh = true',
  'proceduralJetwayStairCount = 0',
  'proceduralProjectedUvCount = 0',
]) {
  if (!fleetLoader.includes(required)) throw new Error(`Exact supplied jetway renderer authority is missing: ${required}`);
}

for (const forbidden of [
  "blocked-missing-exact-xplane-Jetway_1_solid.fac",
  'substitutionPolicy: "forbidden"',
  "exact-WED-footprints-anchors-only-visible-geometry-fail-closed-v1",
  "authoredTerminal4UploadedJetwayVerifiedModelCount = 0",
]) {
  if (jetwayLoader.includes(forbidden) || fleetLoader.includes(forbidden) || wrapper.includes(forbidden)) {
    throw new Error(`Retired fail-closed jetway suppression survived exact KPHX migration: ${forbidden}`);
  }
}

if (!wrapper.includes("installSourceKphxWedJetwayFleet")) {
  throw new Error("Exact WED-derived supplied jetway fleet is not attached to the live source airport frame");
}
if (!wrapper.includes("authored-airport-objects-and-WED-terminal4-jetways")) {
  throw new Error("Source airport wrapper does not publish the rendered WED Terminal 4 jetway authority");
}

if (
  terminal4Map?.authority !== placementAuthority
  || terminal4Map?.source?.bytes !== 24885640
  || terminal4Map?.source?.sha256 !== wedSha256
  || terminal4Map?.jetwayCount !== 76
  || !Array.isArray(terminal4Map?.placements)
  || terminal4Map.placements.length !== 76
) throw new Error("Canonical Terminal 4 WED jetway map failed exact source identity/count checks");

const a1 = terminal4Map.placements.find((placement) => placement.gate === "A1");
if (
  a1?.rampWedObjectId !== 27855
  || a1?.facadeWedObjectId !== 104804
  || a1?.facadeNodeCount !== 7
  || !(a1?.bridgeEnd > 23.8 && a1?.bridgeEnd < 23.9)
) throw new Error(`Canonical A1 WED jetway mapping is invalid: ${JSON.stringify(a1)}`);

const rampWedObjectIds = new Set();
const placementObjectPairs = new Set();
const gateLabelCounts = new Map();
for (const placement of terminal4Map.placements) {
  if (typeof placement?.gate !== "string" || !placement.gate.trim()) {
    throw new Error(`Invalid T4 WED gate label: ${placement?.gate}`);
  }
  if (!Number.isInteger(placement.rampWedObjectId) || !Number.isInteger(placement.facadeWedObjectId)) {
    throw new Error(`T4 WED gate ${placement.gate} is missing exact WED object identity`);
  }
  if (rampWedObjectIds.has(placement.rampWedObjectId)) {
    throw new Error(`Duplicate T4 WED ramp object identity: ${placement.rampWedObjectId}`);
  }
  rampWedObjectIds.add(placement.rampWedObjectId);
  const objectPair = `${placement.rampWedObjectId}:${placement.facadeWedObjectId}`;
  if (placementObjectPairs.has(objectPair)) throw new Error(`Duplicate T4 WED ramp/facade placement identity: ${objectPair}`);
  placementObjectPairs.add(objectPair);
  gateLabelCounts.set(placement.gate, (gateLabelCounts.get(placement.gate) || 0) + 1);
  if (!Number.isFinite(placement.x) || !Number.isFinite(placement.z) || !Number.isFinite(placement.yawRadians)) {
    throw new Error(`T4 WED gate ${placement.gate} has invalid source transform`);
  }
  if (placement.skipGeneratedTerminalConnector !== true) {
    throw new Error(`T4 WED gate ${placement.gate} allows a generated terminal connector`);
  }
}
if (rampWedObjectIds.size !== terminal4Map.jetwayCount) {
  throw new Error(`T4 WED ramp object identity count mismatch: ${rampWedObjectIds.size}`);
}
const duplicateAuthoredGateLabels = [...gateLabelCounts.entries()].filter(([, count]) => count > 1);
if (
  duplicateAuthoredGateLabels.length !== 1
  || duplicateAuthoredGateLabels[0][0] !== "D7"
  || duplicateAuthoredGateLabels[0][1] !== 2
) {
  throw new Error(`Unexpected authored duplicate T4 gate labels: ${JSON.stringify(duplicateAuthoredGateLabels)}`);
}

console.log(JSON.stringify({
  authority: "KPHX-1.75.1-WED-placement-plus-user-supplied-exact-jetway-v2",
  airportWideWedFacadeCount: 108,
  terminal4WedAssociatedJetwayCount: terminal4Map.jetwayCount,
  terminal4UniqueRampWedObjectCount: rampWedObjectIds.size,
  duplicateAuthoredGateLabels: Object.fromEntries(duplicateAuthoredGateLabels),
  terminal4A1FacadeObjectId: a1.facadeWedObjectId,
  terminal4A1FacadeNodeCount: a1.facadeNodeCount,
  sourceFacadeResource,
  sourceFacadeRole: "WED footprint/placement authority",
  visibleMovableGeometry: exactGlb,
  visibleMovableGeometrySha256: exactGlbSha256,
  visibleMovableGeometryAuthority: geometryAuthority,
  readyAuthority,
  generatedVisibleBridgeSubstitutions: 0,
  substitutionsAllowed: false,
}, null, 2));
