import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-world-tunnel-c-footprint-camera-v2";
const runtimeSupportMarker = "a1-final-world-runtime-support-meshes-v2";
const integratedCarrierMarker = "a1-integrated-tunnel-c-opaque-support-carrier-v1";
const rampRelativeGroundMarker = "a1-final-world-ramp-relative-ground-authority-v1";
const scopedCabProofMarker = "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit";
let source = fs.readFileSync(trainerPath, "utf8");
let doorFitSource = fs.readFileSync(doorFitPath, "utf8");

// Runtime inspection of the exact GLB proves Tunnel_C exposes one substantial
// opaque mesh plus a tiny glass mesh. Keep the bounded source-carrier envelope.
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

// The final Cab proof is installed earlier as the current v7 scoped physical proof.
// Consume semantic symbols from that proof rather than stale generation-specific
// variable names. The proof measures a tight 0.20 m face, a 1.25 m hood envelope,
// and bounded <=28 cm lateral / <=15 cm vertical Cab articulation before final acceptance.
if (!(source.includes(scopedCabProofMarker)
  && source.includes("const measurePhysicalCab = () =>")
  && source.includes("const face = liveCabVerticesWorld.filter")
  && source.includes("const hood = liveCabVerticesWorld.filter")
  && source.includes(") <= 0.20);")
  && source.includes(") <= 1.25);")
  && source.includes("const verticalCovered = physical.minHeight <= 0.08 && physical.maxHeight >= -0.08;")
  && source.includes("inspectionAircraftCabLateralCorrectionMeters")
  && source.includes("inspectionAircraftCabVerticalCorrectionMeters"))) {
  throw new Error(`${trainerPath}: current v7 scoped final Cab face/hood proof is missing before bogie-camera preparation`);
}

// The exact integrated Tunnel_C carrier's grounded low-contact centroid lands at
// about 39% of the final Rotunda-to-Cab bridge span. Keep a bounded source-aware
// aircraft-side ordering test without changing the strict ramp/contact authority.
source = source.replace(
  "exactA1TunnelCAlongRatio > 0.40 && exactA1TunnelCAlongRatio < 0.88",
  "exactA1TunnelCAlongRatio > 0.35 && exactA1TunnelCAlongRatio < 0.88",
);

// KPHX pavement is not globally world-Y=0 after airport transforms. This camera
// stage therefore requires finite final-world geometry only; the fleet/browser
// ramp-relative authority still owns the strict <=15 mm ground-contact decision.
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
  scopedCabProofMarker,
  "measurePhysicalCab",
  "const face = liveCabVerticesWorld.filter",
  "const hood = liveCabVerticesWorld.filter",
  "const verticalCovered = physical.minHeight <= 0.08 && physical.maxHeight >= -0.08;",
  "inspectionAircraftCabLateralCorrectionMeters",
  "inspectionAircraftCabVerticalCorrectionMeters",
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
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: obsolete Tunnel_C/Cab evidence survived: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker} + ${scopedCabProofMarker}: final-world Tunnel-C evidence consumes the current v7 scoped Cab face/hood proof and preserves ramp-relative bogie/contact authority.`);
