import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-retire-inspection-aircraft-cab-prerequisite-v1";
let source = fs.readFileSync(trainerPath, "utf8");

// The historical inspection-pose stage moved the aircraft to a cached Cab point
// and therefore treated that cached point as a prerequisite for constructing the
// inspection aircraft. That is backwards for the Aug. 15/Aug. 17 repair: the CRJ
// is fixed at the decoded A1 stand center and the supplied jetway must reach it.
// By the time this final pre-Vite normalizer runs, the exact fixed-aircraft and
// final physical Cab-surface stages own acceptance. A missing legacy Cab centroid
// must therefore remain diagnostic and may not put the entire airport in load-error.
const staleFiniteGuard = /        if \(!\[exactA1CabContactX,[\s\S]*?exactA1CabDirectionZ\]\.every\(Number\.isFinite\)\) \{\n          throw new Error\("A1 inspection aircraft is missing the measured final Cab contact"\);\n        \}/;
if (staleFiniteGuard.test(source)) {
  source = source.replace(
    staleFiniteGuard,
    `        // ${marker}\n        const legacyInspectionCabContactAvailable = [\n          exactA1CabContactX,\n          typeof exactA1CabContactY === "undefined" ? 0 : exactA1CabContactY,\n          exactA1CabContactZ,\n          exactA1CabDirectionX,\n          exactA1CabDirectionZ,\n        ].every(Number.isFinite);`,
  );
} else if (!source.includes(marker)) {
  throw new Error(`${trainerPath}: stale inspection-Cab prerequisite guard is missing before final fixed-aircraft normalization`);
}

// The later fixed-aircraft preparer deliberately leaves a coarse legacy Cab
// residual as a pre-contact diagnostic. If the legacy centroid was never
// published, do not turn NaN into a loader failure; the final live supplied-Cab
// face/hood proof remains fail-closed and is the actual contact authority.
const staleCoarseBlock = `          const aircraftRelocationWorld = new THREE.Vector3(\n            exactA1CabContactX - visibleDoorBefore.point.x,\n            0,\n            exactA1CabContactZ - visibleDoorBefore.point.z,\n          );\n          const fixedAircraftDoorHorizontalErrorMeters = Math.hypot(\n            aircraftRelocationWorld.x, aircraftRelocationWorld.z,\n          );\n          // This is a coarse pre-contact residual. The final live-Cab proof below remains\n          // fail-closed at 8 cm after the connected bridge/Cab articulation is applied.\n          // Allow up to 10 cm here so a 2 mm-over-threshold provisional fit can reach\n          // the actual final contact solver instead of aborting the scene prematurely.\n          if (!Number.isFinite(fixedAircraftDoorHorizontalErrorMeters) || fixedAircraftDoorHorizontalErrorMeters > 0.10) {\n            throw new Error(\`A1 jetway missed the fixed exact authored CRJ door before final contact: \${fixedAircraftDoorHorizontalErrorMeters} m\`);\n          }`;
const fixedCoarseBlock = `          const aircraftRelocationWorld = legacyInspectionCabContactAvailable\n            ? new THREE.Vector3(\n              exactA1CabContactX - visibleDoorBefore.point.x,\n              0,\n              exactA1CabContactZ - visibleDoorBefore.point.z,\n            )\n            : new THREE.Vector3(0, 0, 0);\n          const fixedAircraftDoorHorizontalErrorMeters = legacyInspectionCabContactAvailable\n            ? Math.hypot(aircraftRelocationWorld.x, aircraftRelocationWorld.z)\n            : Number.NaN;\n          // Legacy centroid telemetry is diagnostic only. When present it may still\n          // expose a gross pre-contact miss, but absence is not a reason to move the\n          // fixed aircraft or abort before the final physical Cab-surface solver.\n          if (legacyInspectionCabContactAvailable && fixedAircraftDoorHorizontalErrorMeters > 0.10) {\n            throw new Error(\`A1 jetway missed the fixed exact authored CRJ door before final contact: \${fixedAircraftDoorHorizontalErrorMeters} m\`);\n          }`;
if (source.includes(staleCoarseBlock)) {
  source = source.replace(staleCoarseBlock, fixedCoarseBlock);
} else if (!source.includes("legacyInspectionCabContactAvailable\n            ? new THREE.Vector3")) {
  throw new Error(`${trainerPath}: fixed-aircraft coarse legacy Cab diagnostic block is missing`);
}

if (source.includes('throw new Error("A1 inspection aircraft is missing the measured final Cab contact")')) {
  throw new Error(`${trainerPath}: stale inspection-aircraft Cab prerequisite survived final normalization`);
}
for (const required of [
  marker,
  "legacyInspectionCabContactAvailable",
  "fixedAircraftDoorHorizontalErrorMeters = legacyInspectionCabContactAvailable",
  "if (legacyInspectionCabContactAvailable && fixedAircraftDoorHorizontalErrorMeters > 0.10)",
  "fixed-source-a1-parking-center-exact-authored-door-v2",
  "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final fixed-aircraft Cab-prerequisite retirement is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: the fixed A1 CRJ no longer depends on the retired cached Cab centroid to load; final supplied-Cab surface contact remains fail-closed.`);
