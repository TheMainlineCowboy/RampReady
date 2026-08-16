import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const marker = "a1-final-world-tunnel-c-footprint-camera-v2";
let source = fs.readFileSync(trainerPath, "utf8");

// The final-world camera resolves the exact authored Tunnel-C bogie/support
// subset, scans its transformed vertices, isolates the lowest 10 cm contact band,
// proves a multi-point support footprint, checks that footprint is aircraft-side
// along the Rotunda->Cab bridge, and requires it to be on the ramp. The retired
// 4 m centerline guard is not a valid bogie identity test: the authored support
// truck can be laterally offset from the Rotunda/Cab centerline while still being
// the real supplied wheel/support geometry. Keep lateral offset as diagnostic
// telemetry, but validate identity from the exact authored support footprint.
const obsoleteGuard = `            if (!(exactA1TunnelCLateralOffset < 4.0)) {\n              throw new Error(\`A1 final-world Tunnel_C contact is too far off the Rotunda-to-Cab axis: lateral=\${exactA1TunnelCLateralOffset}\`);\n            }`;
const footprintGuard = `            // ${marker}\n            // Do not force the exact supplied Tunnel_C support centroid onto the\n            // Rotunda-to-Cab centerline. Identity comes from the authored bogie/\n            // support subset and its transformed low-contact footprint; the bridge\n            // axis is used only to prove this footprint is aircraft-side.\n            if (!(Number.isFinite(exactA1TunnelCLateralOffset)\n              && Number.isFinite(exactA1TunnelCLowCenter.x)\n              && Number.isFinite(exactA1TunnelCLowCenter.z)\n              && Number.isFinite(exactA1TunnelCLowSize.x)\n              && Number.isFinite(exactA1TunnelCLowSize.z)\n              && exactA1TunnelCLowPointCount >= 4\n              && exactA1TunnelCHorizontalSpan >= 0.35)) {\n              throw new Error(\`A1 final-world Tunnel_C contact footprint is invalid: lateral=\${exactA1TunnelCLateralOffset} points=\${exactA1TunnelCLowPointCount} span=\${exactA1TunnelCHorizontalSpan}\`);\n            }`;

if (!source.includes(marker)) {
  if (!source.includes(obsoleteGuard)) {
    throw new Error(`${trainerPath}: obsolete 4 m Tunnel_C centerline guard is missing; inspect generated camera before changing it`);
  }
  source = source.replace(obsoleteGuard, footprintGuard);
}

for (const required of [
  marker,
  'getObjectByName?.("Tunnel_C_DarkBogieLift_SourceTriangles")',
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
for (const forbidden of [
  'const exactA1VisibleTunnelC = exactA1VisibleModel?.getObjectByName?.("Tunnel_C")',
  "exactA1TunnelCLateralOffset < 4.0",
  "A1 final-world Tunnel_C contact is too far off the Rotunda-to-Cab axis",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: obsolete whole-Tunnel_C/centerline bogie evidence remains: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Prepared ${marker}: final bogie evidence targets the transformed authored Tunnel-C support footprint, retains aircraft-side ordering and ramp-contact checks, and keeps lateral offset as diagnostics without treating the Rotunda/Cab centerline as wheel geometry.`);
