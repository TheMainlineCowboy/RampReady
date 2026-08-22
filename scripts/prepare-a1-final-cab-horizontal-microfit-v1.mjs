import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-cab-horizontal-representative-diagnostic-v2";
const sillMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(sillMarker)) {
  throw new Error(`${path}: Cab horizontal diagnostic must run after final sill/hood fit`);
}

if (!source.includes(marker)) {
  const anchor = [
    "  resolvedCabSurface = resolveFinalCabPassengerSurface();",
    "  passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));",
    "  const passengerMaximumWorldY = Math.max(...resolvedCabSurface.passenger.map((point) => point.y));",
  ].join("\n");
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final post-sill Cab measurement anchor is missing`);
  }

  const replacement = [
    "  resolvedCabSurface = resolveFinalCabPassengerSurface();",
    "  passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));",
    `  // ${marker}`,
    "  // cabAssembly.front.point is a representative point chosen from the Cab mesh,",
    "  // not the physical rounded hood contact footprint. Preserve its residual only",
    "  // as diagnostics. Never translate the Cab/Tunnel-C hierarchy to satisfy this",
    "  // proxy; the later fixed-aircraft door-facing surface proof is authoritative.",
    "  const cabHorizontalTargetInModel = model.worldToLocal(targetWorld.clone());",
    "  const cabHorizontalRepresentativeDeltaInModel = cabHorizontalTargetInModel",
    "    .clone().sub(cabAssembly.front.point).setY(0);",
    "  const cabHorizontalRepresentativeResidualMeters = cabHorizontalRepresentativeDeltaInModel.length();",
    "  if (!Number.isFinite(cabHorizontalRepresentativeResidualMeters)) {",
    "    throw new Error(\"A1 final Cab representative horizontal residual is not finite\");",
    "  }",
    "  const passengerMaximumWorldY = Math.max(...resolvedCabSurface.passenger.map((point) => point.y));",
  ].join("\n");
  source = source.replace(anchor, replacement);

  const resultNeedle = "    cabPassengerSillCorrectionMeters,";
  if (!source.includes(resultNeedle)) throw new Error(`${path}: Cab result telemetry anchor is missing`);
  source = source.replace(resultNeedle, [
    resultNeedle,
    "    cabHorizontalRepresentativeResidualMeters,",
  ].join("\n"));

  const telemetryNeedle = "  group.userData.uploadedJetwayA1DoorFitPassengerSillCorrectionMeters = cabPassengerSillCorrectionMeters;";
  if (!source.includes(telemetryNeedle)) throw new Error(`${path}: Cab browser telemetry anchor is missing`);
  source = source.replace(telemetryNeedle, [
    telemetryNeedle,
    "  group.userData.uploadedJetwayA1DoorFitHorizontalRepresentativeResidualMeters = cabHorizontalRepresentativeResidualMeters;",
    `  group.userData.uploadedJetwayA1DoorFitHorizontalRepresentativeAuthority = "${marker}";`,
  ].join("\n"));
}

for (const required of [
  marker,
  "cabHorizontalRepresentativeResidualMeters",
  "uploadedJetwayA1DoorFitHorizontalRepresentativeResidualMeters",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab horizontal diagnostic is missing ${required}`);
}
for (const forbidden of [
  "cabHorizontalMicroFitMeters",
  "cabHorizontalMicroDeltaInModel",
  "A1 final Cab horizontal residual is outside micro-fit range",
  "A1 final Cab horizontal micro-fit missed the fixed authored door",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: centroid-chasing Cab micro-fit survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: the final Cab representative-point residual is diagnostic only; the supplied Cab is not translated to satisfy a centroid, and the later exact door-facing surface footprint remains fail-closed.`);
