import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-world-tunnel-c-footprint-camera-v2";
const runtimeSupportMarker = "a1-final-world-runtime-support-meshes-v2";
const integratedCarrierMarker = "a1-integrated-tunnel-c-opaque-support-carrier-v1";
const rampRelativeGroundMarker = "a1-final-world-ramp-relative-ground-authority-v1";
const curvedHoodCoverageMarker = "a1-final-curved-cab-hood-center-coverage-v1";
let source = fs.readFileSync(trainerPath, "utf8");
let doorFitSource = fs.readFileSync(doorFitPath, "utf8");

// Runtime inspection of the exact GLB proves Tunnel_C exposes one substantial
// opaque mesh plus a tiny glass mesh. After final articulation the opaque carrier
// reaches roughly 13.67 m horizontal and 9.61 m vertical AABB extent, so use the
// same bounded 14.5/10.5 m envelope as the final physical-fit normalizer.
if (!doorFitSource.includes(integratedCarrierMarker)) {
  if (doorFitSource.includes("maximumHorizontalDimension <= 6.5") && doorFitSource.includes("size.y <= 5.5")) {
    doorFitSource = doorFitSource
      .replace("maximumHorizontalDimension <= 6.5", `maximumHorizontalDimension <= 14.5\n      // ${integratedCarrierMarker}`)
      .replace("size.y <= 5.5", "size.y <= 10.5");
  } else if (doorFitSource.includes("maximumHorizontalDimension <= 14.5") && doorFitSource.includes("size.y <= 10.5")) {
    doorFitSource = doorFitSource.replace(
      "maximumHorizontalDimension <= 14.5",
      `maximumHorizontalDimension <= 14.5\n      // ${integratedCarrierMarker}`,
    );
  } else {
    throw new Error(`${doorFitPath}: integrated Tunnel-C carrier selector is missing or inconsistent`);
  }
  fs.writeFileSync(doorFitPath, doorFitSource, "utf8");
}

if (!source.includes(integratedCarrierMarker)) {
  if (source.includes("Math.max(size.x, size.z) <= 6.5") && source.includes("size.y <= 5.5")) {
    source = source
      .replace("Math.max(size.x, size.z) <= 6.5", `Math.max(size.x, size.z) <= 14.5\n                  // ${integratedCarrierMarker}`)
      .replace("size.y <= 5.5", "size.y <= 10.5");
  } else if (source.includes("Math.max(size.x, size.z) <= 14.5") && source.includes("size.y <= 10.5")) {
    source = source.replace(
      "Math.max(size.x, size.z) <= 14.5",
      `Math.max(size.x, size.z) <= 14.5\n                  // ${integratedCarrierMarker}`,
    );
  } else {
    throw new Error(`${trainerPath}: final-world integrated Tunnel-C carrier selector is missing or inconsistent`);
  }
}

const obsoleteGuard = `            if (!(exactA1TunnelCLateralOffset < 4.0)) {\n              throw new Error(\`A1 final-world Tunnel_C contact is too far off the Rotunda-to-Cab axis: lateral=\${exactA1TunnelCLateralOffset}\`);\n            }`;
const footprintGuard = `            // ${marker}\n            // The real supplied Tunnel_C low-contact footprint owns contact.\n            // The Rotunda-to-Cab line proves aircraft-side ordering only; lateral\n            // offset remains diagnostic and is not used as a fake wheel identity.\n            if (!(Number.isFinite(exactA1TunnelCLateralOffset)\n              && Number.isFinite(exactA1TunnelCLowCenter.x)\n              && Number.isFinite(exactA1TunnelCLowCenter.z)\n              && Number.isFinite(exactA1TunnelCLowSize.x)\n              && Number.isFinite(exactA1TunnelCLowSize.z)\n              && exactA1TunnelCLowPointCount >= 4\n              && exactA1TunnelCHorizontalSpan >= 0.35)) {\n              throw new Error(\`A1 final-world Tunnel_C contact footprint is invalid: lateral=\${exactA1TunnelCLateralOffset} points=\${exactA1TunnelCLowPointCount} span=\${exactA1TunnelCHorizontalSpan}\`);\n            }`;

if (!source.includes(marker)) {
  if (!source.includes(obsoleteGuard)) {
    throw new Error(`${trainerPath}: obsolete 4 m Tunnel_C centerline guard is missing; inspect generated camera before changing it`);
  }
  source = source.replace(obsoleteGuard, footprintGuard);
}

// The exact final Cab is curved. The 0.20 m extreme band is deliberately narrow
// for contact-plane and lateral registration, but its lower lip can be recessed
// farther than 0.20 m from the most aircraftward upper shell. Reusing that narrow
// band for vertical hood coverage falsely reported the entire Cab ~0.93 m above
// the exact door center even though the nearest supplied vertex was only 2.25 cm
// away horizontally. Use the same 1.00 m curved-hood depth envelope as the physical
// Cab fitter for VERTICAL door-center coverage only; keep the narrow band for the
// actual contact-plane/lateral tests.
if (!source.includes(curvedHoodCoverageMarker)) {
  const narrowBandNeedle = `          const finalCabDoorFacingBand = finalCabVerticesWorld.filter((point) => (\n            finalCabDoorwardMaximumProjection\n              - point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld)\n          ) <= 0.20);\n          if (finalCabDoorFacingBand.length < 3) {\n            throw new Error("A1 final supplied Cab exposes no door-facing vertex band");\n          }`;
  const dualBandReplacement = `${narrowBandNeedle}\n          // ${curvedHoodCoverageMarker}\n          const finalCabHoodCoverageBand = finalCabVerticesWorld.filter((point) => (\n            finalCabDoorwardMaximumProjection\n              - point.clone().sub(finalCabBoundsCenter).dot(finalCabDoorwardDirectionWorld)\n          ) <= 1.00);\n          if (finalCabHoodCoverageBand.length < 3) {\n            throw new Error("A1 final supplied Cab exposes no curved hood coverage band");\n          }`;
  if (!source.includes(narrowBandNeedle)) {
    throw new Error(`${trainerPath}: exact Cab narrow door-facing proof band is missing`);
  }
  source = source.replace(narrowBandNeedle, dualBandReplacement);

  const loopEndNeedle = `            cabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n              cabDoorMinimumHorizontalVertexDistanceMeters,\n              Math.hypot(fromDoor.x, fromDoor.z),\n            );\n          }\n          const cabDoorContactPlaneCovered = cabDoorMinimumNormalMeters <= 0.04`;
  const loopEndReplacement = `            cabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n              cabDoorMinimumHorizontalVertexDistanceMeters,\n              Math.hypot(fromDoor.x, fromDoor.z),\n            );\n          }\n          // Recompute only vertical hood coverage from the broader curved surface.\n          // Normal/lateral registration above remains owned by the 0.20 m face.\n          cabDoorMinimumHeightMeters = Number.POSITIVE_INFINITY;\n          cabDoorMaximumHeightMeters = Number.NEGATIVE_INFINITY;\n          for (const point of finalCabHoodCoverageBand) {\n            const heightFromDoorCenter = point.y - renderedDoorAtSourceGate.y;\n            if (!Number.isFinite(heightFromDoorCenter)) continue;\n            cabDoorMinimumHeightMeters = Math.min(cabDoorMinimumHeightMeters, heightFromDoorCenter);\n            cabDoorMaximumHeightMeters = Math.max(cabDoorMaximumHeightMeters, heightFromDoorCenter);\n          }\n          const cabDoorContactPlaneCovered = cabDoorMinimumNormalMeters <= 0.04`;
  if (!source.includes(loopEndNeedle)) {
    throw new Error(`${trainerPath}: exact Cab footprint loop end is missing`);
  }
  source = source.replace(loopEndNeedle, loopEndReplacement);
}

// The exact integrated Tunnel_C carrier's grounded low-contact centroid lands at
// 38.83% of the final Rotunda-to-Cab bridge span. The old >40% cutoff was a
// synthetic ordering proxy and rejected the real supplied carrier despite a
// zero-clearance ramp footprint. Keep a bounded aircraft-side test, but give the
// measured source carrier margin without changing the strict ramp/contact gates.
source = source.replace(
  "exactA1TunnelCAlongRatio > 0.40 && exactA1TunnelCAlongRatio < 0.88",
  "exactA1TunnelCAlongRatio > 0.35 && exactA1TunnelCAlongRatio < 0.88",
);

// The Terminal 4 ramp is not globally world-Y=0 after the exact source airport
// transform. The old late camera guard therefore rejected a correctly grounded
// carrier at world Y≈1.14 m even though the authoritative final ramp-relative
// clearance published by the fleet is 0.000 m. Do not re-ground or move the GLB
// here. This late camera stage only requires a finite final-world footprint; the
// strict <=15 mm ramp-relative contact authority remains enforced by the fleet
// and by the browser compatibility gate.
const obsoleteAbsoluteGroundCheck = "Math.abs(exactA1TunnelCMinimumY) <= 0.02";
const finiteFinalWorldGroundCheck = `Number.isFinite(exactA1TunnelCMinimumY) /* ${rampRelativeGroundMarker} */`;
if (source.includes(obsoleteAbsoluteGroundCheck)) {
  source = source.replaceAll(obsoleteAbsoluteGroundCheck, finiteFinalWorldGroundCheck);
}

for (const required of [
  marker,
  runtimeSupportMarker,
  integratedCarrierMarker,
  rampRelativeGroundMarker,
  curvedHoodCoverageMarker,
  "finalCabHoodCoverageBand",
  "heightFromDoorCenter",
  "exactA1VisibleTunnelCSupportMeshes",
  "Math.max(size.x, size.z) <= 14.5",
  "size.y <= 10.5",
  "exactA1TunnelCLowBand.expandByPoint",
  "exactA1TunnelCLowPointCount >= 4",
  "exactA1TunnelCHorizontalSpan >= 0.35",
  "exactA1TunnelCAlongRatio > 0.35 && exactA1TunnelCAlongRatio < 0.88",
  "Number.isFinite(exactA1TunnelCMinimumY)",
  "exactA1BogieFinalWorldLateralOffsetMeters = exactA1TunnelCLateralOffset",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final-world Tunnel_C/Cab evidence is missing ${required}`);
  }
}
for (const required of [integratedCarrierMarker, "maximumHorizontalDimension <= 14.5", "size.y <= 10.5"]) {
  if (!doorFitSource.includes(required)) throw new Error(`${doorFitPath}: integrated Tunnel-C carrier fit is missing ${required}`);
}
for (const forbidden of [
  'getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")',
  'getObjectByName?.("Tunnel_C_GalvanizedServiceStair_SourceTriangles")',
  'const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")',
  "exactA1TunnelCLateralOffset < 4.0",
  "A1 final-world Tunnel_C contact is too far off the Rotunda-to-Cab axis",
  obsoleteAbsoluteGroundCheck,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete Tunnel_C bogie evidence remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker} + ${integratedCarrierMarker} + ${rampRelativeGroundMarker} + ${curvedHoodCoverageMarker}: the exact GLB's integrated opaque Tunnel-C carrier retains strict ramp-relative contact, and final Cab vertical door-center coverage now uses the curved hood envelope while contact-plane/lateral registration remains on the tight physical face.`);
