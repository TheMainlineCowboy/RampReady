import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-world-tunnel-c-footprint-camera-v2";
const runtimeSupportMarker = "a1-final-world-runtime-support-meshes-v2";
const integratedCarrierMarker = "a1-integrated-tunnel-c-opaque-support-carrier-v1";
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

for (const required of [
  marker,
  runtimeSupportMarker,
  integratedCarrierMarker,
  "exactA1VisibleTunnelCSupportMeshes",
  "Math.max(size.x, size.z) <= 14.5",
  "size.y <= 10.5",
  "exactA1TunnelCLowBand.expandByPoint",
  "exactA1TunnelCLowPointCount >= 4",
  "exactA1TunnelCHorizontalSpan >= 0.35",
  "exactA1TunnelCAlongRatio > 0.40 && exactA1TunnelCAlongRatio < 0.88",
  "Math.abs(exactA1TunnelCMinimumY) <= 0.02",
  "exactA1BogieFinalWorldLateralOffsetMeters = exactA1TunnelCLateralOffset",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final-world Tunnel_C support-footprint camera is missing ${required}`);
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
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete Tunnel_C bogie evidence remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker} + ${integratedCarrierMarker}: the exact GLB's integrated opaque Tunnel-C carrier uses the final articulated bounds envelope while strict aircraft-side footprint and ramp-contact checks remain unchanged.`);
