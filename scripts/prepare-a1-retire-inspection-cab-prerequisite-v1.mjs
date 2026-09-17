import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-retire-inspection-aircraft-cab-prerequisite-v1";
let source = fs.readFileSync(trainerPath, "utf8");

// The historical inspection-pose stage moved the aircraft to a cached Cab point
// and therefore treated that cached point as a prerequisite for constructing the
// inspection aircraft. That is backwards for the Aug. 15/Aug. 17 repair: the CRJ
// is fixed at the decoded A1 stand center and the supplied jetway must reach it.
//
// This final pre-Vite pass must be generation-order safe. Earlier preparers are
// allowed to have already retired or rewritten the stale guard. Remove the stale
// loader veto semantically wherever it survives instead of depending on one exact
// historical formatting of the surrounding if block.
const staleLoaderThrow = /throw\s+new\s+Error\s*\(\s*["'`]A1 inspection aircraft is missing the measured final Cab contact["'`]\s*\)\s*;?/g;
if (staleLoaderThrow.test(source)) {
  source = source.replace(
    staleLoaderThrow,
    `void 0; // ${marker}: cached Cab contact is diagnostic-only; fixed aircraft remains authoritative`,
  );
}

// Also retire the common historical finite-contact guard when its recognizable
// structure survives. This is optional; the semantic throw cleanup above is the
// fail-safe that prevents a regenerated spelling from aborting the browser.
const staleFiniteGuard = /        if \(!\[exactA1CabContactX,[\s\S]*?exactA1CabDirectionZ\]\.every\(Number\.isFinite\)\) \{\n[\s\S]*?\n        \}/;
if (staleFiniteGuard.test(source)) {
  source = source.replace(
    staleFiniteGuard,
    `        // ${marker}\n        const legacyInspectionCabContactAvailable = [\n          exactA1CabContactX,\n          typeof exactA1CabContactY === "undefined" ? 0 : exactA1CabContactY,\n          exactA1CabContactZ,\n          exactA1CabDirectionX,\n          exactA1CabDirectionZ,\n        ].every(Number.isFinite);`,
  );
}

// The later fixed-aircraft preparer deliberately leaves a coarse legacy Cab
// residual as a pre-contact diagnostic. If that exact older block still exists,
// make the centroid optional. If another preparer has already rewritten it, do
// not resurrect the old implementation just to satisfy this compatibility pass.
const staleCoarseBlock = `          const aircraftRelocationWorld = new THREE.Vector3(\n            exactA1CabContactX - visibleDoorBefore.point.x,\n            0,\n            exactA1CabContactZ - visibleDoorBefore.point.z,\n          );\n          const fixedAircraftDoorHorizontalErrorMeters = Math.hypot(\n            aircraftRelocationWorld.x, aircraftRelocationWorld.z,\n          );\n          // This is a coarse pre-contact residual. The final live-Cab proof below remains\n          // fail-closed at 8 cm after the connected bridge/Cab articulation is applied.\n          // Allow up to 10 cm here so a 2 mm-over-threshold provisional fit can reach\n          // the actual final contact solver instead of aborting the scene prematurely.\n          if (!Number.isFinite(fixedAircraftDoorHorizontalErrorMeters) || fixedAircraftDoorHorizontalErrorMeters > 0.10) {\n            throw new Error(\`A1 jetway missed the fixed exact authored CRJ door before final contact: \${fixedAircraftDoorHorizontalErrorMeters} m\`);\n          }`;
const fixedCoarseBlock = `          const legacyInspectionCabContactAvailable = [\n            exactA1CabContactX,\n            typeof exactA1CabContactY === "undefined" ? 0 : exactA1CabContactY,\n            exactA1CabContactZ,\n            exactA1CabDirectionX,\n            exactA1CabDirectionZ,\n          ].every(Number.isFinite);\n          const aircraftRelocationWorld = legacyInspectionCabContactAvailable\n            ? new THREE.Vector3(\n              exactA1CabContactX - visibleDoorBefore.point.x,\n              0,\n              exactA1CabContactZ - visibleDoorBefore.point.z,\n            )\n            : new THREE.Vector3(0, 0, 0);\n          const fixedAircraftDoorHorizontalErrorMeters = legacyInspectionCabContactAvailable\n            ? Math.hypot(aircraftRelocationWorld.x, aircraftRelocationWorld.z)\n            : Number.NaN;\n          // ${marker}\n          // Legacy centroid telemetry is diagnostic only. When present it may still\n          // expose a gross pre-contact miss, but absence is not a reason to move the\n          // fixed aircraft or abort before the final physical Cab-surface solver.\n          if (legacyInspectionCabContactAvailable && fixedAircraftDoorHorizontalErrorMeters > 0.10) {\n            throw new Error(\`A1 jetway missed the fixed exact authored CRJ door before final contact: \${fixedAircraftDoorHorizontalErrorMeters} m\`);\n          }`;
if (source.includes(staleCoarseBlock)) {
  source = source.replace(staleCoarseBlock, fixedCoarseBlock);
}

// If an earlier stage already retired the historical blocks, stamp only a
// harmless source comment so repeated production preparation remains idempotent.
if (!source.includes(marker)) {
  const anchor = "fixed-source-a1-parking-center-exact-authored-door-v2";
  if (!source.includes(anchor)) {
    throw new Error(`${trainerPath}: fixed-aircraft authority is missing before Cab-prerequisite normalization`);
  }
  source = source.replace(anchor, `${marker} ${anchor}`);
}

// The stale loader message may be emitted by several historical code shapes. Its
// mere survival is forbidden, independent of indentation, quote style or whether
// the enclosing guard was rewritten by another preparer.
if (/A1 inspection aircraft is missing the measured final Cab contact/.test(source)) {
  throw new Error(`${trainerPath}: stale inspection-aircraft Cab prerequisite survived final normalization`);
}
for (const required of [
  marker,
  "fixed-source-a1-parking-center-exact-authored-door-v2",
  "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final fixed-aircraft Cab-prerequisite retirement is missing ${required}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: the fixed A1 CRJ no longer depends on a retired cached Cab centroid; final supplied-Cab surface contact remains fail-closed.`);
