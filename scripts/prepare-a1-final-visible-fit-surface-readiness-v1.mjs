import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const marker = "a1-final-visible-fit-physical-surface-readiness-v3-door-center-coverage";
let source = fs.readFileSync(path, "utf8");

// The legacy representative Cab front-point is not a physical boarding-surface
// measurement and has repeatedly reported multi-metre vertical gaps after the
// final supplied Cab geometry was otherwise evaluated. Remove every surviving
// form of that proxy guard on every invocation, including already-prepared trees,
// so it cannot reappear later in the production preparation chain.
source = source.replaceAll(
  `          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {\n            throw new Error(\`A1 final visible Cab did not reach grounded CRJ door: vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }\n`,
  "",
);

for (const priorMarker of [
  "a1-final-visible-fit-physical-surface-readiness-v1",
  "a1-final-visible-fit-physical-surface-readiness-v2-representative-height-backstop",
]) {
  const priorStart = source.indexOf(`          // ${priorMarker}`);
  if (priorStart >= 0) {
    const priorEnd = source.indexOf(
      "          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;",
      priorStart,
    );
    if (priorEnd < 0) throw new Error(`${path}: prior physical-surface readiness block has no telemetry anchor`);
    source = source.slice(0, priorStart) + source.slice(priorEnd);
  }
}

if (!source.includes(marker)) {
  const telemetryAnchor = "          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;";
  if (!source.includes(telemetryAnchor)) throw new Error(`${path}: final-visible telemetry anchor is missing`);

  const surfaceGuard = `          // ${marker}\n          // Final A1 readiness is based on the supplied Cab's actual aircraft-facing\n          // physical footprint: contact plane, lateral door coverage, curved-hood\n          // vertical coverage of the authored door center, and a connected Tunnel-C/Cab\n          // seam. The historical representative front point remains telemetry only.\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && finalVisibleFit.correctedCabDoorCenterVerticallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n          )) {\n            throw new Error(\`A1 final visible physical Cab footprint failed readiness: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, centerY=\${finalVisibleFit.correctedCabDoorCenterVerticallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, legacyRepresentativeVertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;

  source = source.replace(telemetryAnchor, `${surfaceGuard}\n          ${telemetryAnchor}`);
}

const telemetry = "          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;";
const authorityTelemetry = `          group.userData.uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority = "${marker}";`;
if (!source.includes(authorityTelemetry)) {
  if (!source.includes(telemetry)) throw new Error(`${path}: final-visible telemetry anchor is missing after guard installation`);
  source = source.replace(telemetry, `${telemetry}\n${authorityTelemetry}`);
}

for (const required of [
  marker,
  "finalVisibleFit.correctedCabContactPlaneCovered === true",
  "finalVisibleFit.correctedCabDoorLaterallyCovered === true",
  "finalVisibleFit.correctedCabDoorCenterVerticallyCovered === true",
  "finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12",
  "uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical-surface readiness is missing ${required}`);
}
for (const forbidden of [
  "A1 final visible Cab did not reach grounded CRJ door",
  "Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale representative-point vertical veto survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final A1 Cab readiness now uses actual contact-plane/lateral/door-center hood coverage and Tunnel-C seam continuity; the representative Cab point is telemetry only.`);
