import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const marker = "a1-final-visible-fit-physical-surface-readiness-v1";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const staleGuard = `          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {\n            throw new Error(\`A1 final visible Cab did not reach grounded CRJ door: vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  const surfaceGuard = `          // ${marker}\n          // finalVisibleFit.verticalGapMeters is the legacy representative front-point\n          // diagnostic. The supplied Cab is rounded and its representative point is not\n          // the boarding hood. Readiness therefore checks the actual corrected Cab\n          // contact footprint produced by the final physical fitter. The independent\n          // browser-time exact Cab footprint proof remains the final vertical authority.\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n            && Number.isFinite(finalVisibleFit.cabPassengerSillCorrectionMeters)\n            && Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= 0.75\n          )) {\n            throw new Error(\`A1 final visible physical Cab surface failed readiness: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, sillCorrection=\${finalVisibleFit.cabPassengerSillCorrectionMeters}, legacyVertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  if (!source.includes(staleGuard)) {
    throw new Error(`${path}: stale representative-point final-visible guard is missing`);
  }
  source = source.replace(staleGuard, surfaceGuard);

  const telemetry = `          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;`;
  const telemetryReplacement = `          // Legacy representative-point gap retained only as diagnostics; true final\n          // hood/door vertical coverage is published later by the browser footprint proof.\n          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;\n          group.userData.uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority = "${marker}";`;
  if (!source.includes(telemetry)) throw new Error(`${path}: final-visible telemetry anchor is missing`);
  source = source.replace(telemetry, telemetryReplacement);
}

for (const required of [
  marker,
  "finalVisibleFit.correctedCabContactPlaneCovered === true",
  "finalVisibleFit.correctedCabDoorLaterallyCovered === true",
  "finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12",
  "uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical-surface readiness is missing ${required}`);
}
if (source.includes("A1 final visible Cab did not reach grounded CRJ door")) {
  throw new Error(`${path}: stale representative-point final-visible fatal guard survived`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: fleet readiness now accepts only the final corrected physical Cab contact plane/lateral footprint and Tunnel-C seam; legacy front-point vertical gap is diagnostic, with exact browser hood coverage still fail-closed.`);
