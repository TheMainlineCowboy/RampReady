import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-supplied-cab-sill-and-hood-fit-v4";
const physicalAcceptanceMarker = "a1-final-supplied-cab-physical-sill-hood-acceptance-v4";
const exactDoorMarker = "a1-exact-authored-crj-forward-left-door-target-v2-sill-and-center";
const carrierMarker = "a1-preserve-integrated-tunnel-c-carrier-v1";
const contactFootprintMarker = "a1-visible-cab-door-contact-footprint-v1";

let source = fs.readFileSync(path, "utf8");
for (const required of [exactDoorMarker, carrierMarker, contactFootprintMarker]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: final Cab sill/hood fit requires prior marker ${required}`);
  }
}

if (!source.includes(marker)) {
  const anchor = [
    "  anchor.rotation.y = correctedYawRadians;",
    "  anchor.updateMatrixWorld(true);",
    "  model.updateMatrixWorld(true);",
    "  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);",
    "",
    "  const actualWorld = model.localToWorld(cabAssembly.front.point.clone());",
  ].join("\n");
  if (!source.includes(anchor)) {
    throw new Error(`${path}: final fitted-Cab world-measurement anchor is missing`);
  }

  const runtimeBlock = [
    "  anchor.rotation.y = correctedYawRadians;",
    "  anchor.updateMatrixWorld(true);",
    "  model.updateMatrixWorld(true);",
    "  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);",
    "",
    `  // ${marker}`,
    "  // Fit the exact supplied Cab from its physical aircraft-facing passenger surface.",
    "  // The low under-Cab machinery shares the Cab root and must not define the boarding sill.",
    "  // Aircraft, terminal, Tunnel-C carrier and supplied source vertices remain fixed/intact.",
    "  const resolveFinalCabPassengerSurface = () => {",
    "    const localVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);",
    "    const worldVertices = localVertices.map((vertex) => model.localToWorld(vertex.clone()));",
    "    const bounds = new THREE.Box3();",
    "    for (const point of worldVertices) bounds.expandByPoint(point);",
    "    const center = bounds.getCenter(new THREE.Vector3());",
    "    const doorward = targetWorld.clone().sub(center).setY(0);",
    "    if (doorward.lengthSq() < 0.25) throw new Error(\"A1 Cab-to-door direction is degenerate\");",
    "    doorward.normalize();",
    "    let maximumProjection = Number.NEGATIVE_INFINITY;",
    "    for (const point of worldVertices) {",
    "      maximumProjection = Math.max(maximumProjection, point.clone().sub(center).dot(doorward));",
    "    }",
    "    const frontBand = worldVertices.filter((point) => (",
    "      maximumProjection - point.clone().sub(center).dot(doorward)",
    "    ) <= 0.25);",
    "    const hoodBand = worldVertices.filter((point) => (",
    "      maximumProjection - point.clone().sub(center).dot(doorward)",
    "    ) <= 1.00);",
    "    if (frontBand.length < 3 || hoodBand.length < 3) {",
    "      throw new Error(\"A1 supplied Cab exposes no measurable aircraft-facing hood surface\");",
    "    }",
    "    const sortedY = frontBand.map((point) => point.y).sort((a, b) => a - b);",
    "    let passengerSplitY = Number.NEGATIVE_INFINITY;",
    "    for (let index = 1; index < sortedY.length; index += 1) {",
    "      const gap = sortedY[index] - sortedY[index - 1];",
    "      const upperCount = sortedY.length - index;",
    "      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];",
    "      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {",
    "        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);",
    "      }",
    "    }",
    "    if (!Number.isFinite(passengerSplitY)) {",
    "      throw new Error(\"A1 supplied Cab passenger hood cannot be separated from low mechanical geometry\");",
    "    }",
    "    const passenger = frontBand.filter((point) => point.y >= passengerSplitY - 0.001);",
    "    if (passenger.length < 3) throw new Error(\"A1 supplied Cab passenger surface is degenerate\");",
    "    return { worldVertices, passenger, hoodBand, doorward, passengerSplitY };",
    "  };",
    "",
    "  let resolvedCabSurface = resolveFinalCabPassengerSurface();",
    "  let passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));",
    "  const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;",
    "  if (!Number.isFinite(cabPassengerSillCorrectionMeters) || Math.abs(cabPassengerSillCorrectionMeters) > 0.75) {",
    "    throw new Error(\"A1 supplied Cab requires implausible passenger-sill correction: \" + cabPassengerSillCorrectionMeters);",
    "  }",
    "  if (Math.abs(cabPassengerSillCorrectionMeters) > 0.002) {",
    "    applyModelSpaceMatrix(THREE, model, cabAssembly.cab, translationMatrix(THREE, 0, cabPassengerSillCorrectionMeters, 0));",
    "  }",
    "  anchor.updateMatrixWorld(true);",
    "  model.updateMatrixWorld(true);",
    "  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);",
    "  resolvedCabSurface = resolveFinalCabPassengerSurface();",
    "  passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));",
    "  const passengerMaximumWorldY = Math.max(...resolvedCabSurface.passenger.map((point) => point.y));",
    "  const cabHoodMaximumWorldY = Math.max(...resolvedCabSurface.hoodBand.map((point) => point.y));",
    "  const correctedCabSillErrorMeters = Math.abs(passengerMinimumWorldY - targetWorld.y);",
    "  const exactDoorCenterWorldY = exactAuthoredCrjDoorCenterWorldY();",
    "  const correctedCabDoorCenterVerticallyCovered = passengerMinimumWorldY <= exactDoorCenterWorldY + 0.04",
    "    && cabHoodMaximumWorldY >= exactDoorCenterWorldY - 0.04;",
    "  if (correctedCabSillErrorMeters > 0.02 || !correctedCabDoorCenterVerticallyCovered) {",
    "    throw new Error(\"A1 supplied Cab failed exact sill/hood vertical fit: sillError=\"",
    "      + correctedCabSillErrorMeters + \" passengerY=[\" + passengerMinimumWorldY + \",\"",
    "      + passengerMaximumWorldY + \"] hoodMaxY=\" + cabHoodMaximumWorldY",
    "      + \" doorCenterY=\" + exactDoorCenterWorldY);",
    "  }",
    "",
    "  const cabSideWorld = new THREE.Vector3(-resolvedCabSurface.doorward.z, 0, resolvedCabSurface.doorward.x).normalize();",
    "  let correctedCabMinimumNormalMeters = Number.POSITIVE_INFINITY;",
    "  let correctedCabMaximumNormalMeters = Number.NEGATIVE_INFINITY;",
    "  let correctedCabMinimumLateralMeters = Number.POSITIVE_INFINITY;",
    "  let correctedCabMaximumLateralMeters = Number.NEGATIVE_INFINITY;",
    "  for (const point of resolvedCabSurface.passenger) {",
    "    const fromDoor = point.clone().sub(targetWorld);",
    "    const normalOffset = fromDoor.dot(resolvedCabSurface.doorward);",
    "    const lateralOffset = fromDoor.dot(cabSideWorld);",
    "    correctedCabMinimumNormalMeters = Math.min(correctedCabMinimumNormalMeters, normalOffset);",
    "    correctedCabMaximumNormalMeters = Math.max(correctedCabMaximumNormalMeters, normalOffset);",
    "    correctedCabMinimumLateralMeters = Math.min(correctedCabMinimumLateralMeters, lateralOffset);",
    "    correctedCabMaximumLateralMeters = Math.max(correctedCabMaximumLateralMeters, lateralOffset);",
    "  }",
    "  const correctedCabContactPlaneCovered = correctedCabMinimumNormalMeters <= 0.04",
    "    && correctedCabMaximumNormalMeters >= -0.04;",
    "  const correctedCabDoorLaterallyCovered = correctedCabMinimumLateralMeters <= 0.05",
    "    && correctedCabMaximumLateralMeters >= -0.05;",
    "  if (!correctedCabContactPlaneCovered || !correctedCabDoorLaterallyCovered) {",
    "    throw new Error(\"A1 exact CRJ door is outside supplied Cab passenger footprint: normal=[\"",
    "      + correctedCabMinimumNormalMeters + \",\" + correctedCabMaximumNormalMeters",
    "      + \"], lateral=[\" + correctedCabMinimumLateralMeters + \",\" + correctedCabMaximumLateralMeters + \"]\");",
    "  }",
    "",
    "  const tunnelCForCabSeam = findSourcePartRoot(model, \"Tunnel_C\");",
    "  if (!tunnelCForCabSeam) throw new Error(\"A1 final Cab fit cannot find supplied Tunnel_C\");",
    "  model.updateWorldMatrix(true, true);",
    "  const tunnelCWorldBox = new THREE.Box3().setFromObject(tunnelCForCabSeam);",
    "  const cabWorldBoxAfterSill = new THREE.Box3().setFromObject(cabAssembly.cab);",
    "  const axisGapForCabSeam = (minimumA, maximumA, minimumB, maximumB) =>",
    "    Math.max(0, minimumB - maximumA, minimumA - maximumB);",
    "  const cabTunnelCSeamGapMeters = Math.hypot(",
    "    axisGapForCabSeam(tunnelCWorldBox.min.x, tunnelCWorldBox.max.x, cabWorldBoxAfterSill.min.x, cabWorldBoxAfterSill.max.x),",
    "    axisGapForCabSeam(tunnelCWorldBox.min.y, tunnelCWorldBox.max.y, cabWorldBoxAfterSill.min.y, cabWorldBoxAfterSill.max.y),",
    "    axisGapForCabSeam(tunnelCWorldBox.min.z, tunnelCWorldBox.max.z, cabWorldBoxAfterSill.min.z, cabWorldBoxAfterSill.max.z),",
    "  );",
    "  if (!Number.isFinite(cabTunnelCSeamGapMeters) || cabTunnelCSeamGapMeters > 0.12) {",
    "    throw new Error(\"A1 supplied Cab sill fit disconnected Tunnel-C/Cab seam: \" + cabTunnelCSeamGapMeters);",
    "  }",
    "",
    "  const actualWorld = model.localToWorld(cabAssembly.front.point.clone());",
  ].join("\n");
  source = source.replace(anchor, runtimeBlock);

  const guardStart = source.indexOf("  if (\n    cabContactWorldPointCount < 4");
  const guardEnd = source.indexOf("\n\n  const result = Object.freeze({", guardStart);
  if (guardStart < 0 || guardEnd < 0 || guardEnd <= guardStart) {
    throw new Error(`${path}: final contact-footprint acceptance block boundaries are missing`);
  }
  const physicalGuard = [
    `  // ${physicalAcceptanceMarker}`,
    "  if (",
    "    !correctedCabContactPlaneCovered",
    "    || !correctedCabDoorLaterallyCovered",
    "    || !correctedCabDoorCenterVerticallyCovered",
    "    || correctedCabSillErrorMeters > 0.02",
    "    || cabTunnelCSeamGapMeters > 0.12",
    "    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES",
    "    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS",
    "  ) {",
    "    throw new Error(\"Supplied A1 physical Cab sill/hood fit failed: sill=\"",
    "      + correctedCabSillErrorMeters + \" plane=\" + correctedCabContactPlaneCovered",
    "      + \" lateral=\" + correctedCabDoorLaterallyCovered",
    "      + \" centerY=\" + correctedCabDoorCenterVerticallyCovered",
    "      + \" seam=\" + cabTunnelCSeamGapMeters",
    "      + \" legacyHorizontal=\" + horizontalGap + \" legacyVertical=\" + verticalGap",
    "      + \" normalError=\" + cabNormalErrorDegrees + \" penetration=\" + cabFuselagePenetrationMeters);",
    "  }",
  ].join("\n");
  source = source.slice(0, guardStart) + physicalGuard + source.slice(guardEnd);

  const resultNeedle = "    cabVerticalAdjustmentMeters: cabVerticalAdjustment,";
  if (!source.includes(resultNeedle)) throw new Error(`${path}: Cab result telemetry anchor is missing`);
  source = source.replace(resultNeedle, [
    resultNeedle,
    "    cabPassengerSillCorrectionMeters,",
    "    correctedCabSillErrorMeters,",
    "    correctedCabDoorCenterVerticallyCovered,",
    "    cabHoodMaximumWorldY,",
    "    correctedCabContactPlaneCovered,",
    "    correctedCabDoorLaterallyCovered,",
    "    cabTunnelCSeamGapMeters,",
  ].join("\n"));

  const telemetryNeedle = "  group.userData.uploadedJetwayA1DoorFitVerticalGapMeters = verticalGap;";
  if (!source.includes(telemetryNeedle)) throw new Error(`${path}: Cab browser telemetry anchor is missing`);
  source = source.replace(telemetryNeedle, [
    telemetryNeedle,
    "  group.userData.uploadedJetwayA1DoorFitPassengerSillCorrectionMeters = cabPassengerSillCorrectionMeters;",
    "  group.userData.uploadedJetwayA1DoorFitCorrectedCabSillErrorMeters = correctedCabSillErrorMeters;",
    "  group.userData.uploadedJetwayA1DoorFitDoorCenterWorldY = exactDoorCenterWorldY;",
    "  group.userData.uploadedJetwayA1DoorFitDoorCenterVerticallyCovered = correctedCabDoorCenterVerticallyCovered;",
    "  group.userData.uploadedJetwayA1DoorFitCabHoodMaximumWorldY = cabHoodMaximumWorldY;",
    "  group.userData.uploadedJetwayA1DoorFitCorrectedCabContactPlaneCovered = correctedCabContactPlaneCovered;",
    "  group.userData.uploadedJetwayA1DoorFitCorrectedCabDoorLaterallyCovered = correctedCabDoorLaterallyCovered;",
    "  group.userData.uploadedJetwayA1DoorFitCabTunnelCSeamGapMeters = cabTunnelCSeamGapMeters;",
  ].join("\n"));
}

for (const required of [
  marker,
  physicalAcceptanceMarker,
  "cabPassengerSillCorrectionMeters",
  "correctedCabSillErrorMeters > 0.02",
  "correctedCabDoorCenterVerticallyCovered",
  "correctedCabContactPlaneCovered",
  "correctedCabDoorLaterallyCovered",
  "cabTunnelCSeamGapMeters > 0.12",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab sill/hood fit is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: exact supplied Cab passenger threshold is derived from its real aircraft-facing geometry, fitted to the fixed authored CRJ door sill, required to cover the separate door center, and kept connected to integrated Tunnel-C.`);
