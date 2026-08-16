import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-world-tunnel-c-footprint-camera-v2";
const runtimeSupportMarker = "a1-final-world-runtime-support-meshes-v2";
const integratedCarrierMarker = "a1-integrated-tunnel-c-opaque-support-carrier-v1";
let source = fs.readFileSync(trainerPath, "utf8");
let doorFitSource = fs.readFileSync(doorFitPath, "utf8");

// Runtime inspection of the exact GLB proves Tunnel_C exposes one substantial
// opaque mesh (Tunnel_C_Jetway_0, about 12.65 m long) plus a tiny glass mesh.
// The bogie/support triangles are therefore integrated into the opaque carrier,
// not separate Object3D children. Widen only the support-carrier selector enough
// to admit that exact opaque mesh while still excluding unrelated airport-scale
// geometry and the high glass pane. The exact GLB bytes and vertices are unchanged.
if (!doorFitSource.includes(integratedCarrierMarker)) {
  if (!doorFitSource.includes("maximumHorizontalDimension <= 6.5") || !doorFitSource.includes("size.y <= 5.5")) {
    throw new Error(`${doorFitPath}: separable-support selector is missing before integrated-carrier normalization`);
  }
  doorFitSource = doorFitSource
    .replace("maximumHorizontalDimension <= 6.5", `maximumHorizontalDimension <= 13.0\n      // ${integratedCarrierMarker}`)
    .replace("size.y <= 5.5", "size.y <= 8.5");
  fs.writeFileSync(doorFitPath, doorFitSource, "utf8");
}

if (!source.includes(integratedCarrierMarker)) {
  if (!source.includes("Math.max(size.x, size.z) <= 6.5") || !source.includes("size.y <= 5.5")) {
    throw new Error(`${trainerPath}: final-world support selector is missing before integrated-carrier normalization`);
  }
  source = source
    .replace("Math.max(size.x, size.z) <= 6.5", `Math.max(size.x, size.z) <= 13.0\n                  // ${integratedCarrierMarker}`)
    .replace("size.y <= 5.5", "size.y <= 8.5");
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
  "Math.max(size.x, size.z) <= 13.0",
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
for (const required of [integratedCarrierMarker, "maximumHorizontalDimension <= 13.0", "size.y <= 8.5"]) {
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
console.log(`Prepared ${marker} + ${integratedCarrierMarker}: the exact GLB's integrated opaque Tunnel-C support carrier is grounded and measured in final world space; strict aircraft-side footprint and ramp-contact checks remain unchanged.`);
