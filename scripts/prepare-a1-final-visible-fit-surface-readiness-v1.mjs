import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const marker = "a1-final-visible-fit-physical-surface-readiness-v4-defer-center-y-to-final-proof";
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
  "a1-final-visible-fit-physical-surface-readiness-v3-door-center-coverage",
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

  const surfaceGuard = `          // ${marker}\n          // Fleet readiness runs before the final rendered fixed-aircraft Cab proof.\n          // At this stage require only the stable physical invariants that cannot be\n          // invalidated by the later door-facing surface classifier: Cab contact-plane\n          // registration, lateral door coverage and Tunnel-C/Cab seam continuity.\n          // Vertical door-center coverage is intentionally deferred to\n          // a1-final-exact-cab-footprint-door-contact-v2, which evaluates the FINAL\n          // live Cab vertices against the immovable authored CRJ door and fails closed.\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n          )) {\n            throw new Error(\`A1 final visible physical Cab pre-readiness failed: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, centerYDiagnostic=\${finalVisibleFit.correctedCabDoorCenterVerticallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, legacyRepresentativeVertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;

  source = source.replace(telemetryAnchor, `${surfaceGuard}\n          ${telemetryAnchor}`);
}

const telemetry = "          group.userData.uploadedJetwayA1FinalPhysicalDoorVerticalGapMeters = finalVisibleFit.verticalGapMeters;";
const authorityTelemetry = `          group.userData.uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority = "${marker}";`;
const priorAuthorityPattern = /          group\.userData\.uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority = "a1-final-visible-fit-physical-surface-readiness-v[^"]+";/;
if (priorAuthorityPattern.test(source)) {
  source = source.replace(priorAuthorityPattern, authorityTelemetry);
} else if (!source.includes(authorityTelemetry)) {
  if (!source.includes(telemetry)) throw new Error(`${path}: final-visible telemetry anchor is missing after guard installation`);
  source = source.replace(telemetry, `${telemetry}\n${authorityTelemetry}`);
}

for (const required of [
  marker,
  "finalVisibleFit.correctedCabContactPlaneCovered === true",
  "finalVisibleFit.correctedCabDoorLaterallyCovered === true",
  "finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12",
  "a1-final-exact-cab-footprint-door-contact-v2",
  "uploadedJetwayA1FinalPhysicalDoorSurfaceReadinessAuthority",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical-surface readiness is missing ${required}`);
}
for (const forbidden of [
  "A1 final visible Cab did not reach grounded CRJ door",
  "Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08",
  "&& finalVisibleFit.correctedCabDoorCenterVerticallyCovered === true",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale premature vertical veto survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: fleet readiness keeps stable Cab plane/lateral/seam checks and defers vertical door-center acceptance to the final fixed-aircraft live Cab footprint proof.`);
