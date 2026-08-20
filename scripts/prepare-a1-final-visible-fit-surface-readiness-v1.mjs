import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const marker = "a1-final-visible-fit-physical-surface-readiness-v2-representative-height-backstop";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(marker)) {
  const staleGuard = `          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {\n            throw new Error(\`A1 final visible Cab did not reach grounded CRJ door: vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  const priorMarker = "a1-final-visible-fit-physical-surface-readiness-v1";
  const priorStart = source.indexOf(`          // ${priorMarker}`);
  if (priorStart >= 0) {
    const priorEnd = source.indexOf("          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;", priorStart);
    if (priorEnd < 0) throw new Error(`${path}: prior physical-surface readiness block has no telemetry anchor`);
    source = source.slice(0, priorStart) + source.slice(priorEnd);
  }

  const surfaceGuard = `          // ${marker}\n          // The physical Cab footprint remains the primary door-contact proof, but the\n          // broad curved hood can overlap the door while the rendered passenger opening\n          // is still visibly far too high. Keep the representative front-point vertical\n          // gap as a strict independent backstop so a large visual height error cannot\n          // certify itself through a permissive footprint envelope.\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n            && Number.isFinite(finalVisibleFit.cabPassengerSillCorrectionMeters)\n            && Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= 0.75\n            && Number.isFinite(finalVisibleFit.verticalGapMeters)\n            && Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08\n          )) {\n            throw new Error(\`A1 final visible physical Cab surface/height failed readiness: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, sillCorrection=\${finalVisibleFit.cabPassengerSillCorrectionMeters}, vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;

  if (source.includes(staleGuard)) {
    source = source.replace(staleGuard, surfaceGuard);
  } else {
    const telemetryAnchor = "          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;";
    if (!source.includes(telemetryAnchor)) throw new Error(`${path}: final-visible telemetry anchor is missing`);
    source = source.replace(telemetryAnchor, `${surfaceGuard}\n          ${telemetryAnchor.trim()}`);
  }

  const telemetry = `          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;`;
  const telemetryReplacement = `          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;\n          group.userData.uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority = "${marker}";`;
  if (!source.includes(telemetry)) throw new Error(`${path}: final-visible telemetry anchor is missing after guard installation`);
  source = source.replace(telemetry, telemetryReplacement);
}

for (const required of [
  marker,
  "finalVisibleFit.correctedCabContactPlaneCovered === true",
  "finalVisibleFit.correctedCabDoorLaterallyCovered === true",
  "finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12",
  "Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08",
  "uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical-surface readiness is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: exact Cab footprint remains required and a <=8 cm independent rendered-height backstop now prevents the visibly high Cab from falsely passing.`);
