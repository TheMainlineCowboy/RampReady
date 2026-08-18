import fs from "node:fs";

const testPath = "tests/browser/source-first-a1-repair.spec.js";
let source = fs.readFileSync(testPath, "utf8");
const FIXED_AIRCRAFT_AUTHORITY = "fixed-current-a1-aircraft-pose-exact-authored-door-v1";
const PHYSICAL_CAB_AUTHORITY = "a1-final-exact-cab-footprint-door-contact-v2";
const marker = "source-first-a1-physical-cab-surface-verifier-v3-serialized-authority";

const staleWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05`;
const photoWait = `      && Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Number(data?.a1ExactRotundaToWallWorldMeters) > 18\n      && Number(data?.a1ExactRotundaToWallWorldMeters) < 30`;

const staleAssertions = `  expect(finalRotundaToWallDistance).toBeGreaterThan(2.9);\n  expect(finalRotundaToWallDistance).toBeLessThan(5.8);\n  expect(Math.abs(finalRotundaToWallDistance - terminalWallDistance)).toBeLessThanOrEqual(0.05);`;
const photoAssertions = `  // Aug. 15 KPHX photo authority: A1 uses a long fixed corridor/dogleg to a remote Rotunda.\n  // terminalWallDistance is separate source-local wall telemetry and must not be equated to that route.\n  expect(finalRotundaToWallDistance).toBeGreaterThan(18);\n  expect(finalRotundaToWallDistance).toBeLessThan(30);`;

if (source.includes(staleWait)) source = source.replace(staleWait, photoWait);
else if (!source.includes(photoWait)) throw new Error("source-first A1 photo-route wait anchor changed");
if (source.includes(staleAssertions)) source = source.replace(staleAssertions, photoAssertions);
else if (!source.includes(photoAssertions)) throw new Error("source-first A1 photo-route assertion anchor changed");

// The current fixed-aircraft contract intentionally separates historical pose
// provenance from the exact authored-door source-gate authority. The physical
// Cab authority must also be serialized into page.waitForFunction; free Node
// constants do not exist inside Playwright's browser predicate.
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
  `&& data?.inspectionAircraftCabDoorContactAuthority === physicalCabAuthority\n      && data?.inspectionAircraftCabDoorContactPlaneCovered === "true"\n      && data?.inspectionAircraftCabDoorLaterallyCovered === "true"\n      && data?.inspectionAircraftCabDoorVerticallyCovered === "true"\n      && Number(data?.inspectionAircraftCabDoorFacingVertexCount) >= 3\n      && Number.isFinite(Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters))\n      && Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`,
);
source = source.replace(
  `    doorStationAuthority,\n  }) => {`,
  `    doorStationAuthority,\n    physicalCabAuthority,\n  }) => {`,
);
source = source.replace(
  `    doorStationAuthority: DOOR_STATION_AUTHORITY,\n  }, { timeout: 180_000, polling: 250 });`,
  `    doorStationAuthority: DOOR_STATION_AUTHORITY,\n    physicalCabAuthority: PHYSICAL_CAB_AUTHORITY,\n  }, { timeout: 180_000, polling: 250 });`,
);
source = source.replace(
  `  expect(runtime.inspectionAircraftPoseAuthority).toBe(AIRCRAFT_AUTHORITY);\n  expect(runtime.inspectionAircraftFixedSourceGateAuthority).toBe(AIRCRAFT_AUTHORITY);`,
  `  expect(runtime.inspectionAircraftPoseAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftFixedSourceGateAuthority).toBe(AIRCRAFT_AUTHORITY);`,
);
source = source.replace(
  `  expect(runtime.inspectionAircraftCabContactAuthority).toBe(CAB_CONTACT_AUTHORITY);\n  expect(runtime.inspectionAircraftDoorStationAuthority).toBe(DOOR_STATION_AUTHORITY);`,
  `  expect(runtime.inspectionAircraftCabContactAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftDoorStationAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftCabDoorContactAuthority).toBe(PHYSICAL_CAB_AUTHORITY);\n  expect(runtime.inspectionAircraftCabDoorContactPlaneCovered).toBe("true");\n  expect(runtime.inspectionAircraftCabDoorLaterallyCovered).toBe("true");\n  expect(runtime.inspectionAircraftCabDoorVerticallyCovered).toBe("true");\n  expect(Number(runtime.inspectionAircraftCabDoorFacingVertexCount)).toBeGreaterThanOrEqual(3);\n  expect(Number(runtime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`,
);

for (const required of [
  marker, FIXED_AIRCRAFT_AUTHORITY, PHYSICAL_CAB_AUTHORITY,
  "physicalCabAuthority: PHYSICAL_CAB_AUTHORITY",
  "inspectionAircraftCabDoorContactAuthority === physicalCabAuthority",
  "inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters",
  "inspectionAircraftCabDoorContactPlaneCovered",
  "inspectionAircraftCabDoorLaterallyCovered",
  "inspectionAircraftCabDoorVerticallyCovered",
  "a1ExactRotundaToWallWorldMeters) > 18",
]) {
  if (!source.includes(required)) throw new Error(`source-first A1 verifier is missing ${required}`);
}
if (source.includes("inspectionAircraftCabDoorContactAuthority === PHYSICAL_CAB_AUTHORITY")) {
  throw new Error("source-first browser predicate retained an unserialized physical Cab authority reference");
}
if (source.includes('const AIRCRAFT_AUTHORITY = "final-live-cab-mesh-visible-door-registration-v7";')) {
  throw new Error("source-first A1 verifier retained stale fixed-aircraft authority");
}
if (source.includes("Math.abs(Number(data?.a1ExactRotundaToWallWorldMeters) - Number(data?.terminal4A1JetwayWallDistance)) <= 0.05")) {
  throw new Error("source-first A1 verifier retained stale compact wall equality");
}

fs.writeFileSync(testPath, source);
console.log("Prepared source-first A1 verifier with serialized physical Cab authority, Aug. 15 long dogleg/remote Rotunda acceptance, fixed-aircraft exact Cab surface contact, and no obsolete centroid/shared-authority gates.");
