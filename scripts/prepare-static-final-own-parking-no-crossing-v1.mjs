import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-final-kphx-own-parking-rigid-bridge-v1";
const physicalAuthority = "57-static-kphx-own-parking-real-wall-registration-v12";
const crossingAuthority = "57-static-kphx-own-parking-centerline-no-crossing-v1";
const clearanceAuthority = "57-static-kphx-own-parking-physical-envelope-clearance-v1";
const minimumCenterlineClearanceMeters = 5.6;
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const sourceYawLine = "  const yaw = sourceAxisRegistrationYaw;";
  if (!source.includes(sourceYawLine)) throw new Error(`${runtimePath}: decoded-BGL whole-bridge yaw is missing before final static correction`);
  source = source.replace(
    sourceYawLine,
    `  // ${marker}\n  // AIR_Jetway01 is articulated: decoded BGL yaw is stock base provenance,\n  // while the KPHX jetway->own-parking geometry owns the rigid replacement arm.\n  const yaw = targetRegistrationYaw;`,
  );

  const oldSourceFailure = `  if (sourceBridgeHeadingErrorRadians > 1e-9) {\n    throw new Error(\`Static jetway \${placement.gate} visible bridge axis escaped decoded KPHX heading: \${sourceBridgeHeadingErrorRadians} rad\`);\n  }`;
  if (!source.includes(oldSourceFailure)) throw new Error(`${runtimePath}: static BGL visible-axis hard failure is missing`);
  source = source.replace(oldSourceFailure, "");

  const ownGateAnchor = "  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));";
  if (!source.includes(ownGateAnchor)) throw new Error(`${runtimePath}: own-gate heading telemetry is missing`);
  source = source.replace(
    ownGateAnchor,
    `${ownGateAnchor}\n  if (ownGateHeadingErrorRadians > 0.002) {\n    throw new Error(\`Static jetway \${placement.gate} escaped its KPHX-authored own-parking centerline: \${ownGateHeadingErrorRadians} rad\`);\n  }`,
  );

  const terminalDotAnchor = "  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;";
  if (!source.includes(terminalDotAnchor)) throw new Error(`${runtimePath}: terminal-facing telemetry is missing`);
  source = source.replace(
    terminalDotAnchor,
    `${terminalDotAnchor}\n  if (terminalFacingDot > 0.25) {\n    throw new Error(\`Static jetway \${placement.gate} points back toward Terminal 4 instead of its own KPHX stand: dot=\${terminalFacingDot}\`);\n  }`,
  );

  const exportAnchor = "export function registerStaticJetwayFleetToFacade(THREE, group, fleet, placements) {";
  if (!source.includes(exportAnchor)) throw new Error(`${runtimePath}: static registration export is missing`);
  source = source.replace(
    exportAnchor,
    `function staticCenterlinesProperlyIntersect(a, b) {\n  const values = [a.x, a.z, a.targetX, a.targetZ, b.x, b.z, b.targetX, b.targetZ].map(Number);\n  if (!values.every(Number.isFinite)) return true;\n  const [ax, az, atx, atz, bx, bz, btx, btz] = values;\n  const cross = (x1, z1, x2, z2, x3, z3) => (x2 - x1) * (z3 - z1) - (z2 - z1) * (x3 - x1);\n  const d1 = cross(ax, az, atx, atz, bx, bz);\n  const d2 = cross(ax, az, atx, atz, btx, btz);\n  const d3 = cross(bx, bz, btx, btz, ax, az);\n  const d4 = cross(bx, bz, btx, btz, atx, atz);\n  return d1 * d2 < -1e-6 && d3 * d4 < -1e-6;\n}\n\nfunction staticCenterlineDistanceMeters(a, b) {\n  if (staticCenterlinesProperlyIntersect(a, b)) return 0;\n  const pointToSegment = (px, pz, ax, az, bx, bz) => {\n    const dx = bx - ax;\n    const dz = bz - az;\n    const lengthSquared = dx * dx + dz * dz;\n    if (!(lengthSquared > 1e-9)) return Math.hypot(px - ax, pz - az);\n    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared));\n    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));\n  };\n  const ax = Number(a.x); const az = Number(a.z); const atx = Number(a.targetX); const atz = Number(a.targetZ);\n  const bx = Number(b.x); const bz = Number(b.z); const btx = Number(b.targetX); const btz = Number(b.targetZ);\n  if (![ax, az, atx, atz, bx, bz, btx, btz].every(Number.isFinite)) return 0;\n  return Math.min(\n    pointToSegment(ax, az, bx, bz, btx, btz),\n    pointToSegment(atx, atz, bx, bz, btx, btz),\n    pointToSegment(bx, bz, ax, az, atx, atz),\n    pointToSegment(btx, btz, ax, az, atx, atz),\n  );\n}\n\n${exportAnchor}`,
  );

  const placementsAnchor = "  const staticRegisteredPlacements = staticOriginalPlacements.map((placement) => buildRegisteredPlacement(THREE, placement, authoredRotundaOffset));";
  if (!source.includes(placementsAnchor)) throw new Error(`${runtimePath}: registered static placement list is missing`);
  source = source.replace(
    placementsAnchor,
    `${placementsAnchor}\n  const staticCenterlineCrossings = [];\n  const staticClearanceFailures = [];\n  let minimumStaticCenterlineClearanceMeters = Infinity;\n  let minimumStaticCenterlineClearancePair = null;\n  for (let leftIndex = 0; leftIndex < staticRegisteredPlacements.length; leftIndex += 1) {\n    for (let rightIndex = leftIndex + 1; rightIndex < staticRegisteredPlacements.length; rightIndex += 1) {\n      const left = staticRegisteredPlacements[leftIndex];\n      const right = staticRegisteredPlacements[rightIndex];\n      if (staticCenterlinesProperlyIntersect(left, right)) staticCenterlineCrossings.push(\`\${left.gate}<->\${right.gate}\`);\n      const clearanceMeters = staticCenterlineDistanceMeters(left, right);\n      if (clearanceMeters < minimumStaticCenterlineClearanceMeters) {\n        minimumStaticCenterlineClearanceMeters = clearanceMeters;\n        minimumStaticCenterlineClearancePair = \`\${left.gate}<->\${right.gate}\`;\n      }\n      if (clearanceMeters < ${minimumCenterlineClearanceMeters}) {\n        staticClearanceFailures.push(\`\${left.gate}<->\${right.gate}=\${clearanceMeters.toFixed(3)}m\`);\n      }\n    }\n  }\n  if (staticCenterlineCrossings.length) {\n    throw new Error(\`Static Terminal 4 bridge centerlines cross neighboring stands: \${staticCenterlineCrossings.join(\", \")}\`);\n  }\n  if (staticClearanceFailures.length) {\n    throw new Error(\`Static Terminal 4 exact bridge envelopes are too close for the supplied 5.49 m-wide model: \${staticClearanceFailures.join(\", \")}\`);\n  }`,
  );

  const telemetryAnchor = "  group.userData.uploadedJetwayStaticMaximumTerminalFacingDot = maximumTerminalFacingDot;";
  if (!source.includes(telemetryAnchor)) throw new Error(`${runtimePath}: static telemetry anchor is missing`);
  source = source.replace(
    telemetryAnchor,
    `${telemetryAnchor}\n  group.userData.uploadedJetwayStaticPhysicalPoseAuthority = "${physicalAuthority}";\n  group.userData.uploadedJetwayStaticCenterlineIntersectionAuthority = "${crossingAuthority}";\n  group.userData.uploadedJetwayStaticCenterlineIntersectionCount = staticCenterlineCrossings.length;\n  group.userData.uploadedJetwayStaticPhysicalClearanceAuthority = "${clearanceAuthority}";\n  group.userData.uploadedJetwayStaticMinimumCenterlineClearanceMeters = minimumStaticCenterlineClearanceMeters;\n  group.userData.uploadedJetwayStaticMinimumCenterlineClearancePair = minimumStaticCenterlineClearancePair;`,
  );
}

for (const required of [
  marker,
  "const yaw = targetRegistrationYaw;",
  "escaped its KPHX-authored own-parking centerline",
  "function staticCenterlinesProperlyIntersect",
  "function staticCenterlineDistanceMeters",
  "staticCenterlineCrossings",
  "staticClearanceFailures",
  physicalAuthority,
  crossingAuthority,
  clearanceAuthority,
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: final static own-parking correction is missing ${required}`);
}
for (const forbidden of ["const yaw = sourceAxisRegistrationYaw;", "visible bridge axis escaped decoded KPHX heading"]) {
  if (source.includes(forbidden)) throw new Error(`${runtimePath}: stale rigid BGL-arm ownership survived: ${forbidden}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Finalized 57 static rigid exact jetways on KPHX-authored own-parking centerlines with decoded BGL base yaw retained as provenance, zero cross-stand centerline intersections, and >=5.6 m physical centerline clearance.");
