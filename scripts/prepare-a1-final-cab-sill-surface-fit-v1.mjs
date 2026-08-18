import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-supplied-cab-door-facing-sill-surface-fit-v2";
const exactDoorMarker = "a1-exact-authored-crj-forward-left-door-target-v1";
const carrierMarker = "a1-preserve-integrated-tunnel-c-carrier-v1";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(exactDoorMarker)) {
  throw new Error(`${path}: exact authored CRJ door target must be installed before Cab sill surface fit`);
}
if (!source.includes(carrierMarker)) {
  throw new Error(`${path}: integrated Tunnel-C preservation must be installed before Cab sill surface fit`);
}

if (!source.includes(marker)) {
  const oldMarker = "a1-final-supplied-cab-door-facing-sill-surface-fit-v1";
  if (source.includes(oldMarker)) source = source.replaceAll(oldMarker, marker);

  const anchor = `  anchor.rotation.y = correctedYawRadians;\n  anchor.updateMatrixWorld(true);\n  model.updateMatrixWorld(true);\n  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);\n\n  const actualWorld = model.localToWorld(cabAssembly.front.point.clone());`;
  if (!source.includes(marker)) {
    if (!source.includes(anchor)) {
      throw new Error(`${path}: final fitted-Cab world-measurement anchor is missing`);
    }

    const replacement = `  anchor.rotation.y = correctedYawRadians;\n  anchor.updateMatrixWorld(true);\n  model.updateMatrixWorld(true);\n  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);\n\n  // ${marker}\n  // The supplied Cab contains low mechanical/support vertices on the same broad\n  // aircraft-facing side as the passenger hood. Using front.box.min.y as the\n  // passenger threshold therefore aligns machinery to the CRJ door and leaves the\n  // actual boarding hood visibly high. Resolve the FINAL door-facing Cab surface\n  // after extension/yaw/parent rotation, then vertically articulate only the exact\n  // supplied Cab root until the lower edge of that physical surface meets the exact\n  // authored CRJ door contact target. Terminal, aircraft and Tunnel-C remain fixed.\n  const cabAllLocalVerticesForSill = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  const cabWorldVerticesForSill = cabAllLocalVerticesForSill.map((vertex) =>\n    model.localToWorld(vertex.clone()));\n  const cabWorldBoundsForSill = new THREE.Box3();\n  for (const point of cabWorldVerticesForSill) cabWorldBoundsForSill.expandByPoint(point);\n  const cabWorldCenterForSill = cabWorldBoundsForSill.getCenter(new THREE.Vector3());\n  const cabDoorwardDirectionWorld = targetWorld.clone().sub(cabWorldCenterForSill).setY(0);\n  if (cabDoorwardDirectionWorld.lengthSq() < 0.25) {\n    throw new Error("A1 supplied Cab center-to-exact-door direction is degenerate");\n  }\n  cabDoorwardDirectionWorld.normalize();\n  let cabDoorwardMaximumProjection = Number.NEGATIVE_INFINITY;\n  for (const point of cabWorldVerticesForSill) {\n    cabDoorwardMaximumProjection = Math.max(\n      cabDoorwardMaximumProjection,\n      point.clone().sub(cabWorldCenterForSill).dot(cabDoorwardDirectionWorld),\n    );\n  }\n  const cabDoorFacingSurface = cabWorldVerticesForSill.filter((point) => (\n    cabDoorwardMaximumProjection\n      - point.clone().sub(cabWorldCenterForSill).dot(cabDoorwardDirectionWorld)\n  ) <= 0.20);\n  if (cabDoorFacingSurface.length < 3) {\n    throw new Error("A1 supplied Cab exposes no measurable final door-facing surface");\n  }\n  let cabDoorFacingMinimumWorldY = Number.POSITIVE_INFINITY;\n  let cabDoorFacingMaximumWorldY = Number.NEGATIVE_INFINITY;\n  for (const point of cabDoorFacingSurface) {\n    cabDoorFacingMinimumWorldY = Math.min(cabDoorFacingMinimumWorldY, point.y);\n    cabDoorFacingMaximumWorldY = Math.max(cabDoorFacingMaximumWorldY, point.y);\n  }\n  const cabPassengerSillCorrectionMeters = targetWorld.y - cabDoorFacingMinimumWorldY;\n  if (!(\n    Number.isFinite(cabPassengerSillCorrectionMeters)\n    && Math.abs(cabPassengerSillCorrectionMeters) <= 0.75\n  )) {\n    throw new Error(\`A1 supplied Cab requires implausible final sill correction: \${cabPassengerSillCorrectionMeters}; surfaceY=[\${cabDoorFacingMinimumWorldY},\${cabDoorFacingMaximumWorldY}], targetY=\${targetWorld.y}\`);\n  }\n  if (Math.abs(cabPassengerSillCorrectionMeters) > 0.002) {\n    applyModelSpaceMatrix(\n      THREE,\n      model,\n      cabAssembly.cab,\n      translationMatrix(THREE, 0, cabPassengerSillCorrectionMeters, 0),\n    );\n  }\n  anchor.updateMatrixWorld(true);\n  model.updateMatrixWorld(true);\n  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);\n\n  const correctedCabLocalVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  const correctedCabWorldBounds = new THREE.Box3();\n  const correctedCabWorldVertices = correctedCabLocalVertices.map((vertex) => {\n    const world = model.localToWorld(vertex.clone());\n    correctedCabWorldBounds.expandByPoint(world);\n    return world;\n  });\n  const correctedCabWorldCenter = correctedCabWorldBounds.getCenter(new THREE.Vector3());\n  const correctedDoorward = targetWorld.clone().sub(correctedCabWorldCenter).setY(0).normalize();\n  let correctedMaximumProjection = Number.NEGATIVE_INFINITY;\n  for (const point of correctedCabWorldVertices) {\n    correctedMaximumProjection = Math.max(\n      correctedMaximumProjection,\n      point.clone().sub(correctedCabWorldCenter).dot(correctedDoorward),\n    );\n  }\n  const correctedDoorFacingSurface = correctedCabWorldVertices.filter((point) => (\n    correctedMaximumProjection\n      - point.clone().sub(correctedCabWorldCenter).dot(correctedDoorward)\n  ) <= 0.20);\n  if (correctedDoorFacingSurface.length < 3) {\n    throw new Error("A1 corrected supplied Cab exposes no measurable door-facing surface");\n  }\n  const correctedDoorFacingMinimumWorldY = Math.min(...correctedDoorFacingSurface.map((point) => point.y));\n  const correctedCabSillErrorMeters = Math.abs(correctedDoorFacingMinimumWorldY - targetWorld.y);\n  const correctedCabDoorMinimumHorizontalVertexDistanceMeters = Math.min(\n    ...correctedDoorFacingSurface.map((point) => Math.hypot(\n      point.x - targetWorld.x,\n      point.z - targetWorld.z,\n    )),\n  );\n  if (!(correctedCabSillErrorMeters <= 0.02)) {\n    throw new Error(\`A1 supplied Cab physical sill failed exact-door fit after correction: \${correctedCabSillErrorMeters} m\`);\n  }\n  if (!(\n    Number.isFinite(correctedCabDoorMinimumHorizontalVertexDistanceMeters)\n    && correctedCabDoorMinimumHorizontalVertexDistanceMeters <= 0.06\n  )) {\n    throw new Error(\`A1 supplied Cab physical hood missed exact-door target after correction: \${correctedCabDoorMinimumHorizontalVertexDistanceMeters} m\`);\n  }\n\n  const tunnelCForCabSeam = findSourcePartRoot(model, "Tunnel_C");\n  if (!tunnelCForCabSeam) throw new Error("A1 Cab sill fit cannot find supplied Tunnel_C");\n  model.updateWorldMatrix(true, true);\n  const tunnelCWorldBox = new THREE.Box3().setFromObject(tunnelCForCabSeam);\n  const cabWorldBoxAfterSill = new THREE.Box3().setFromObject(cabAssembly.cab);\n  const axisGap = (minimumA, maximumA, minimumB, maximumB) =>\n    Math.max(0, minimumB - maximumA, minimumA - maximumB);\n  const cabTunnelCSeamGapMeters = Math.hypot(\n    axisGap(tunnelCWorldBox.min.x, tunnelCWorldBox.max.x, cabWorldBoxAfterSill.min.x, cabWorldBoxAfterSill.max.x),\n    axisGap(tunnelCWorldBox.min.y, tunnelCWorldBox.max.y, cabWorldBoxAfterSill.min.y, cabWorldBoxAfterSill.max.y),\n    axisGap(tunnelCWorldBox.min.z, tunnelCWorldBox.max.z, cabWorldBoxAfterSill.min.z, cabWorldBoxAfterSill.max.z),\n  );\n  if (!(Number.isFinite(cabTunnelCSeamGapMeters) && cabTunnelCSeamGapMeters <= 0.12)) {\n    throw new Error(\`A1 supplied Cab sill correction disconnected Tunnel-C/Cab seam: \${cabTunnelCSeamGapMeters} m\`);\n  }\n\n  const actualWorld = model.localToWorld(cabAssembly.front.point.clone());`;
    source = source.replace(anchor, replacement);
  }

  const resultNeedle = `    cabVerticalAdjustmentMeters: cabVerticalAdjustment,`;
  if (!source.includes("cabPassengerSillCorrectionMeters,")) {
    if (!source.includes(resultNeedle)) throw new Error(`${path}: Cab vertical result telemetry anchor is missing`);
    source = source.replace(resultNeedle, `${resultNeedle}\n    cabPassengerSillCorrectionMeters,\n    correctedCabSillErrorMeters,\n    correctedCabDoorMinimumHorizontalVertexDistanceMeters,\n    cabTunnelCSeamGapMeters,`);
  } else if (!source.includes("correctedCabDoorMinimumHorizontalVertexDistanceMeters,")) {
    source = source.replace(
      `    correctedCabSillErrorMeters,\n    cabTunnelCSeamGapMeters,`,
      `    correctedCabSillErrorMeters,\n    correctedCabDoorMinimumHorizontalVertexDistanceMeters,\n    cabTunnelCSeamGapMeters,`,
    );
  }

  const telemetryNeedle = `  group.userData.uploadedJetwayA1DoorFitVerticalGapMeters = verticalGap;`;
  if (!source.includes("uploadedJetwayA1DoorFitPassengerSillCorrectionMeters")) {
    if (!source.includes(telemetryNeedle)) throw new Error(`${path}: Cab vertical browser telemetry anchor is missing`);
    source = source.replace(telemetryNeedle, `${telemetryNeedle}\n  group.userData.uploadedJetwayA1DoorFitPassengerSillCorrectionMeters = cabPassengerSillCorrectionMeters;\n  group.userData.uploadedJetwayA1DoorFitCorrectedCabSillErrorMeters = correctedCabSillErrorMeters;\n  group.userData.uploadedJetwayA1DoorFitCorrectedCabMinimumHorizontalVertexDistanceMeters = correctedCabDoorMinimumHorizontalVertexDistanceMeters;\n  group.userData.uploadedJetwayA1DoorFitCabTunnelCSeamGapMeters = cabTunnelCSeamGapMeters;`);
  } else if (!source.includes("uploadedJetwayA1DoorFitCorrectedCabMinimumHorizontalVertexDistanceMeters")) {
    source = source.replace(
      `  group.userData.uploadedJetwayA1DoorFitCorrectedCabSillErrorMeters = correctedCabSillErrorMeters;`,
      `  group.userData.uploadedJetwayA1DoorFitCorrectedCabSillErrorMeters = correctedCabSillErrorMeters;\n  group.userData.uploadedJetwayA1DoorFitCorrectedCabMinimumHorizontalVertexDistanceMeters = correctedCabDoorMinimumHorizontalVertexDistanceMeters;`,
    );
  }
}

// The historical full-cab veto uses measureCabFace().front.point, whose Y is the
// broad contact-band minimum and whose X/Z is a projected representative centroid.
// After the exact door-facing surface is fitted above, that proxy can remain ~0.44 m
// vertically and ~0.16 m horizontally away even while the real boarding hood is on
// the door. Keep the proxy metrics for diagnostics, but make the fatal fitter gate
// use the physical corrected hood surface plus the unchanged normal/penetration
// safety checks. The independent browser footprint proof later remains fail-closed.
const staleRepresentativeGuard = `  if (\n    vectorGap > 0.12\n    || horizontalGap > 0.08\n    || verticalGap > 0.08\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {\n    throw new Error(\n      \`Supplied A1 full-cab door fit failed: vector=\${vectorGap}, horizontal=\${horizontalGap}, vertical=\${verticalGap}; \`\n      + \`normalError=\${cabNormalErrorDegrees}; penetration=\${cabFuselagePenetrationMeters}; \`\n      + \`target=\${targetWorld.toArray().join(",")}; actual=\${actualWorld.toArray().join(",")}; \`\n      + \`anchor=\${anchor.position.toArray().join(",")}; yaw=\${anchor.rotation.y}; cabYaw=\${cabRelativeYawRadians}\`,\n    );\n  }`;
const physicalSurfaceGuard = `  // a1-final-supplied-cab-physical-surface-acceptance-v1\n  if (\n    correctedCabDoorMinimumHorizontalVertexDistanceMeters > 0.06\n    || correctedCabSillErrorMeters > 0.02\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {\n    throw new Error(\n      \`Supplied A1 physical Cab hood fit failed: hoodHorizontal=\${correctedCabDoorMinimumHorizontalVertexDistanceMeters}, sill=\${correctedCabSillErrorMeters}; \`\n      + \`legacyVector=\${vectorGap}, legacyHorizontal=\${horizontalGap}, legacyVertical=\${verticalGap}; \`\n      + \`normalError=\${cabNormalErrorDegrees}; penetration=\${cabFuselagePenetrationMeters}; \`\n      + \`target=\${targetWorld.toArray().join(",")}; legacyActual=\${actualWorld.toArray().join(",")}; \`\n      + \`anchor=\${anchor.position.toArray().join(",")}; yaw=\${anchor.rotation.y}; cabYaw=\${cabRelativeYawRadians}\`,\n    );\n  }`;
if (source.includes(staleRepresentativeGuard)) {
  source = source.replace(staleRepresentativeGuard, physicalSurfaceGuard);
}

for (const required of [
  marker,
  "cabPassengerSillCorrectionMeters",
  "correctedCabSillErrorMeters <= 0.02",
  "correctedCabDoorMinimumHorizontalVertexDistanceMeters <= 0.06",
  "cabTunnelCSeamGapMeters <= 0.12",
  "uploadedJetwayA1DoorFitPassengerSillCorrectionMeters",
  "uploadedJetwayA1DoorFitCorrectedCabMinimumHorizontalVertexDistanceMeters",
  "a1-final-supplied-cab-physical-surface-acceptance-v1",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final Cab sill surface fit is missing ${required}`);
}
for (const forbidden of [
  "vectorGap > 0.12\n    || horizontalGap > 0.08\n    || verticalGap > 0.08",
  "Supplied A1 full-cab door fit failed:",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale representative-point Cab veto survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final exact supplied Cab threshold is derived from its real aircraft-facing surface, vertically articulated to the fixed authored CRJ door contact target within 2 cm, horizontally required within 6 cm from the real hood surface, kept connected to Tunnel-C, and no longer rejected by the stale representative front-point proxy.`);
