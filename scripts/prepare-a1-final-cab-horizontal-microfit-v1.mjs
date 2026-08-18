import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-cab-horizontal-microfit-v1";
const sillMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";
let source = fs.readFileSync(path, "utf8");

if (!source.includes(sillMarker)) {
  throw new Error(`${path}: Cab horizontal micro-fit must run after final sill/hood fit`);
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
    "  // The coarse hinge/yaw solve historically stopped with up to ~8 cm of residual",
    "  // horizontal error. Close only that final small residual on the supplied Cab",
    "  // articulation itself. The aircraft, terminal, Rotunda and integrated Tunnel-C",
    "  // passenger carrier remain fixed. A >8 cm request is not a micro-fit and fails.",
    "  const cabHorizontalTargetInModel = model.worldToLocal(targetWorld.clone());",
    "  const cabHorizontalMicroDeltaInModel = cabHorizontalTargetInModel",
    "    .clone().sub(cabAssembly.front.point).setY(0);",
    "  const cabHorizontalMicroFitMeters = cabHorizontalMicroDeltaInModel.length();",
    "  if (!Number.isFinite(cabHorizontalMicroFitMeters) || cabHorizontalMicroFitMeters > 0.08) {",
    "    throw new Error(\"A1 final Cab horizontal residual is outside micro-fit range: \" + cabHorizontalMicroFitMeters);",
    "  }",
    "  if (cabHorizontalMicroFitMeters > 0.001) {",
    "    applyModelSpaceMatrix(",
    "      THREE, model, cabAssembly.cab,",
    "      translationMatrix(THREE, cabHorizontalMicroDeltaInModel.x, 0, cabHorizontalMicroDeltaInModel.z),",
    "    );",
    "  }",
    "  anchor.updateMatrixWorld(true);",
    "  model.updateMatrixWorld(true);",
    "  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);",
    "  resolvedCabSurface = resolveFinalCabPassengerSurface();",
    "  passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));",
    "  const cabHorizontalMicroFitResidualWorld = model.localToWorld(cabAssembly.front.point.clone())",
    "    .sub(targetWorld).setY(0).length();",
    "  if (!Number.isFinite(cabHorizontalMicroFitResidualWorld) || cabHorizontalMicroFitResidualWorld > 0.01) {",
    "    throw new Error(\"A1 final Cab horizontal micro-fit missed the fixed authored door: \" + cabHorizontalMicroFitResidualWorld);",
    "  }",
    "  const passengerMaximumWorldY = Math.max(...resolvedCabSurface.passenger.map((point) => point.y));",
  ].join("\n");
  source = source.replace(anchor, replacement);

  const resultNeedle = "    cabPassengerSillCorrectionMeters,";
  if (!source.includes(resultNeedle)) throw new Error(`${path}: Cab result telemetry anchor is missing`);
  source = source.replace(resultNeedle, [
    resultNeedle,
    "    cabHorizontalMicroFitMeters,",
    "    cabHorizontalMicroFitResidualWorld,",
  ].join("\n"));

  const telemetryNeedle = "  group.userData.uploadedJetwayA1DoorFitPassengerSillCorrectionMeters = cabPassengerSillCorrectionMeters;";
  if (!source.includes(telemetryNeedle)) throw new Error(`${path}: Cab browser telemetry anchor is missing`);
  source = source.replace(telemetryNeedle, [
    telemetryNeedle,
    "  group.userData.uploadedJetwayA1DoorFitHorizontalMicroFitMeters = cabHorizontalMicroFitMeters;",
    "  group.userData.uploadedJetwayA1DoorFitHorizontalMicroFitResidualMeters = cabHorizontalMicroFitResidualWorld;",
  ].join("\n"));
}

for (const required of [
  marker,
  "cabHorizontalMicroFitMeters > 0.08",
  "cabHorizontalMicroFitResidualWorld > 0.01",
  "uploadedJetwayA1DoorFitHorizontalMicroFitResidualMeters",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab horizontal micro-fit is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab closes only the <=8 cm coarse-fit residual and must finish within 1 cm of the fixed authored CRJ door; aircraft, terminal, Rotunda and Tunnel-C remain fixed.`);
