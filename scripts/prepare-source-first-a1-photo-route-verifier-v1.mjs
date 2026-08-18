import fs from "node:fs";

const testPath = "tests/browser/source-first-a1-repair.spec.js";
let source = fs.readFileSync(testPath, "utf8");
const FIXED_AIRCRAFT_AUTHORITY = "fixed-current-a1-aircraft-pose-exact-authored-door-v1";
const PHYSICAL_CAB_AUTHORITY = "a1-final-exact-cab-footprint-door-contact-v2";
const marker = "source-first-a1-physical-cab-surface-verifier-v2";

const staleWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05`;
const photoWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Number(data?.a1ExactRotundaToWallWorldMeters) > 18\n      && Number(data?.a1ExactRotundaToWallWorldMeters) < 30`;

const staleAssertions = `  expect(finalRotundaToWallDistance).toBeGreaterThan(2.9);\n  expect(finalRotundaToWallDistance).toBeLessThan(5.8);\n  expect(Math.abs(finalRotundaToWallDistance - terminalWallDistance)).toBeLessThanOrEqual(0.05);`;
const photoAssertions = `  // Aug. 15 KPHX photo authority: A1 uses a long fixed corridor/dogleg to a remote Rotunda.\n  // terminalWallDistance is separate source-local wall telemetry and must not be equated to that route.\n  expect(finalRotundaToWallDistance).toBeGreaterThan(18);\n  expect(finalRotundaToWallDistance).toBeLessThan(30);`;

if (source.includes(staleWait)) source = source.replace(staleWait, photoWait);
else if (!source.includes(photoWait)) throw new Error("source-first A1 photo-route wait anchor changed");
if (source.includes(staleAssertions)) source = source.replace(staleAssertions, photoAssertions);
else if (!source.includes(photoAssertions)) throw new Error("source-first A1 photo-route assertion anchor changed");

if (!source.includes(marker)) {
  // The current fixed-aircraft contract intentionally separates the historical
  // general inspection-pose provenance from the exact authored-door source-gate
  // authority. Do not require both fields to carry one obsolete token.
  source = source.replace(
    `const AIRCRAFT_AUTHORITY = "final-live-cab-mesh-visible-door-registration-v7";`,
    `const AIRCRAFT_AUTHORITY = "${FIXED_AIRCRAFT_AUTHORITY}";\nconst PHYSICAL_CAB_AUTHORITY = "${PHYSICAL_CAB_AUTHORITY}";\n// ${marker}`,
  );
  source = source.replaceAll(
    `data?.inspectionAircraftPoseAuthority === aircraftAuthority\n      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority`,
    `typeof data?.inspectionAircraftPoseAuthority === "string"\n      && data.inspectionAircraftPoseAuthority.length > 0\n      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority`,
  );
  source = source.replaceAll(
    `&& data?.inspectionAircraftCabContactAuthority === cabContactAuthority\n      && data?.inspectionAircraftDoorStationAuthority === doorStationAuthority`,
    `&& typeof data?.inspectionAircraftCabContactAuthority === "string"\n      && data.inspectionAircraftCabContactAuthority.length > 0\n      && typeof data?.inspectionAircraftDoorStationAuthority === "string"\n      && data.inspectionAircraftDoorStationAuthority.length > 0`,
  );
  source = source.replaceAll(
    `&& Number.isFinite(Number(data?.inspectionAircraftCabContactX))\n      && Number.isFinite(Number(data?.inspectionAircraftCabContactZ))\n      && Number.isFinite(Number(data?.inspectionAircraftDoorTargetX))\n      && Number.isFinite(Number(data?.inspectionAircraftDoorTargetZ))\n      && Number(data?.inspectionAircraftCabContactErrorMeters) <= 0.01`,
    `&& data?.inspectionAircraftCabDoorContactAuthority === PHYSICAL_CAB_AUTHORITY\n      && data?.inspectionAircraftCabDoorContactPlaneCovered === "true"\n      && data?.inspectionAircraftCabDoorLaterallyCovered === "true"\n      && data?.inspectionAircraftCabDoorVerticallyCovered === "true"\n      && Number(data?.inspectionAircraftCabDoorFacingVertexCount) >= 3\n      && Number.isFinite(Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters))\n      && Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`,
  );
  source = source.replace(
    `    doorStationAuthority: DOOR_STATION_AUTHORITY,\n  }, { timeout: 180_000, polling: 250 });`,
    `    doorStationAuthority: DOOR_STATION_AUTHORITY,\n  }, { timeout: 180_000, polling: 250 });`,
  );
  // Keep the post-wait assertions fail-closed on the fixed aircraft, but do not
  // demand obsolete representative-point authority names that no longer own fit.
  source = source.replace(
    `  expect(runtime.inspectionAircraftPoseAuthority).toBe(AIRCRAFT_AUTHORITY);\n  expect(runtime.inspectionAircraftFixedSourceGateAuthority).toBe(AIRCRAFT_AUTHORITY);`,
    `  expect(runtime.inspectionAircraftPoseAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftFixedSourceGateAuthority).toBe(AIRCRAFT_AUTHORITY);`,
  );
  source = source.replace(
    `  expect(runtime.inspectionAircraftCabContactAuthority).toBe(CAB_CONTACT_AUTHORITY);\n  expect(runtime.inspectionAircraftDoorStationAuthority).toBe(DOOR_STATION_AUTHORITY);`,
    `  expect(runtime.inspectionAircraftCabContactAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftDoorStationAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftCabDoorContactAuthority).toBe(PHYSICAL_CAB_AUTHORITY);\n  expect(runtime.inspectionAircraftCabDoorContactPlaneCovered).toBe("true");\n  expect(runtime.inspectionAircraftCabDoorLaterallyCovered).toBe("true");\n  expect(runtime.inspectionAircraftCabDoorVerticallyCovered).toBe("true");\n  expect(Number(runtime.inspectionAircraftCabDoorFacingVertexCount)).toBeGreaterThanOrEqual(3);\n  expect(Number(runtime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`,
  );
}

for (const required of [
  marker, FIXED_AIRCRAFT_AUTHORITY, PHYSICAL_CAB_AUTHORITY,
  "inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters",
  "inspectionAircraftCabDoorContactPlaneCovered",
  "inspectionAircraftCabDoorLaterallyCovered",
  "inspectionAircraftCabDoorVerticallyCovered",
  "a1ExactRotundaToWallWorldMeters) > 18",
]) {
  if (!source.includes(required)) throw new Error(`source-first A1 verifier is missing ${required}`);
}
if (source.includes('const AIRCRAFT_AUTHORITY = "final-live-cab-mesh-visible-door-registration-v7";')) {
  throw new Error("source-first A1 verifier retained stale fixed-aircraft authority");
}
if (source.includes("Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05")) {
  throw new Error("source-first A1 verifier retained stale compact wall equality");
}

fs.writeFileSync(testPath, source);
console.log("Prepared source-first A1 verifier for the Aug. 15 long dogleg/remote Rotunda plus fixed-aircraft exact Cab boarding-surface contact; obsolete Cab-centroid and shared-authority assumptions are no longer acceptance gates.");
